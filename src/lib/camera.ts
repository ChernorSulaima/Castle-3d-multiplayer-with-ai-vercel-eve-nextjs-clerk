// src/lib/camera.ts
import type { CameraPresetId, Colour, ResolvedQualityTier } from "./types";

const DEG = Math.PI / 180;

export interface CameraPose {
  position: [number, number, number];
  target: [number, number, number];
}

/** "cinematic" is not a pose — it is the white pose plus idle auto-orbit. */
export const CAMERA_PRESETS: Record<Exclude<CameraPresetId, "cinematic">, CameraPose> = {
  white: { position: [0, 7.5, 9], target: [0, 0, 0] },
  black: { position: [0, 7.5, -9], target: [0, 0, 0] },
  // tiny z avoids the polar==0 singularity; still clamped by minPolarAngle
  top: { position: [0, 13, 0.001], target: [0, 0, 0] },
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

/* ------------------------------------------------------------ quality tiers */

export interface QualityConfig {
  dpr: [number, number]; // FR-32: never above 2
  /** <Canvas shadows> value. */
  shadows: false | true | "basic" | "soft";
  softShadows: boolean; // drei <SoftShadows/> (High only; global side effect)
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
    shadows: "basic",
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
    shadows: true, // PCFSoft
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
    shadows: "soft",
    softShadows: true,
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
