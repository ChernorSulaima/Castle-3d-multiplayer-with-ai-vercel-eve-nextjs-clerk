// src/lib/rooms.ts
// Adding a room = adding one entry here plus a 1k CC0 .hdr in public/hdri/.
// No scene code changes (FR-21n). HDRI provenance is in docs/research/assets.md §A2.
import type { RoomColors, RoomPresetId } from "./types";

export interface KeyLightConfig {
  position: [number, number, number];
  intensity: number;
  color: string;
}

export interface LightRig {
  key: KeyLightConfig;
  ambientIntensity: number;
  /** drei <Environment environmentIntensity> — scales IBL on PBR materials. */
  envIntensity: number;
  /** drei <Environment backgroundIntensity>. */
  bgIntensity: number;
  /** drei <Environment blur> (0..1). */
  backgroundBlur: number;
  /** Y rotation of the env map, radians. */
  envYaw: number;
}

export interface ReflectorConfig {
  /** [w, h] px of the off-screen buffer; [0,0] skips the blur pass. */
  blur: [number, number];
  mixBlur: number;
  mixStrength: number;
  mixContrast: number;
  mirror: number; // 0..1
  metalness: number;
  roughness: number;
  color: string;
}

export interface BoardMaterialPreset {
  lightSquare: string;
  darkSquare: string;
  squareMetalness: number;
  squareRoughness: number;
  frameColor: string;
  reflector: ReflectorConfig;
}

export interface PieceMaterial {
  color: string;
  metalness: number;
  roughness: number;
  clearcoat: number;
  clearcoatRoughness: number;
  /** > 0 switches the piece to <meshPhysicalMaterial transmission> (High tier only). */
  transmission?: number;
  thickness?: number;
  ior?: number;
  sheen?: number;
  envMapIntensity: number;
}

export interface PieceMaterialPreset {
  white: PieceMaterial;
  black: PieceMaterial;
}

export interface RoomFloor {
  kind: "none" | "grid" | "backdrop" | "ground";
  color?: string;
}

export interface RoomExtras {
  stars?: { radius: number; depth: number; count: number; factor: number; speed: number };
  sparkles?: { count: number; scale: number; size: number; speed: number; color: string };
}

export interface HighlightColours {
  select: string;
  legal: string;
  capture: string;
  last: string;
  check: string;
}

export interface RoomPreset {
  id: Exclude<RoomPresetId, "custom">;
  label: string;
  description: string;
  /** Public path; the file already exists. */
  hdri: string;
  /** 'hdri' shows the HDRI as the skybox; 'colour' paints a flat <color attach="background">. */
  background: "hdri" | "colour";
  backgroundColor?: string;
  lights: LightRig;
  board: BoardMaterialPreset;
  pieces: PieceMaterialPreset;
  floor: RoomFloor;
  extras: RoomExtras;
  highlight: HighlightColours;
}

const HIGHLIGHT_DEFAULT: HighlightColours = {
  select: "#ffd166",
  legal: "#5ee0a1",
  capture: "#ff9f43",
  last: "#ffd166",
  check: "#ff3b3b",
};

