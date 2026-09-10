// @vitest-environment node
// The table is pure addition: it may not move a square and it may not reach the
// reflective playing surface. Both are one arithmetic assertion each, and both are the
// kind of thing a later tweak to a thickness would break silently.
import { describe, expect, it } from "vitest";

import {
  BOARD_SURFACE_Y,
  PLINTH_HEIGHT,
  PLINTH_SIZE,
  PLINTH_TOP_Y,
  SQUARE_TOP_Y,
  TABLE_APRON_HEIGHT,
  TABLE_APRON_INSET,
  TABLE_FOOT_Y,
  TABLE_LEG_INSET,
  TABLE_LEG_RADIUS,
  TABLE_SIZE,
  TABLE_THICKNESS,
  TABLE_TOP_Y,
} from "../layout";

/** Radii of the turned-leg lathe profile in table.tsx, before TABLE_LEG_RADIUS. */
const LEG_MAX_PROFILE_RADIUS = 0.185;

describe("table geometry", () => {
  it("puts its top face exactly where the plinth's underside already was", () => {
    expect(TABLE_TOP_Y).toBe(PLINTH_TOP_Y - PLINTH_HEIGHT);
    // ...which is the whole point: the squares have not moved.
    expect(SQUARE_TOP_Y).toBeGreaterThan(TABLE_TOP_Y);
  });

  it("never reaches the reflector", () => {
    expect(TABLE_TOP_Y).toBeLessThan(BOARD_SURFACE_Y);
    expect(BOARD_SURFACE_Y - TABLE_TOP_Y).toBeGreaterThan(0.2);
  });

  it("is wider than the plinth, and hangs together top to foot", () => {
    expect(TABLE_SIZE).toBeGreaterThan(PLINTH_SIZE);
    const apronTop = TABLE_TOP_Y - TABLE_THICKNESS;
    const apronBottom = apronTop - TABLE_APRON_HEIGHT;
    expect(apronBottom).toBeGreaterThan(TABLE_FOOT_Y);
    // The legs have a real length to fill rather than a sliver.
    expect(apronBottom - TABLE_FOOT_Y).toBeGreaterThan(1);
  });

  it("stands its legs inside the apron they are joined to", () => {
    const apronHalf = TABLE_SIZE / 2 - TABLE_APRON_INSET;
    const legHalf = LEG_MAX_PROFILE_RADIUS * TABLE_LEG_RADIUS;
    expect(TABLE_LEG_INSET + legHalf).toBeLessThanOrEqual(apronHalf + 1e-9);
    // ...and outside the board they hold up, so a leg is never seen through the squares.
    expect(TABLE_LEG_INSET - legHalf).toBeGreaterThan(PLINTH_SIZE / 2 - 1);
  });
});
