// src/components/board3d/scene.tsx
// Everything inside the <Canvas>. Suspends on the GLB and the room HDRI, so it is always
// mounted under a <Suspense> boundary owned by board-3d.tsx.
"use client";
import { Suspense, useEffect, useMemo } from "react";
import { ContactShadows, Preload } from "@react-three/drei";
import type { Mesh } from "three";
import type { CameraControlsImpl } from "@react-three/drei";
import type { QualityConfig } from "@/lib/camera";
import type { RoomPreset } from "@/lib/rooms";
import type { BoardViewProps, CameraPresetId } from "@/lib/types";
import { createPieceMaterials, disposePieceMaterials } from "./piece-materials";
import { BoardSurface3D } from "./board-surface-3d";
import { CameraRig } from "./camera-rig";
import { CapturedTray3D } from "./captured-tray-3d";
import { Highlights } from "./highlights";
import { Pieces } from "./pieces";
import { Room } from "./room";
import { Squares } from "./squares";
import { CONTACT_SHADOW_Y, PLINTH_SIZE } from "./layout";

export interface SceneProps {
  board: BoardViewProps;
  room: RoomPreset;
  quality: QualityConfig;
  cameraPreset: CameraPresetId;
  cinematic: boolean;
  reducedMotion: boolean;
  /** True when no post-processing Outline is available — use inflated-shell outlines. */
  meshOutline: boolean;
  controlsRef: React.RefObject<CameraControlsImpl | null>;
  registerSelected(mesh: Mesh | null): void;
  onUserInteract(): void;
  roomImageUrl?: string;
}

export function Scene({
  board,
  room,
  quality,
  cameraPreset,
  cinematic,
  reducedMotion,
  meshOutline,
  controlsRef,
  registerSelected,
  onUserInteract,
  roomImageUrl,
}: SceneProps) {
  const materials = useMemo(
    () => createPieceMaterials(room.pieces, quality.allowTransmission),
    [room.pieces, quality.allowTransmission],
  );
  useEffect(() => () => disposePieceMaterials(materials), [materials]);

  const key = room.lights.key;
  const shadowMapSize = quality.directionalShadowMapSize;
  // A promotion prompt is a DOM overlay owned by the game shell; while it is open the
  // board must not accept another click.
  const interactive = board.interactive && board.promotion === null;

  return (
    <>
      {/* FR-21m: the room owns the only assets that suspend on a settings change — the
          HDRI and the uploaded backdrop. Its own boundary means swapping presets
          mid-game blanks the backdrop for the length of the download, never the board,
          the pieces or the camera rig. */}
      <Suspense fallback={null}>
        <Room room={room} imageUrl={roomImageUrl} />
      </Suspense>

      {/* NOTE: drei 10.7.8's <SoftShadows> is NOT usable with three 0.185.1. Its PCSS
          patch of `ShaderChunk.shadowmap_pars_fragment` calls `unpackRGBAToDepth`, which
          r185 no longer declares in that chunk (verified: 0 occurrences, and `packing`
          is not included by meshphysical's fragment shader), so EVERY MeshStandard/
          Physical program fails to link — "no matching overloaded function found" then
          a flood of "useProgram: program not valid". Reproduced live at the High tier.
          `quality.softShadows` therefore stays unused; High still gets soft shadows from
          the Canvas' `shadows="soft"` (PCFSoftShadowMap) plus a 2048 shadow map. */}

      <ambientLight intensity={room.lights.ambientIntensity} />
      <directionalLight
        position={key.position}
        intensity={key.intensity}
        color={key.color}
        castShadow={quality.shadows !== false}
        shadow-mapSize-width={shadowMapSize}
        shadow-mapSize-height={shadowMapSize}
        shadow-bias={-0.0002}
        shadow-normalBias={0.02}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-camera-near={0.5}
        shadow-camera-far={30}
      />

      <BoardSurface3D room={room} quality={quality} />

      <Squares
        orientation={board.orientation}
        interactive={interactive}
        hoverColor={room.highlight.select}
        onSelect={board.onSquareSelect}
      />

      <Highlights
        colours={room.highlight}
        selectedSquare={board.selectedSquare}
        legalTargets={board.legalTargets}
        lastMove={board.lastMove}
        checkSquare={board.checkSquare}
        animate={board.animate}
      />

      <Pieces
        position={board.position}
        materials={materials}
        selectedSquare={board.selectedSquare}
        interactive={interactive}
        animate={board.animate}
        outlineColor={room.highlight.select}
        meshOutline={meshOutline}
        onSelect={board.onSquareSelect}
        registerSelected={registerSelected}
      />

      <CapturedTray3D
        captured={board.captured}
        lastMove={board.lastMove}
        materials={materials}
        animate={board.animate}
      />

      {quality.contactShadows.enabled && (
        <ContactShadows
          position={[0, CONTACT_SHADOW_Y, 0]}
          scale={PLINTH_SIZE}
          blur={2.2}
          opacity={0.55}
          far={2.2}
          resolution={quality.contactShadows.resolution}
          frames={quality.contactShadows.frames}
          color="#000000"
        />
      )}

      <CameraRig
        preset={cameraPreset}
        cinematic={cinematic}
        reducedMotion={reducedMotion}
        controlsRef={controlsRef}
        onUserInteract={onUserInteract}
      />

      <Preload all />
    </>
  );
}
