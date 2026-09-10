// src/lib/camera.ts
import type { CameraPresetId, Colour, ResolvedQualityTier } from "./types";

const DEG = Math.PI / 180;

export interface CameraPose {
  position: [number, number, number];
  target: [number, number, number];
}

/**
 * The "Top" preset must sit INSIDE the FR-20 polar clamp. camera-controls only applies
 * `minPolarAngle`/`maxPolarAngle` in `rotateTo()` and the pointer handlers — `setLookAt()`
 * writes `_sphericalEnd` unclamped and `update()` only calls `makeSafe()` — so a
 * near-vertical preset would be legal until the first orbit drag, which then snaps the
 * camera to `minPolarAngle` in a single frame. 14 deg keeps a 4 deg margin over the 10 deg
 * limit while still reading as a top-down view.
 */
const TOP_DISTANCE = 13;
const TOP_POLAR = 14 * DEG;

/** "cinematic" is not a pose — it is the white pose plus idle auto-orbit. */
export const CAMERA_PRESETS: Record<Exclude<CameraPresetId, "cinematic">, CameraPose> = {
  white: { position: [0, 7.5, 9], target: [0, 0, 0] },
  black: { position: [0, 7.5, -9], target: [0, 0, 0] },
  top: {
    position: [0, TOP_DISTANCE * Math.cos(TOP_POLAR), TOP_DISTANCE * Math.sin(TOP_POLAR)],
    target: [0, 0, 0],
  },
};

export const CAMERA_LIMITS = {
  fov: 40,
  near: 0.1,
  far: 200,
  minPolarAngle: 10 * DEG, // FR-20: 10deg..85deg from vertical
  maxPolarAngle: 85 * DEG,
  minDistance: 4, // FR-22: "a few squares"
  maxDistance: 22, // FR-22: "whole board plus room"
  smoothTime: 0.25,
  draggingSmoothTime: 0.1,
  dollySpeed: 0.8,
  truckSpeed: 1.5,
  boundaryFriction: 0.2,
  /** FR-21: target pan box so the board can never be lost. Feed to setBoundary(new Box3(...)). */
  boundaryMin: [-4, -0.5, -4] as [number, number, number],
  boundaryMax: [4, 2, 4] as [number, number, number],
  /** rad/s for the idle cinematic orbit (FR-24). */
  cinematicSpeed: 0.15,
};

export function seatPresetFor(colour: Colour): "white" | "black" {
  return colour === "w" ? "white" : "black";
}

/** The pose a preset resolves to. "cinematic" reuses the white seat (FR-24). */
export function poseForPreset(preset: CameraPresetId): CameraPose {
  return preset === "cinematic" ? CAMERA_PRESETS.white : CAMERA_PRESETS[preset];
}

/* ------------------------------------------------------- aspect-aware framing */

/**
 * The poses above are fixed distances, and a perspective camera's HORIZONTAL field of
 * view is its vertical fov widened by the canvas aspect. They were tuned in a wide box
 * (the /dev/board3d harness is ~16:9) where that is generous; in a square one — which
 * is exactly what the §5.1 game shell hands the board — the horizontal fov collapses to
 * the vertical 40 deg and the near corners of the board fall outside the frame. The
 * cinematic orbit makes it worse still: as the azimuth swings to 45 deg the board
 * presents its DIAGONAL to the camera, which is another factor of root 2 wider.
 *
 * So: the distance a pose needs in order to keep `halfWidth` world units visible either
 * side of the target, at this aspect. Purely horizontal — the vertical extent is
 * foreshortened by the camera's elevation and has never been the binding constraint, and
 * fitting it too would pull the wide-screen framing back for no reason.
 *
 * `depthAdvance` is the second half of the same sum and the reason the first version of
 * this still clipped: a perspective frustum is a WEDGE, so the half-width it shows
 * shrinks with depth. The corner of the board that has to stay in frame is not on the
 * target plane — it sits `depthAdvance` world units NEARER the camera along the view
 * axis, where the frame is `depthAdvance * tan(fov/2) * aspect` narrower. Pushing the
 * camera back by exactly that much restores it. Zero reproduces the old plane-only fit,
 * which is correct for anything that really does sit at the target's depth.
 */