export const ROOMS: Record<Exclude<RoomPresetId, "custom">, RoomPreset> = {
  study: {
    id: "study",
    label: "Classic Study",
    description: "Warm lamplight, polished wood, a fire in the corner.",
    hdri: "/hdri/study.hdr", // polyhaven `fireplace`, CC0, Greg Zaal
    background: "hdri",
    lights: {
      key: { position: [4, 8, 5], intensity: 2.2, color: "#ffd9a8" },
      ambientIntensity: 0.15,
      envIntensity: 1.0,
      bgIntensity: 1.0,
      backgroundBlur: 0.25,
      envYaw: 0,
    },
    board: {
      lightSquare: "#e8d3ac",
      darkSquare: "#8b5a34",
      squareMetalness: 0.05,
      squareRoughness: 0.5,
      frameColor: "#4a2f1c",
      reflector: {
        blur: [300, 100], mixBlur: 1, mixStrength: 0.8, mixContrast: 1,
        mirror: 0.35, metalness: 0.1, roughness: 0.6, color: "#2a1a10",
      },
    },
    pieces: {
      white: { color: "#f0e2c8", metalness: 0.05, roughness: 0.45, clearcoat: 0.3, clearcoatRoughness: 0.3, envMapIntensity: 0.9 },
      black: { color: "#2b1b12", metalness: 0.05, roughness: 0.4, clearcoat: 0.4, clearcoatRoughness: 0.25, envMapIntensity: 0.9 },
    },
    floor: { kind: "none" },
    extras: {},
    highlight: HIGHLIGHT_DEFAULT,
  },

  space: {
    id: "space",
    label: "Space",
    description: "A board adrift under the Milky Way.",
    hdri: "/hdri/space.hdr", // polyhaven `qwantani_night_puresky`, CC0
    background: "hdri",
    lights: {
      key: { position: [-5, 9, -3], intensity: 1.6, color: "#bcd4ff" },
      ambientIntensity: 0.08,
      envIntensity: 0.6,
      bgIntensity: 0.7, // keep the horizon glow from reading as dawn (assets.md §A2)
      backgroundBlur: 0.0,
      envYaw: 0.6,
    },
    board: {
      lightSquare: "#c9d6ef",
      darkSquare: "#232a45",
      squareMetalness: 0.6,
      squareRoughness: 0.2,
      frameColor: "#0d1120",
      reflector: {
        blur: [120, 60], mixBlur: 0.8, mixStrength: 1.6, mixContrast: 1.2,
        mirror: 0.75, metalness: 0.8, roughness: 0.15, color: "#0a0e1c",
      },
    },
    pieces: {
      white: { color: "#dce7ff", metalness: 0.35, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 1.3 },
      black: { color: "#151a2e", metalness: 0.7, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.15, envMapIntensity: 1.3 },
    },
    floor: { kind: "none" },
    extras: { stars: { radius: 90, depth: 45, count: 4000, factor: 3.5, speed: 0.4 } },
    highlight: { ...HIGHLIGHT_DEFAULT, legal: "#5ad1ff", last: "#8f9bff" },
  },

  park: {
    id: "park",
    label: "Park",
    description: "A summer meadow, a table, and nothing to do but play.",
    hdri: "/hdri/park.hdr", // polyhaven `meadow_2`, CC0
    background: "hdri",
    lights: {
      key: { position: [6, 10, 4], intensity: 2.6, color: "#fff4e0" },
      ambientIntensity: 0.25,
      envIntensity: 1.0,
      bgIntensity: 1.0,
      backgroundBlur: 0.15,
      envYaw: -0.4,
    },
    board: {
      lightSquare: "#f2ead6",
      darkSquare: "#6f8f5c",
      squareMetalness: 0.02,
      squareRoughness: 0.7,
      frameColor: "#5a4632",
      reflector: {
        blur: [400, 140], mixBlur: 1.2, mixStrength: 0.5, mixContrast: 1,
        mirror: 0.2, metalness: 0.05, roughness: 0.75, color: "#3b3327",
      },
    },
    pieces: {
      white: { color: "#f6f1e4", metalness: 0.02, roughness: 0.55, clearcoat: 0.2, clearcoatRoughness: 0.4, envMapIntensity: 1.0 },
      black: { color: "#33322c", metalness: 0.02, roughness: 0.5, clearcoat: 0.25, clearcoatRoughness: 0.35, envMapIntensity: 1.0 },
    },
    floor: { kind: "ground" }, // drei <Environment ground> so the HDRI floor sits under the board
    extras: {},
    highlight: HIGHLIGHT_DEFAULT,
  },

  arcade: {
    id: "arcade",
    label: "Neon Arcade",
    description: "Black gloss, magenta and cyan, and a bass line you can feel.",
    hdri: "/hdri/arcade.hdr", // polyhaven `wooden_studio_10`, CC0
    background: "hdri",
    lights: {
      key: { position: [-4, 7, 4], intensity: 1.8, color: "#ff6ad5" },
      ambientIntensity: 0.1,
      envIntensity: 1.2,
      bgIntensity: 1.0,
      backgroundBlur: 0.3,
      envYaw: 1.2,
    },
    board: {
      lightSquare: "#dfe9ff",
      darkSquare: "#191326",
      squareMetalness: 0.75,
      squareRoughness: 0.14,
      frameColor: "#0b0810",
      reflector: {
        blur: [80, 40], mixBlur: 0.6, mixStrength: 2, mixContrast: 1.3,
        mirror: 0.85, metalness: 0.8, roughness: 0.12, color: "#08060d",
      },
    },
    pieces: {
      white: { color: "#f2f7ff", metalness: 0.5, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.5 },
      black: { color: "#120d1c", metalness: 0.85, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.5 },
    },
    floor: { kind: "none" },
    extras: { sparkles: { count: 40, scale: 12, size: 2, speed: 0.3, color: "#7cf7ff" } },
    highlight: { select: "#ff6ad5", legal: "#7cf7ff", capture: "#ffb347", last: "#ff6ad5", check: "#ff2d55" },
  },

  minimal: {
    id: "minimal",
    label: "Minimal White",
    description: "A clean studio. Nothing but the game.",
    hdri: "/hdri/minimal.hdr", // polyhaven `white_studio_06`, CC0
    background: "hdri",
    lights: {
      key: { position: [3, 9, 3], intensity: 1.4, color: "#ffffff" },
      ambientIntensity: 0.4,
      envIntensity: 1.0,
      bgIntensity: 1.0,
      backgroundBlur: 0.4,
      envYaw: 0,
    },
    board: {
      lightSquare: "#ffffff",
      darkSquare: "#b9bec7",
      squareMetalness: 0.0,
      squareRoughness: 0.35,
      frameColor: "#e6e8ec",
      reflector: {
        blur: [200, 80], mixBlur: 1, mixStrength: 0.55, mixContrast: 1,
        mirror: 0.3, metalness: 0.05, roughness: 0.4, color: "#eceef2",
      },
    },
    pieces: {
      white: { color: "#fbfbfd", metalness: 0.0, roughness: 0.3, clearcoat: 0.5, clearcoatRoughness: 0.2, sheen: 0.2, envMapIntensity: 1.0 },
      black: { color: "#2a2d33", metalness: 0.0, roughness: 0.3, clearcoat: 0.5, clearcoatRoughness: 0.2, envMapIntensity: 1.0 },
    },
    floor: { kind: "backdrop", color: "#f4f5f7" },
    extras: {},
    highlight: { ...HIGHLIGHT_DEFAULT, legal: "#3ec98a", last: "#f2c14e" },
  },
};

