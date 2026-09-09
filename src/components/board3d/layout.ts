// src/components/board3d/layout.ts
// Vertical stacking and off-board geometry for the 3D scene. Everything here is
// expressed in board-square units (1 square = 1 world unit, board centred on the
// origin, +Y up, white seated at +Z) exactly as `src/lib/constants.ts` defines.
import { BOARD_EXTENT, CAPTURE_TRAY_X, PIECE_HEIGHTS, type PieceMeshName } from "@/lib/constants";
import type { Colour } from "@/lib/types";

/** Top face of the plinth — the reflective surface the tiles sit on. */
export const PLINTH_TOP_Y = 0;
export const PLINTH_HEIGHT = 0.22;
/** Thin tiles sit on the plinth; their top face is where pieces stand. */
export const SQUARE_THICKNESS = 0.06;
export const SQUARE_TOP_Y = PLINTH_TOP_Y + SQUARE_THICKNESS;
export const PIECE_Y = SQUARE_TOP_Y;
/** Emissive overlays float just above the tiles so they never z-fight. */
export const HIGHLIGHT_Y = SQUARE_TOP_Y + 0.004;
export const COORD_Y = SQUARE_TOP_Y + 0.003;
export const CONTACT_SHADOW_Y = SQUARE_TOP_Y + 0.008;

/** Reflective rim left visible around the 8x8 playing area. */
export const FRAME_WIDTH = 0.55;
export const BOARD_SIZE = BOARD_EXTENT; // 8 units across
export const PLINTH_SIZE = BOARD_SIZE + FRAME_WIDTH * 2;

/** Squares are drawn slightly inset so the tile grid reads as separate tiles. */
export const TILE_SIZE = 0.98;
/** Overlay disc/ring radii (base diameter of a piece is ~0.49 units). */
export const LEGAL_DOT_RADIUS = 0.16;
export const CAPTURE_RING_INNER = 0.36;
export const CAPTURE_RING_OUTER = 0.47;

/** Captured pieces are shown small so a full tray never crowds the board. */
export const TRAY_PIECE_SCALE = 0.55;
export const TRAY_COLUMN_GAP = 0.62;
export const TRAY_ROW_GAP = 0.62;
export const TRAY_FIRST_ROW_Z = -2.35;

/**
 * Where captured pieces belonging to `capturer` are stacked. `capturer` is the
 * colour that made the capture (matching `CapturedPieces`' keys), so white's
 * trophies sit on white's right-hand side at +X.
 */
export function trayDirection(capturer: Colour): 1 | -1 {
  return capturer === "w" ? 1 : -1;
}

/** World position of the `index`-th tray slot on `capturer`'s side. */
export function traySlot(capturer: Colour, index: number): [number, number, number] {
  const dir = trayDirection(capturer);
  const column = index % 2;
  const row = Math.floor(index / 2);
  return [
    dir * (CAPTURE_TRAY_X + column * TRAY_COLUMN_GAP),
    PIECE_Y,
    TRAY_FIRST_ROW_Z + row * TRAY_ROW_GAP,
  ];
}

/** Half-height of a piece — used to aim the capture flight arc at its middle. */
export function pieceHalfHeight(mesh: PieceMeshName): number {
  return PIECE_HEIGHTS[mesh] / 2;
}

export function easeInOutCubic(k: number): number {
  return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
}

/** Exponential-decay rate that settles a slide in roughly `MOVE_ANIMATION_MS`. */
export const MOVE_DAMP_LAMBDA = 16;
export const LIFT_DAMP_LAMBDA = 12;
/** How high a piece rides while it is travelling between squares. */
export const TRAVEL_LIFT_Y = 0.18;