export function minFitDistance(
  halfWidth: number,
  aspect: number,
  fovDeg = CAMERA_LIMITS.fov,
  depthAdvance = 0,
): number {
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  const distance = halfWidth / (Math.tan((fovDeg * DEG) / 2) * safeAspect) + Math.max(0, depthAdvance);
  // FR-22's ceiling still wins: better a hair cropped than floating out of the room.
  return Math.min(distance, CAMERA_LIMITS.maxDistance);
}

/**
 * How far in front of the target the near corner of a flat, board-plane object of
 * half-depth `halfDepth` sits, measured along the camera's own view axis: the horizontal
 * run of the pose direction (cos of its elevation) times that half-depth. A camera
 * directly overhead gets 0 — nothing is nearer than the target — and a camera at eye
 * level gets the whole `halfDepth`. Feed the result to `minFitDistance`.
 */
export function nearCornerAdvance(pose: CameraPose, halfDepth: number): number {
  const dx = pose.position[0] - pose.target[0];
  const dy = pose.position[1] - pose.target[1];
  const dz = pose.position[2] - pose.target[2];
  const distance = Math.hypot(dx, dy, dz);
  if (distance === 0) return 0;
  return (Math.hypot(dx, dz) / distance) * halfDepth;
}

/**
 * `pose` pushed straight back along its own view direction until it is at least
 * `minFitDistance` from its target — never pulled closer, so a wide canvas keeps the
 * framing the presets were designed for and only a narrow one moves. Returns the pose
 * unchanged (same object) when no correction is needed.
 *
 * `halfDepth` is the half-extent of the same object ALONG the ground, toward the camera
 * (see `nearCornerAdvance`); pass 0 for a fit that only has to hold on the target plane.
 */
export function fitPoseToAspect(
  pose: CameraPose,
  halfWidth: number,
  aspect: number,
  halfDepth = 0,
): CameraPose {
  const [px, py, pz] = pose.position;
  const [tx, ty, tz] = pose.target;
  const dx = px - tx;
  const dy = py - ty;
  const dz = pz - tz;
  const distance = Math.hypot(dx, dy, dz);
  if (distance === 0) return pose;

  const required = minFitDistance(
    halfWidth,
    aspect,
    CAMERA_LIMITS.fov,
    nearCornerAdvance(pose, halfDepth),
  );
  if (required <= distance) return pose;

  const scale = required / distance;
  return {
    position: [tx + dx * scale, ty + dy * scale, tz + dz * scale],
    target: pose.target,
  };
}

/* ------------------------------------------------------------ quality tiers */

export interface QualityConfig {
  dpr: [number, number]; // FR-32: never above 2
  /**
   * Requested `<Canvas shadows>` value. board-3d.tsx maps it to what three 0.185.1
   * actually supports: `"basic"` stays BasicShadowMap (hard edges), and both `true` and
   * `"soft"` become `"percentage"` (PCFShadowMap, percentage-closer filtering) because
   * r185 deprecated PCFSoftShadowMap and substitutes PCFShadowMap anyway.
   */
  shadows: false | true | "basic" | "soft";
  /**
   * DEAD CONFIG — nothing reads it. drei 10.7.8's `<SoftShadows>` (PCSS) cannot compile
   * against three 0.185.1: its shader patch calls `unpackRGBAToDepth`, which r185 no
   * longer declares in `shadowmap_pars_fragment`, so every MeshStandard/Physical program
   * fails to link. Kept only so the field can be revived if drei ships an r185 patch;
   * the reproduction is documented in board3d/scene.tsx.
   */
  softShadows: boolean;
  directionalShadowMapSize: number;
  reflector: { enabled: boolean; resolution: number } ;
  contactShadows: { enabled: boolean; resolution: number; frames: number };
  /** Post-processing. `composer: false` means UNMOUNT <EffectComposer> entirely —
   *  passing enabled={false} would leave gl.toneMapping = NoToneMapping
   *  (postprocessing.md §2). */
  post: {
    composer: boolean;
    multisampling: number;
    n8ao: { enabled: boolean; quality: "performance" | "low" | "medium" | "high"; halfRes: boolean };
    bloom: { enabled: boolean; intensity: number; levels: number };
    outline: { enabled: boolean; resolutionScale: number; blur: boolean };
    smaa: "low" | "high" | false;
    vignette: boolean;
  };
  /** Physical (transmission) piece materials are High only — they cost a pass per frame. */
  allowTransmission: boolean;
  maxPixelRatioOnRegress: number;
}