export const ROOM_ORDER: Exclude<RoomPresetId, "custom">[] = [
  "study", "space", "park", "arcade", "minimal",
];
export const DEFAULT_ROOM: RoomPresetId = "study";
/** For useEnvironment.preload() when the settings drawer opens (FR-21m). */
export const HDRI_FILES = ROOM_ORDER.map((id) => ROOMS[id].hdri);

export const DEFAULT_ROOM_COLORS: RoomColors = {
  background: "#0f1115",
  lightSquare: "#e8d3ac",
  darkSquare: "#8b5a34",
};

/** Resolve the preset a player should actually see. "custom" = Minimal White's
 *  rig with the player's three colours and a flat background (FR-21j). */
export function resolveRoom(preset: RoomPresetId, colors: RoomColors | null): RoomPreset {
  if (preset !== "custom") return ROOMS[preset];
  const base = ROOMS.minimal;
  const c = colors ?? DEFAULT_ROOM_COLORS;
  return {
    ...base,
    id: "minimal",
    label: "Custom",
    description: "Your own colours.",
    background: "colour",
    backgroundColor: c.background,
    board: {
      ...base.board,
      lightSquare: c.lightSquare,
      darkSquare: c.darkSquare,
      reflector: { ...base.board.reflector, color: c.darkSquare },
    },
  };
}
