// src/components/board3d/board-3d.tsx
// P4's entry point: a drop-in `(props: BoardViewProps) => JSX.Element`, default-exported
// for `next/dynamic({ ssr: false })`. It imports nothing from Convex and owns no chess
// logic — every field it draws is computed by `useGameController` (§D.11).
//
// U3 adds the optional `showcase` prop of UI_REDESIGN §10.4 on top of that contract:
// the same board, driven by values passed in instead of the ui-store, running as
// scenery (idle orbit, no controls, paused off screen, capped dpr).
"use client";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { useEnvironment, type CameraControlsImpl } from "@react-three/drei";
import { ACESFilmicToneMapping, type Mesh } from "three";
import { CAMERA_LIMITS, QUALITY_TIERS, poseForPreset } from "@/lib/camera";
import { resolveRoom } from "@/lib/rooms";
import { useUiStore } from "@/lib/stores/ui-store";
import { cn, useReducedMotion } from "@/lib/ui";
import type {
  BoardViewProps,
  CameraPresetId,
  RenderFailureReason,
  ResolvedQualityTier,
} from "@/lib/types";
import { useQualityWatchdog } from "@/hooks/use-quality-watchdog";
import { CameraOverlay } from "./camera-overlay";
import { FirstFrame, FrameRateSampler, FrameloopGate } from "./frame-signals";
import { AutoTierProbe, QualityWatchdog } from "./quality";
import { PostFx } from "./post-fx";
import { Scene } from "./scene";
import { clampDpr, resolveShowcase, type Board3DShowcase, type ResolvedShowcase } from "./showcase";
import { preloadChessPieces } from "./use-chess-pieces";
import { WebglFallbackNotice, WebglProbe, notifyRenderFailure } from "./webgl-fallback";

/** Warms the 3D chunk's assets: the piece GLB plus any HDRIs passed in (FR-21m, NFR-2a). */
export function preloadAssets(hdriFiles?: string[]): void {
  preloadChessPieces();
  for (const files of hdriFiles ?? []) useEnvironment.preload({ files });
}

export type { Board3DShowcase } from "./showcase";

export interface Board3DProps extends BoardViewProps {
  /** Present => showcase mode (§10.4). Absent => the game board, unchanged. */
  showcase?: Board3DShowcase;
  /**
   * Hide the in-canvas camera overlay without entering showcase mode. The game shell
   * (§5.1) puts White / Black / Top / Orbit / Reset in its own DOM action bar, and two
   * copies of the same five buttons — one of them sitting over the bottom rank of the
   * board — is worse than either alone. Outside showcase mode the wrapper stays a
   * `role="application"` widget with its keyboard camera control (NFR-7) intact; only
   * the buttons go. In showcase mode this is `showcase.hideControls` and the board
   * becomes a picture instead.
   */
  hideControls?: boolean;
  /** Fires once after the first frame is on screen, for a fade-in (§1.3). */
  onFirstFrame?(): void;
  /**
   * Rendered frames per second, sampled about twice a second and silent while the
   * loop is paused. Instrumentation for /dev/board3d; the game passes nothing.
   */
  onFrameRate?(fps: number): void;
}

/** Keyboard camera control (NFR-7) — the board itself is operated by P3's SAN input. */
const KEY_ROTATE = 0.14;
const KEY_POLAR = 0.09;
const KEY_DOLLY = 0.9;

