// src/lib/rooms.ts
// Adding a room = adding one entry here plus a 1k CC0 .hdr in public/hdri/.
// No scene code changes (FR-21n). HDRI provenance is in docs/research/assets.md §A2.
import type { OrbitSweep } from "./camera";
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

/**
 * The furniture the board stands on. Its top face is `TABLE_TOP_Y` — exactly the plinth's
 * underside — in every room, so a table is never allowed to move a square.
 */
export interface TableFinish {
  /**
   * The material, and with it the whole read of the piece: turned walnut in the study,
   * black acrylic in the arcade, brushed metal in space. `"none"` leaves the board
   * standing on its own plinth, as it always did.
   */
  kind: "wood" | "gloss" | "metal" | "lacquer" | "none";
  color: string;
  /** A band around the edge of the top: brass inlay, or the arcade's neon strip. */
  edgeColor?: string;
  /** Emissive strength of that band. Absent or 0 = an inlay, not a light. */
  emissive?: number;
  /**
   * What holds the top up.
   *
   * `"legs"` is four turned legs on an apron. `"pedestal"` is one column, for a board
   * adrift where four legs would only argue with the stars. `"none"` is the top and its
   * apron alone, and it exists for the Park: drei's `<Environment ground>` projects that
   * room's meadow onto a disk at world y = 0 — the height of the board itself — so a leg
   * there would be drawn standing in the middle of the grass rather than on it.
   */
  base: "legs" | "pedestal" | "none";
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
  /**
   * The SKYBOX, when the room has one: Poly Haven's tonemapped equirectangular JPG of
   * the same shot, downscaled (see docs/research/assets.md §A2b). The 1k `.hdr` above is
   * a light probe — 1024x512 of HDR data, ample for irradiance and far too coarse to
   * look at, which is why the background used to be blurred on purpose. This is what the
   * visitor actually sees; the .hdr keeps lighting and reflecting everything.
   */
  backdrop?: string;
  /** 'hdri' shows the HDRI as the skybox; 'colour' paints a flat <color attach="background">. */
  background: "hdri" | "colour";
  backgroundColor?: string;
  lights: LightRig;
  board: BoardMaterialPreset;
  pieces: PieceMaterialPreset;
  floor: RoomFloor;
  /** The table under the board. */
  table: TableFinish;
  /**
   * The arc the idle cinematic camera sweeps in this room (FR-24), centred on the side
   * of the panorama that is worth looking at. Omit it and the room gets
   * `DEFAULT_ORBIT_SWEEP` — 55 deg either side of the white seat, which is the right
   * answer for any room whose `envYaw` already put its best wall in front of that seat.
   *
   * `centerAzimuth` is a camera azimuth, not a panorama yaw: 0 is the white seat, and a
   * positive value turns the camera anticlockwise seen from above, which walks the view
   * BACKWARD through the panorama's u (see `OrbitSweep`). Provenance for every value is
   * in docs/research/assets.md §A2d.
   */
  orbit?: OrbitSweep;
  extras: RoomExtras;
  highlight: HighlightColours;
  /**
   * The room's light, as ONE colour the app frame can paint behind the canvas so the page
   * around the board belongs to the same room. Taken from the key light, because that is
   * what the visitor sees spilling off the board. Consumed outside the 3D scene: nothing
   * in board3d/ reads it.
   */
  glow: string;
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
    // No fire: `combination_room` has none, and a room card that promises one would be
    // the only untrue line in this file. What it does have is the rest of the sentence.
    description: "Warm lamplight, polished parquet, and a settee nobody sits on.",
    hdri: "/hdri/study.hdr", // polyhaven `combination_room`, CC0, Sergej Majboroda
    backdrop: "/backdrops/study.jpg",
    background: "hdri",
    lights: {
      // `combination_room` is a DAYLIT room, where `fireplace` was a night one, so the
      // panorama arrives brighter and cooler than the room card promises. The key goes up
      // and warm, the env and the background come down: what the visitor sees is a gold
      // room at the wrong end of the afternoon rather than a photograph at noon.
      key: { position: [4, 8, 5], intensity: 2.4, color: "#ffd9a8" },
      ambientIntensity: 0.11,
      envIntensity: 0.72,
      bgIntensity: 0.8,
      backgroundBlur: 0.25,
      /**
       * 4.05 rad seats both players in the good two-thirds of the room.
       *
       * A seat camera sits at y 7.5 and sees a band 20-60 deg BELOW the panorama's
       * horizon — the lower wall and the floor, and nothing else (assets.md §A2c). In
       * `combination_room` that band is an inlaid parquet floor the whole way round,
       * with a buttoned settee, a gilt armchair and a marble side table standing on it —
       * and, for about 1.4 rad of it (u ~ 0.49-0.76, yaw 1.5-3.2), a bay window blown
       * to white. The two seats are half a turn apart, so the yaw has to keep BOTH out
       * of that window: only yaw 3.15-4.89 does. 4.05 is the middle of it, and it hands
       * white the armchair, the marble table and the parquet, and black the gold damask
       * wall with the settee under it.
       */
      envYaw: 4.05,
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
    // Walnut with a thin brass inlay round the edge — the study's own two materials.
    table: { kind: "wood", color: "#3c2718", edgeColor: "#c9a24a", base: "legs" },
    /**
     * -0.85 rad: the hero swings between the settee and the gilt armchair, and the bay
     * window is 1.5 rad outside the far end of the arc.
     *
     * The white seat is the middle of what the ROOM will allow (see `envYaw`), not the
     * middle of what is worth looking at; the idle camera is free of that constraint and
     * takes the better half. At the -1.80 rad end it faces yaw 5.85 — the settee, seen
     * across the darkest, warmest stretch of the parquet — and at the +0.10 rad end it
     * is all but back in the white seat, so the view a player will sit in is still in
     * the sweep. See docs/research/assets.md §A2d.
     */
    orbit: { centerAzimuth: -0.85, halfArc: 0.95 },
    extras: {},
    highlight: HIGHLIGHT_DEFAULT,
    glow: "#ffd9a8",
  },

