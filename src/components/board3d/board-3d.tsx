// src/components/board3d/board-3d.tsx
// P4's entry point: a drop-in `(props: BoardViewProps) => JSX.Element`, default-exported
// for `next/dynamic({ ssr: false })`. It imports nothing from Convex and owns no chess
// logic — every field it draws is computed by `useGameController` (§D.11).
"use client";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { useEnvironment, type CameraControlsImpl } from "@react-three/drei";
import { ACESFilmicToneMapping, type Mesh } from "three";
import { Button } from "@/components/ui/button";
import { CAMERA_LIMITS, QUALITY_TIERS, poseForPreset } from "@/lib/camera";
import { resolveRoom } from "@/lib/rooms";
import { useUiStore } from "@/lib/stores/ui-store";
import type {
  BoardViewProps,
  CameraPresetId,
  RenderFailureReason,
  ResolvedQualityTier,
} from "@/lib/types";
import { useQualityWatchdog } from "@/hooks/use-quality-watchdog";
import { AutoTierProbe, QualityWatchdog } from "./quality";
import { PostFx } from "./post-fx";
import { Scene } from "./scene";
import { preloadChessPieces } from "./use-chess-pieces";
import { WebglFallbackNotice, WebglProbe, notifyRenderFailure } from "./webgl-fallback";

/** Warms the 3D chunk's assets: the piece GLB plus any HDRIs passed in (FR-21m, NFR-2a). */
export function preloadAssets(hdriFiles?: string[]): void {
  preloadChessPieces();
  for (const files of hdriFiles ?? []) useEnvironment.preload({ files });
}

const CAMERA_BUTTONS: { id: CameraPresetId; label: string }[] = [
  { id: "white", label: "White" },
  { id: "black", label: "Black" },
  { id: "top", label: "Top" },
  { id: "cinematic", label: "Orbit" },
];

/** Keyboard camera control (NFR-7) — the board itself is operated by P3's SAN input. */
const KEY_ROTATE = 0.14;
const KEY_POLAR = 0.09;
const KEY_DOLLY = 0.9;