export default function Board3D(props: Board3DProps) {
  const {
    boardOrientation,
    showcase,
    roomPreset,
    roomColors,
    tier,
    postFxEnabled,
    cameraPreset,
    selectCameraPreset,
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

  // three 0.185.1 deprecated PCFSoftShadowMap: `WebGLShadowMap` warns and substitutes
  // PCFShadowMap, so the tier table's `true` / "soft" would only earn a console warning.
  // "percentage" asks for the map three actually uses; the visual result is identical.
  // The upshot for FR-31: High and Medium both get PERCENTAGE-CLOSER filtered shadows
  // (they differ in shadow-map size and dpr, not technique) and Low gets hard-edged
  // BasicShadowMap plus a baked ContactShadows pass. Nothing here is PCSS — see the
  // shadow note in scene.tsx for why drei's <SoftShadows> cannot be used with r185.
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
  // §10.4: showcase caps the resolution on top of the tier — a hero must never cost
  // more than the game it advertises.
  const maxDpr = showcase?.maxDpr ?? Infinity;
  const canvasDpr: [number, number] | number =
    regressedTier === tier
      ? Math.min(quality.dpr[1], quality.maxPixelRatioOnRegress, maxDpr)
      : clampDpr(quality.dpr, maxDpr);

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

  // FR-24: touching the camera ends the idle orbit — except in showcase mode, where the
  // orbit IS the point and nothing the visitor does may stop it (§10.4).
  const exitCinematic = useCallback(() => {
    if (showcase) return;
    if (useUiStore.getState().cinematic) useUiStore.getState().setCinematic(false);
  }, [showcase]);

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

  const resetCamera = useCallback(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    void controls.normalizeRotations().reset(true);
  }, []);

  // §10.4: while the wrapper is off screen the Canvas drops to `frameloop="demand"`,
  // which renders only what invalidates. Only showcase boards do this — the game board
  // is always the thing being looked at.
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const pauseWhenOffscreen = showcase?.pauseWhenOffscreen ?? false;
  const [offscreen, setOffscreen] = useState(false);
  useEffect(() => {
    if (!pauseWhenOffscreen) return;
    const node = wrapperRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (entry) setOffscreen(!entry.isIntersecting);
      },
      { threshold: 0 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [pauseWhenOffscreen]);
  const paused = pauseWhenOffscreen && offscreen;

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

  const controlsHidden = props.hideControls ?? Boolean(showcase?.hideControls);
  // A SHOWCASE board with no controls is a picture, not a widget: it must not offer
  // keyboard camera control it does not have, and it must not sit in the tab order.
  // A game board with `hideControls` is the opposite case — the controls moved to the
  // shell's action bar, so the arrow keys, the tab stop and the orientation live
  // region all stay exactly where they were.
  const widget = !(showcase !== null && controlsHidden);

  return (
    <div
      ref={wrapperRef}
      className={cn("relative w-full", showcase ? "h-full" : "h-full min-h-[320px]")}
      // Hook for the consumer's CSS (the landing fades this in on `onFirstFrame`).
      data-showcase={showcase ? "true" : undefined}
      data-paused={paused ? "true" : undefined}
      role={widget ? "application" : "img"}
      aria-label={
        widget
          ? "3D chess board. Arrow keys orbit the camera, plus and minus zoom, R resets it."
          : `A 3D chess board in the ${room.label} room.`
      }
      tabIndex={widget ? 0 : undefined}
      onKeyDown={widget ? handleKeyDown : undefined}
    >
      <WebglProbe onUnavailable={reportFailure} />
      {/* The auto tier probe reads the visitor's GPU into the ui-store; a showcase
          board is told its tier and must not write settings back (§10.4). */}
      {showcase ? null : <AutoTierProbe />}

      {webglAvailable === true && (
        <Canvas
          className="h-full w-full touch-none"
          // §10.4: a non-interactive showcase ignores the pointer entirely, so the
          // page behind it scrolls and the orbit is never interrupted. It has to be
          // an inline style: fiber writes `pointerEvents: "auto"` on this same div
          // itself, and an inline declaration outranks any class.
          style={showcase && !props.interactive ? { pointerEvents: "none" } : undefined}
          shadows={canvasShadows}
          dpr={canvasDpr}
          frameloop={paused ? "demand" : "always"}
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
              // FR-25 restores the player's own seat from sessionStorage. A hero must
              // not inherit it, and must not overwrite it either.
              persistSession={!showcase}
              paused={paused}
            />
            <FirstFrame onFirstFrame={props.onFirstFrame} />
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

          <FrameloopGate paused={paused} />
          {props.onFrameRate ? <FrameRateSampler onFrameRate={props.onFrameRate} /> : null}
        </Canvas>
      )}

      {controlsHidden ? null : (
        <CameraOverlay preset={cameraPreset} onSelect={selectCameraPreset} onReset={resetCamera} />
      )}

      {widget && (
        <span className="sr-only" aria-live="polite">
          {boardOrientation === "w" ? "Viewing from White's side." : "Viewing from Black's side."}
        </span>
      )}
    </div>
  );
}

/**
 * All the per-viewer view settings the board reads (never game state — §D.11).
 *
 * With a `showcase` prop it reads those values instead of the ui-store and never
 * writes the store back (§10.4); the WebGL probe result is the one exception, because
 * "this browser cannot do 3D at all" is a fact about the device, not a preference.
 */
function useBoardSettings(props: Board3DProps) {
  const showcase: ResolvedShowcase | null = useMemo(
    () => (props.showcase ? resolveShowcase(props.showcase) : null),
    [props.showcase],
  );
  const inShowcase = showcase !== null;

  const storeRoomPreset = useUiStore((state) => state.roomPreset);
  const storeRoomColors = useUiStore((state) => state.roomColors);
  const storeTier = useUiStore((state) => state.resolvedTier);
  const storePostFx = useUiStore((state) => state.postFxEnabled);
  const storeCameraPreset = useUiStore((state) => state.cameraPreset);
  const storeCinematic = useUiStore((state) => state.cinematic);
  const storeReducedMotion = useUiStore((state) => state.reducedMotion);
  const webglAvailable = useUiStore((state) => state.webglAvailable);
  // FR-21k: mirrored from `players.me` by use-settings-sync; null for signed-out players.
  const storeRoomImageUrl = useUiStore((state) => state.roomImageUrl);

  // The game keeps this in the store (board-surface.tsx mirrors the media query into
  // it); a showcase board can be mounted anywhere, so read the query as well.
  const prefersReducedMotion = useReducedMotion();

  // A showcase board still gets camera buttons when `hideControls` is false, and they
  // have to land somewhere that is not the player's saved settings.
  const [showcaseCamera, setShowcaseCamera] = useState<CameraPresetId | null>(null);
  const selectCameraPreset = useCallback(
    (preset: CameraPresetId) => {
      if (inShowcase) setShowcaseCamera(preset);
      else useUiStore.getState().setCameraPreset(preset);
    },
    [inShowcase],
  );

  const cameraPreset = showcase
    ? (showcaseCamera ?? showcase.cameraPreset)
    : storeCameraPreset;

  return {
    boardOrientation: props.orientation,
    showcase,
    roomPreset: showcase ? showcase.roomPreset : storeRoomPreset,
    roomColors: showcase ? showcase.roomColors : storeRoomColors,
    tier: showcase ? showcase.tier : storeTier,
    postFxEnabled: showcase ? showcase.postFx : storePostFx,
    cameraPreset,
    selectCameraPreset,
    cinematic: showcase ? cameraPreset === "cinematic" : storeCinematic,
    reducedMotion: storeReducedMotion || prefersReducedMotion,
    webglAvailable,
    roomImageUrl: showcase ? undefined : (storeRoomImageUrl ?? undefined),
  };
}
