// @vitest-environment node
// src/lib/mock/__tests__/game-controller.test.ts  [U2]
// The /dev/game harness is only useful if its fixtures are real chess. Every §8
// scenario is replayed through chess.js here, so a typo in a SAN list fails the
// suite instead of blanking the harness board.
import { describe, expect, it } from "vitest";
import {
  MOCK_SCENARIOS,
  MOCK_SCENARIO_IDS,
  isMockScenarioId,
  mockPosition,
} from "../scenarios";

describe("mock scenarios", () => {
  it("covers every scenario UI_REDESIGN §8 asks for", () => {
    expect([...MOCK_SCENARIO_IDS]).toEqual([
      "ai-midgame",
      "ai-hint",
      "online-draw-offer",
      "local-flip",
      "review",
      "finished",
      "fullscreen",
    ]);
  });

  it.each(MOCK_SCENARIO_IDS)("%s replays as a legal game", (id) => {
    const scenario = MOCK_SCENARIOS[id];
    const position = mockPosition(scenario.moves);
    // chess.js re-emits the SAN it accepted; a mismatch means the fixture was
    // written in a spelling chess.js does not produce.
    expect(position.moves).toEqual(scenario.moves);
    expect(position.fen.split(" ")[1]).toBe(position.turn);
    // Side to move alternates from white, so the ply count fixes the turn.
    expect(position.turn).toBe(scenario.moves.length % 2 === 0 ? "w" : "b");
  });

  it("only marks a scenario finished when the position really is", () => {
    for (const id of MOCK_SCENARIO_IDS) {
      const scenario = MOCK_SCENARIOS[id];
      const position = mockPosition(scenario.moves);
      if (scenario.status === "checkmate") {
        expect(position.isCheckmate, `${id} is not mate`).toBe(true);
      } else if (scenario.status === "active") {
        expect(position.isCheckmate, `${id} is mate but marked active`).toBe(false);
        expect(position.isDraw, `${id} is drawn but marked active`).toBe(false);
      }
    }
  });

  it("opens each scenario on a ply the game actually has", () => {
    for (const id of MOCK_SCENARIO_IDS) {
      const { reviewPly, moves } = MOCK_SCENARIOS[id];
      if (reviewPly === null) continue;
      expect(reviewPly).toBeGreaterThanOrEqual(0);
      expect(reviewPly).toBeLessThan(moves.length);
    }
  });

  it("only ever files commentary against a move that was played", () => {
    for (const id of MOCK_SCENARIO_IDS) {
      const { commentary, moves } = MOCK_SCENARIOS[id];
      for (const row of commentary) {
        expect(row.ply, `${id} commentary ply`).toBeGreaterThan(0);
        expect(row.ply, `${id} commentary ply`).toBeLessThanOrEqual(moves.length);
      }
    }
  });

  it("recognises its own ids and nothing else", () => {
    expect(isMockScenarioId("ai-midgame")).toBe(true);
    expect(isMockScenarioId("nope")).toBe(false);
    expect(isMockScenarioId(null)).toBe(false);
  });
});
