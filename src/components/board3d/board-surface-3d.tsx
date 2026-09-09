// src/components/board3d/board-surface-3d.tsx
// The physical board: a plinth, a reflective top surface (FR-27) and 64 tiles drawn as
// two instanced meshes (one per square colour) so the whole board costs 3 draw calls.
"use client";
import { useEffect, useMemo } from "react";
import { Instance, Instances, MeshReflectorMaterial } from "@react-three/drei";
import { BoxGeometry } from "three";
import { BOARD_HALF, FILES, RANKS, isLightSquare, squareToWorld } from "@/lib/constants";
import type { SquareId } from "@/lib/types";
import type { RoomPreset } from "@/lib/rooms";
import type { QualityConfig } from "@/lib/camera";
import { createBoardMaterials, disposeBoardMaterials } from "./piece-materials";
import {
  FRAME_WIDTH,
  PLINTH_HEIGHT,
  PLINTH_SIZE,
  PLINTH_TOP_Y,
  SQUARE_THICKNESS,
  TILE_SIZE,
} from "./layout";

interface TilePlacement {
  square: SquareId;
  position: [number, number, number];
}

/** Static split of the 64 squares by colour. Computed once at module scope. */
const TILES: { light: TilePlacement[]; dark: TilePlacement[] } = (() => {
  const light: TilePlacement[] = [];
  const dark: TilePlacement[] = [];
  for (const file of FILES) {
    for (const rank of RANKS) {
      const square = `${file}${rank}` as SquareId;
      const [x, , z] = squareToWorld(square);
      const placement: TilePlacement = { square, position: [x, PLINTH_TOP_Y + SQUARE_THICKNESS / 2, z] };
      (isLightSquare(square) ? light : dark).push(placement);
    }
  }
  return { light, dark };
})();

export interface BoardSurface3DProps {
  room: RoomPreset;
  quality: QualityConfig;
}

export function BoardSurface3D({ room, quality }: BoardSurface3DProps) {
  const materials = useMemo(() => createBoardMaterials(room.board), [room.board]);
  useEffect(() => () => disposeBoardMaterials(materials), [materials]);

  const tileGeometry = useMemo(
    () => new BoxGeometry(TILE_SIZE, SQUARE_THICKNESS, TILE_SIZE),
    [],
  );
  useEffect(() => () => tileGeometry.dispose(), [tileGeometry]);

  const reflector = room.board.reflector;

  return (
    <group>
      {/* Plinth: the body the board sits on. Also the shadow catcher on Low. */}
      <mesh position={[0, PLINTH_TOP_Y - PLINTH_HEIGHT / 2, 0]} receiveShadow raycast={() => null}>
        <boxGeometry args={[PLINTH_SIZE, PLINTH_HEIGHT, PLINTH_SIZE]} />
        <primitive object={materials.frame} attach="material" />
      </mesh>

      {/* Top surface. `MeshReflectorMaterial` mirrors around the mesh's local +Z, so the
          plane must be rotated (never the geometry). Off on Low (FR-31). */}
      <mesh
        rotation-x={-Math.PI / 2}
        position={[0, PLINTH_TOP_Y + 0.001, 0]}
        receiveShadow
        raycast={() => null}
      >
        <planeGeometry args={[PLINTH_SIZE, PLINTH_SIZE]} />
        {quality.reflector.enabled ? (
          <MeshReflectorMaterial
            resolution={quality.reflector.resolution}
            blur={reflector.blur}
            mixBlur={reflector.mixBlur}
            mixStrength={reflector.mixStrength}
            mixContrast={reflector.mixContrast}
            mirror={reflector.mirror}
            depthScale={1}
            minDepthThreshold={0.4}
            maxDepthThreshold={1.4}
            color={reflector.color}
            metalness={reflector.metalness}
            roughness={reflector.roughness}
          />
        ) : (
          <meshStandardMaterial
            color={reflector.color}
            metalness={reflector.metalness}
            roughness={Math.min(1, reflector.roughness + 0.2)}
          />
        )}
      </mesh>

      {/* Rim so the playing area reads as inset into the plinth. */}
      <mesh position={[0, PLINTH_TOP_Y + SQUARE_THICKNESS / 2, 0]} raycast={() => null}>
        <boxGeometry
          args={[
            BOARD_HALF * 2 + FRAME_WIDTH,
            SQUARE_THICKNESS * 0.9,
            BOARD_HALF * 2 + FRAME_WIDTH,
          ]}
        />
        <primitive object={materials.frame} attach="material" />
      </mesh>

      <Instances
        geometry={tileGeometry}
        material={materials.light}
        limit={32}
        range={32}
        castShadow={false}
        receiveShadow
      >
        {TILES.light.map((tile) => (
          <Instance key={tile.square} position={tile.position} />
        ))}
      </Instances>

      <Instances
        geometry={tileGeometry}
        material={materials.dark}
        limit={32}
        range={32}
        castShadow={false}
        receiveShadow
      >
        {TILES.dark.map((tile) => (
          <Instance key={tile.square} position={tile.position} />
        ))}
      </Instances>
    </group>
  );
}