export default function Board3D(props: BoardViewProps) {
  const {
    boardOrientation,
    roomPreset,
    roomColors,
    tier,
    postFxEnabled,
    cameraPreset,
    cinematic,
    reducedMotion,
    webglAvailable,
    roomImageUrl,
  } = useBoardSettings(props);

  const room = useMemo(() => resolveRoom(roomPreset, roomColors), [roomPreset, roomColors]);
  const quality = useMemo(() => {
    const base = QUALITY_TIERS[tier];
    if (postFxEnabled) return base;
    // Post off => UNMOUNT the composer. `enabled={false}` would strand the renderer on
    // NoToneMapping and flatten the whole scene (§I-10).
    return { ...base, post: { ...base.post, composer: false } };
  }, [tier, postFxEnabled]);

  // three r185 deprecated PCFSoftShadowMap and silently substitutes PCFShadowMap, so
  // `true` / "soft" from the tier table would only earn a console warning. "percentage"
  // asks for the map three actually uses; the visual result is identical.
  const canvasShadows = quality.shadows === false ? false : quality.shadows === "basic" ? "basic" : "percentage";

  const meshOutline = !quality.post.composer || !quality.post.outline.enabled;
  const watchdog = useQualityWatchdog();
  const controlsRef = useRef<CameraControlsImpl | null>(null);

  // FR-32 resolution scaling. It has to live in the `dpr` PROP rather than a bare
  // `setDpr()` call: fiber re-applies this prop from `configure()` on every render, so an
  // imperative override would be undone by the next move. Storing the tier it applies to
  // (instead of a boolean) resets it on a tier change without a set-state-in-effect.
  const [regressedTier, setRegressedTier] = useState<ResolvedQualityTier | null>(null);
  const onRegressDpr = useCallback(() => setRegressedTier(tier), [tier]);
  const onRestoreDpr = useCallback(() => setRegressedTier(null), []);
  const canvasDpr: [number, number] | number =
    regressedTier === tier ? Math.min(quality.dpr[1], quality.maxPixelRatioOnRegress) : quality.dpr;

  // The selected piece mesh reaches the post-processing Outline through a ref callback,
  // never a setState-in-effect (which `react-hooks/set-state-in-effect` forbids here).
  const [selectedMesh, setSelectedMesh] = useState<Mesh | null>(null);
  const registerSelected = useCallback((mesh: Mesh | null) => setSelectedMesh(mesh), []);

  const [failure, setFailure] = useState<RenderFailureReason | null>(null);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const onRenderFailure = props.onRenderFailure;
  const failureRef = useRef(onRenderFailure);
  useEffect(() => {
    failureRef.current = onRenderFailure;
  }, [onRenderFailure]);

  const reportFailure = useCallback((reason: RenderFailureReason) => {
    setFailure(reason);
    failureRef.current?.(reason);
  }, []);

  const handleContextLost = useCallback(
    (event: Event) => {
      // preventDefault keeps the canvas restorable; we still hand over to 2D (§E.10.5).
      event.preventDefault();
      const canvas = event.target as HTMLCanvasElement | null;
      // Tearing the Canvas down (route change, HMR, a tier switch) also fires
      // `webglcontextlost`. Reporting that as a failure would bounce the player into the
      // 2D board on the way OUT of the game, so wait a tick and only report if the canvas
      // is still in the document — a genuine runtime loss leaves it mounted.
      window.setTimeout(() => {
        if (!mountedRef.current) return;
        if (canvas && !canvas.isConnected) return;
        notifyRenderFailure("context-lost");
        reportFailure("context-lost");
      }, 0);
    },
    [reportFailure],
  );

  const exitCinematic = useCallback(() => {
    if (useUiStore.getState().cinematic) useUiStore.getState().setCinematic(false);
  }, []);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    const controls = controlsRef.current;
    if (!controls) return;
    switch (event.key) {
      case "ArrowLeft":
        controls.rotate(-KEY_ROTATE, 0, true);
        break;
      case "ArrowRight":
        controls.rotate(KEY_ROTATE, 0, true);
        break;
      case "ArrowUp":
        controls.rotate(0, -KEY_POLAR, true);
        break;
      case "ArrowDown":
        controls.rotate(0, KEY_POLAR, true);
        break;
      case "+":
      case "=":
        controls.dolly(KEY_DOLLY, true);
        break;
      case "-":
      case "_":
        controls.dolly(-KEY_DOLLY, true);
        break;
      case "r":
      case "R":
        void controls.normalizeRotations().reset(true);
        break;
      default:
        return;
    }
    event.preventDefault();
  }, []);

  // Frozen at mount: re-applying `camera` reactively would yank the camera out of a
  // CameraControls transition every time the preset changes.
  const [initialCamera] = useState(() => ({
    fov: CAMERA_LIMITS.fov,
    near: CAMERA_LIMITS.near,
    far: CAMERA_LIMITS.far,
    position: poseForPreset(cameraPreset).position,
  }));

  if (failure) {
    return <WebglFallbackNotice reason={failure} />;
  }

  if (webglAvailable === false) {
    return (
      <>
        <WebglProbe onUnavailable={reportFailure} />
        <WebglFallbackNotice reason="webgl-unavailable" />
      </>
    );
  }

  return (
    <div
      className="relative h-full min-h-[320px] w-full"
      role="application"
      aria-label="3D chess board. Arrow keys orbit the camera, plus and minus zoom, R resets it."
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <WebglProbe onUnavailable={reportFailure} />
      <AutoTierProbe />

      {webglAvailable === true && (
        <Canvas
          className="h-full w-full touch-none"
          shadows={canvasShadows}
          dpr={canvasDpr}
          camera={initialCamera}
          gl={{
            antialias: !quality.post.composer,
            powerPreference: "high-performance",
            toneMapping: ACESFilmicToneMapping,
          }}
          onCreated={({ gl }) => {
            gl.domElement.addEventListener("webglcontextlost", handleContextLost, false);
          }}
          onPointerMissed={() => props.onDeselect()}
        >
          <Suspense fallback={null}>
            <Scene
              board={props}
              room={room}
              roomImageUrl={roomImageUrl}
              quality={quality}
              cameraPreset={cameraPreset}
              cinematic={cinematic}
              reducedMotion={reducedMotion}
              meshOutline={meshOutline}
              controlsRef={controlsRef}
              registerSelected={registerSelected}
              onUserInteract={exitCinematic}
            />
          </Suspense>

          <PostFx
            quality={quality}
            selected={selectedMesh}
            outlineColor={room.highlight.select}
          />

          <QualityWatchdog
            watchdog={watchdog}
            onRegressDpr={onRegressDpr}
            onRestoreDpr={onRestoreDpr}
          />
        </Canvas>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-end p-2">
        <div className="pointer-events-auto flex flex-wrap justify-end gap-1 rounded-lg bg-background/70 p-1 backdrop-blur-sm">
          {CAMERA_BUTTONS.map((button) => (
            <Button
              key={button.id}
              size="sm"
              // Comfortable touch targets on a 360 px viewport (NFR-6).
              className="min-h-9 min-w-11"
              variant={cameraPreset === button.id ? "secondary" : "ghost"}
              aria-pressed={cameraPreset === button.id}
              onClick={() => useUiStore.getState().setCameraPreset(button.id)}
            >
              {button.label}
            </Button>
          ))}
          <Button
            size="sm"
            className="min-h-9 min-w-11"
            variant="ghost"
            aria-label="Reset the camera"
            onClick={() => {
              const controls = controlsRef.current;
              if (!controls) return;
              void controls.normalizeRotations().reset(true);
            }}
          >
            Reset
          </Button>
        </div>
      </div>

      <span className="sr-only" aria-live="polite">
        {boardOrientation === "w" ? "Viewing from White's side." : "Viewing from Black's side."}
      </span>
    </div>
  );
}

/** All the per-viewer view settings the board reads (never game state — §D.11). */
function useBoardSettings(props: BoardViewProps) {
  const roomPreset = useUiStore((state) => state.roomPreset);
  const roomColors = useUiStore((state) => state.roomColors);
  const tier = useUiStore((state) => state.resolvedTier);
  const postFxEnabled = useUiStore((state) => state.postFxEnabled);
  const cameraPreset = useUiStore((state) => state.cameraPreset);
  const cinematic = useUiStore((state) => state.cinematic);
  const reducedMotion = useUiStore((state) => state.reducedMotion);
  const webglAvailable = useUiStore((state) => state.webglAvailable);
  // FR-21k: mirrored from `players.me` by use-settings-sync; null for signed-out players.
  const roomImageUrl = useUiStore((state) => state.roomImageUrl);

  return {
    boardOrientation: props.orientation,
    roomPreset,
    roomColors,
    tier,
    postFxEnabled,
    cameraPreset,
    cinematic,
    reducedMotion,
    webglAvailable,
    roomImageUrl: roomImageUrl ?? undefined,
  };
}