export const QUALITY_TIERS: Record<ResolvedQualityTier, QualityConfig> = {
  low: {
    dpr: [1, 1.25],
    shadows: "basic", // BasicShadowMap: hard-edged. Softness comes from ContactShadows.
    softShadows: false,
    directionalShadowMapSize: 512,
    reflector: { enabled: false, resolution: 0 },
    contactShadows: { enabled: true, resolution: 256, frames: 1 },
    post: {
      composer: false,
      multisampling: 0,
      n8ao: { enabled: false, quality: "performance", halfRes: true },
      bloom: { enabled: false, intensity: 0, levels: 4 },
      outline: { enabled: false, resolutionScale: 0.5, blur: false },
      smaa: false,
      vignette: false,
    },
    allowTransmission: false,
    maxPixelRatioOnRegress: 0.6,
  },
  medium: {
    dpr: [1, 1.5],
    shadows: true, // -> "percentage" (PCFShadowMap); PCFSoft is gone in r185
    softShadows: false,
    directionalShadowMapSize: 1024,
    reflector: { enabled: true, resolution: 256 },
    contactShadows: { enabled: true, resolution: 512, frames: Infinity },
    post: {
      composer: false, // FR-31 spec: Medium = reflections + contact shadows, no post
      multisampling: 0,
      n8ao: { enabled: false, quality: "performance", halfRes: true },
      bloom: { enabled: false, intensity: 0.3, levels: 4 },
      outline: { enabled: false, resolutionScale: 0.5, blur: false },
      smaa: false,
      vignette: false,
    },
    allowTransmission: false,
    maxPixelRatioOnRegress: 0.75,
  },
  high: {
    dpr: [1, 2],
    shadows: "soft", // -> "percentage" (PCFShadowMap), same filter as Medium
    softShadows: true, // NOT APPLIED (see the field's doc comment) — High's extra
    // shadow quality is the 2048 map below plus live ContactShadows, not PCSS.
    directionalShadowMapSize: 2048,
    reflector: { enabled: true, resolution: 1024 },
    contactShadows: { enabled: true, resolution: 512, frames: Infinity },
    post: {
      composer: true,
      multisampling: 0, // MSAA does not mix with N8AO; SMAA instead (postprocessing.md §9)
      n8ao: { enabled: true, quality: "medium", halfRes: false },
      bloom: { enabled: true, intensity: 0.4, levels: 6 },
      outline: { enabled: true, resolutionScale: 1, blur: true },
      smaa: "high",
      vignette: true,
    },
    allowTransmission: true,
    maxPixelRatioOnRegress: 1,
  },
};

export interface AutoTierInput {
  hardwareConcurrency: number;
  devicePixelRatio: number;
  /** drei useDetectGPU().tier, 0..3. */
  gpuTier: number;
  isMobile: boolean;
}

/** FR-31 auto-select. Called once after mount (never during render — it reads
 *  browser globals and would break react-hooks/purity). */
export function autoQualityTier(input: AutoTierInput): ResolvedQualityTier {
  const { hardwareConcurrency, devicePixelRatio, gpuTier, isMobile } = input;
  if (gpuTier <= 1 || hardwareConcurrency <= 4) return "low";
  if (isMobile) return "medium";
  if (gpuTier >= 3 && hardwareConcurrency >= 8 && devicePixelRatio >= 2) return "high";
  return "medium";
}

export const TIER_ORDER: ResolvedQualityTier[] = ["low", "medium", "high"];

export function dropTier(tier: ResolvedQualityTier): ResolvedQualityTier {
  const i = TIER_ORDER.indexOf(tier);
  return TIER_ORDER[Math.max(0, i - 1)];
}
