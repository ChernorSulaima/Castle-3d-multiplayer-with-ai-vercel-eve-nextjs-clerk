// src/components/board3d/room.tsx
// FR-21h..FR-21n: every visual difference between rooms comes from `src/lib/rooms.ts`.
// Adding a room = one entry there plus an .hdr in public/hdri — no change in this file.
"use client";
import { useEffect } from "react";
import { Backdrop, Environment, Grid, Sparkles, Stars, useTexture } from "@react-three/drei";
import { SRGBColorSpace } from "three";
import type { RoomPreset } from "@/lib/rooms";
import { PLINTH_HEIGHT, PLINTH_TOP_Y } from "./layout";

/** Blurred photo backdrop for a player-uploaded room image (FR-21k, v1 scope in §I-16). */
function ImageBackdrop({ url }: { url: string }) {
  const texture = useTexture(url);

  // Convex storage URLs are signed and expire, so a stale entry in drei's global loader
  // cache would resurrect a dead URL on the next mount. Drop it when this one goes.
  useEffect(() => () => useTexture.clear(url), [url]);

  return (
    <mesh position={[0, 4, -16]} raycast={() => null}>
      <planeGeometry args={[48, 27]} />
      {/* Set through the reconciler rather than by hand: `react-hooks/immutability`
          forbids writing to a value a hook returned. */}
      <meshBasicMaterial
        map={texture}
        map-colorSpace={SRGBColorSpace}
        toneMapped={false}
        depthWrite={false}
      />
    </mesh>
  );
}

export interface RoomProps {
  room: RoomPreset;
  /** Optional custom backdrop image the player uploaded. */
  imageUrl?: string;
}

export function Room({ room, imageUrl }: RoomProps) {
  const { lights, floor, extras } = room;
  const showHdriBackground = room.background === "hdri" && !imageUrl;

  return (
    <>
      {/* The HDRI is always the IBL source; `background` only controls the skybox.
          `backgroundBlurriness` rather than `blur`: only EnvironmentCube maps `blur` onto
          it, so the Park room (drei's `ground` path renders an EnvironmentMap) silently
          lost its configured blur — and `blur` was applied to the THREE.Scene as a stray
          property instead. */}
      <Environment
        files={room.hdri}
        background={showHdriBackground}
        backgroundBlurriness={lights.backgroundBlur}
        backgroundIntensity={lights.bgIntensity}
        environmentIntensity={lights.envIntensity}
        environmentRotation={[0, lights.envYaw, 0]}
        backgroundRotation={[0, lights.envYaw, 0]}
        ground={floor.kind === "ground" ? { radius: 40, height: 6, scale: 100 } : false}
      />

      {/* MUST stay after <Environment>. drei restores the previous skybox from a
          dependency-less layout effect whose cleanup runs in the mutation phase, in child
          order — put this first and switching an HDRI room to a flat-colour room leaves
          the OLD room's HDRI as the background (FR-21j/FR-21m live preview). Ordered
          after, the restore happens first and this attach wins. */}
      {room.background === "colour" && (
        <color attach="background" args={[room.backgroundColor ?? "#0f1115"]} />
      )}

      {imageUrl && <ImageBackdrop url={imageUrl} />}

      {extras.stars && (
        <Stars
          radius={extras.stars.radius}
          depth={extras.stars.depth}
          count={extras.stars.count}
          factor={extras.stars.factor}
          speed={extras.stars.speed}
          saturation={0}
          fade
        />
      )}

      {extras.sparkles && (
        <Sparkles
          count={extras.sparkles.count}
          scale={extras.sparkles.scale}
          size={extras.sparkles.size}
          speed={extras.sparkles.speed}
          color={extras.sparkles.color}
          position={[0, 2.5, 0]}
        />
      )}

      {floor.kind === "backdrop" && (
        <Backdrop
          floor={0.3}
          segments={20}
          receiveShadow
          scale={[40, 16, 14]}
          position={[0, -PLINTH_HEIGHT, -9]}
        >
          <meshStandardMaterial color={floor.color ?? "#f4f5f7"} roughness={0.9} metalness={0} />
        </Backdrop>
      )}

      {floor.kind === "grid" && (
        <Grid
          position={[0, PLINTH_TOP_Y - PLINTH_HEIGHT - 0.01, 0]}
          args={[40, 40]}
          cellSize={1}
          cellThickness={0.6}
          cellColor={floor.color ?? "#9aa0a6"}
          sectionSize={8}
          sectionThickness={1.2}
          sectionColor={floor.color ?? "#9aa0a6"}
          fadeDistance={40}
          fadeStrength={1.5}
          infiniteGrid
        />
      )}
    </>
  );
}