  space: {
    id: "space",
    label: "Space",
    description: "A board adrift under the Milky Way.",
    hdri: "/hdri/space.hdr", // polyhaven `qwantani_night_puresky`, CC0 — IBL only
    // The 1k night HDRI has a grey horizon glow that reads as overcast from the seat
    // camera, so the skybox is a near-black colour and the `extras.stars` layer supplies
    // the starfield; the HDRI still lights and reflects in the pieces (FR-21i "Space").
    background: "colour",
    backgroundColor: "#04060d",
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
    // One brushed pedestal, not four legs: adrift, the board should look moored rather
    // than furnished, and a table's worth of legs would fight the starfield behind it.
    table: { kind: "metal", color: "#2b3243", edgeColor: "#8fa6d8", base: "pedestal" },
    // Nothing to face: the background is a flat colour and a procedural starfield, so
    // every azimuth is the same azimuth. Symmetric about the white seat.
    orbit: { centerAzimuth: 0, halfArc: 0.95 },
    extras: { stars: { radius: 90, depth: 45, count: 4000, factor: 3.5, speed: 0.4 } },
    highlight: { ...HIGHLIGHT_DEFAULT, legal: "#5ad1ff", last: "#8f9bff" },
    glow: "#bcd4ff",
  },

  park: {
    id: "park",
    label: "Park",
    description: "A summer meadow, a table, and nothing to do but play.",
    hdri: "/hdri/park.hdr", // polyhaven `meadow_2`, CC0
    backdrop: "/backdrops/park.jpg",
    background: "hdri",
    lights: {
      key: { position: [6, 10, 4], intensity: 2.6, color: "#fff4e0" },
      ambientIntensity: 0.25,
      envIntensity: 1.0,
      bgIntensity: 1.0,
      backgroundBlur: 0.15,
      // Re-checked at 4 yaws (assets.md §A2c): `meadow_2` is grass and trees the whole
      // way round and `floor: ground` projects the meadow under the board, so the seat
      // view barely changes. -0.4 keeps the mown path — and not one of the bald patches
      // at u ~ 0.6 / 0.75 — behind the board. Unchanged.
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
    // Weathered oak, and no legs: this room's ground is projected at y = 0, which is the
    // height of the board itself, so a leg would stand in mid-air over the grass (see
    // `TableFinish.base`). A thick garden slab is the honest reading of that geometry.
    table: { kind: "wood", color: "#8b7350", base: "none" },
    // `meadow_2` is grass and trees the whole way round and `floor: ground` projects the
    // meadow under the board, so the sweep barely changes what is behind it — verified at
    // 5 samples across a full swing. Symmetric about the white seat.
    orbit: { centerAzimuth: 0, halfArc: 0.95 },
    extras: {},
    highlight: HIGHLIGHT_DEFAULT,
    glow: "#fff4e0",
  },

  arcade: {
    id: "arcade",
    label: "Neon Arcade",
    description: "Black gloss, magenta and cyan, and a bass line you can feel.",
    hdri: "/hdri/arcade.hdr", // polyhaven `ferndale_studio_06`, CC0
    backdrop: "/backdrops/arcade.jpg",
    background: "hdri",
    lights: {
      /**
       * The one room whose key light is NOT its dominant colour. The panorama is
       * magenta from wall to wall, so a magenta key on top of it left every piece the
       * same pink and the white army stopped reading as white. The room's own cyan —
       * the same token the sparkles and the legal-move highlight use — comes in from
       * the other side instead, and the two of them are the "magenta and cyan" the
       * room card promises. `glow` below stays magenta: that is what the page sees.
       */
      key: { position: [-4, 7, 4], intensity: 1.7, color: "#7cf7ff" },
      ambientIntensity: 0.1,
      envIntensity: 0.9,
      bgIntensity: 0.85,
      backgroundBlur: 0.3,
      /**
       * 2.83 rad faces the white seat at the wash just right of the studio's big
       * magenta globe lamp: a clean gradient from a hot centre to black in the corners,
       * with the lamp itself, its stand, the floor cable and the bench all outside the
       * frame. See docs/research/assets.md §A2c.
       */
      envYaw: 2.83,
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
    // Black acrylic with the room's own magenta running round the edge, lit.
    table: { kind: "gloss", color: "#0b0810", edgeColor: "#ff6ad5", emissive: 1.6, base: "legs" },
    /**
     * Symmetric, because `envYaw` already did this job: 2.83 was chosen as the middle of
     * `ferndale_studio_06`'s ~140 deg of clean gradient, and a 110 deg sweep centred on
     * the white seat fits inside it with 15 deg to spare either side.
     *
     * Shifting it was tried and is worse both ways (assets.md §A2d): -1.2 rad brings the
     * spider of floor cables over the doorway into three frames of five, and +1.2 rad
     * reaches the quadrant with the practical lamp in it, where the board's metalness-0.75
     * squares blow to white.
     */
    orbit: { centerAzimuth: 0, halfArc: 0.95 },
    extras: { sparkles: { count: 40, scale: 12, size: 2, speed: 0.3, color: "#7cf7ff" } },
    highlight: { select: "#ff6ad5", legal: "#7cf7ff", capture: "#ffb347", last: "#ff6ad5", check: "#ff2d55" },
    // Not the key light (see `lights.key`): the ENVIRONMENT is magenta here, and the
    // magenta is what spills off the board and onto the page.
    glow: "#ff6ad5",
  },

  minimal: {
    id: "minimal",
    label: "Minimal White",
    description: "A clean studio. Nothing but the game.",
    hdri: "/hdri/minimal.hdr", // polyhaven `white_studio_06`, CC0
    backdrop: "/backdrops/minimal.jpg",
    background: "hdri",
    lights: {
      key: { position: [3, 9, 3], intensity: 1.4, color: "#ffffff" },
      ambientIntensity: 0.4,
      envIntensity: 1.0,
      bgIntensity: 1.0,
      backgroundBlur: 0.4,
      // Re-checked at 4 yaws (assets.md §A2c). `white_studio_06` really is a working
      // photo studio — beauty dish, stands, cables, a black curtain — but this is the
      // one room with `floor: backdrop`, and drei's `<Backdrop>` cyclorama fills the
      // seat frame edge to edge, so none of that is ever on screen and the yaw makes no
      // visible difference. Left at 0.
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
    // White lacquer on white lacquer; the only edge is the shadow under the top.
    table: { kind: "lacquer", color: "#eceef2", base: "legs" },
    // Symmetric for the same reason the yaw is 0: drei's `<Backdrop>` cyclorama fills the
    // frame at every azimuth of the sweep (verified at 5 samples), so the studio behind it
    // is never on screen and there is nothing to aim at.
    orbit: { centerAzimuth: 0, halfArc: 0.95 },
    extras: {},
    highlight: { ...HIGHLIGHT_DEFAULT, legal: "#3ec98a", last: "#f2c14e" },
    // Not pure white: a warm one, so a page tinted with it reads as a lit studio.
    glow: "#fff6e8",
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

/** `#rrggbb` -> [r, g, b]; anything unparseable comes back mid-grey rather than throwing. */
function readHex(hex: string): [number, number, number] {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return [128, 128, 128];
  const value = Number.parseInt(match[1], 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function mixHex(from: string, to: string, amount: number): string {
  const a = readHex(from);
  const b = readHex(to);
  const channel = (i: number) => Math.round(a[i] + (b[i] - a[i]) * amount);
  return `#${[0, 1, 2].map((i) => channel(i).toString(16).padStart(2, "0")).join("")}`;
}

/**
 * A page glow for a room the player mixed themselves. Their LIGHT square is the closest
 * thing a custom room has to a key light, so that is the base; it is then taken a third
 * of the way toward their own background so a dark room gets a dim halo and a bright one
 * gets a bright one, instead of every custom room glowing the same.
 */
function deriveGlow(colors: RoomColors): string {
  return mixHex(colors.lightSquare, colors.background, 0.35);
}

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
    // A flat colour is the background here, so the sharp skybox has nothing to do; the
    // white-lacquer table and the studio floor come along from Minimal unchanged.
    backdrop: undefined,
    board: {
      ...base.board,
      lightSquare: c.lightSquare,
      darkSquare: c.darkSquare,
      reflector: { ...base.board.reflector, color: c.darkSquare },
    },
    glow: deriveGlow(c),
  };
}
