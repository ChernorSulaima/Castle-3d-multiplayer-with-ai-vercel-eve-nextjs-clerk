// src/lib/mock/scenarios.ts  [U2]
// The §8 verification scenarios, as pure data.
//
// Deliberately free of React, zustand and chess.js *state*: the harness hook
// (`game-controller.ts`) and the vitest fixture check both import from here, and
// the test must be able to replay every scenario in a bare node environment.
import { replay } from "@/lib/chess";
import type { LayoutMode } from "@/lib/stores/ui-store";
import type {
  AiPhase,
  Colour,
  Difficulty,
  EndReason,
  EngineStatus,
  GameMode,
  GameStatus,
  HintResult,
  PlayerId,
  PlayerSummary,
  ViewerRole,
  Winner,
} from "@/lib/types";

/* ------------------------------------------------------------- scenarios */

export const MOCK_SCENARIO_IDS = [
  "ai-midgame",
  "ai-hint",
  "online-draw-offer",
  "local-flip",
  "review",
  "finished",
  "fullscreen",
] as const;

export type MockScenarioId = (typeof MOCK_SCENARIO_IDS)[number];

export interface MockCommentaryRow {
  ply: number;
  text: string;
  source: "eve" | "fallback" | "hint";
  persona?: string;
}

export interface MockScenario {
  id: MockScenarioId;
  label: string;
  summary: string;
  mode: GameMode;
  viewerRole: ViewerRole;
  difficulty?: Difficulty;
  aiColor?: Colour;
  /** SAN, oldest first. Validated by `src/lib/mock/__tests__/game-controller.test.ts`. */
  moves: string[];
  status: GameStatus;
  winner?: Winner;
  endReason?: EndReason;
  drawOffer?: Colour;
  rated: boolean;
  hintsUsed: number;
  undoCount: number;
  spectatorCount: number;
  /** Ply the shell opens on; null starts live. */
  reviewPly: number | null;
  layoutMode: LayoutMode;
  /** True on mount for the local hand-over overlay. */
  flipping: boolean;
  whiteName: string;
  blackName: string;
  white: PlayerSummary | null;
  black: PlayerSummary | null;
  commentary: MockCommentaryRow[];
  ai: {
    phase: AiPhase;
    engineStatus: EngineStatus;
    downloadPercent: number;
    hint: HintResult | null;
  };
  /** The viewer's rating change, for the finished scenario. */
  rating: { delta: number; after: number } | null;
}

const ITALIAN = [
  "e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "c3", "Nf6",
  "d4", "exd4", "cxd4", "Bb4+", "Nc3",
];

const SCHOLARS = ["e4", "e5", "Bc4", "Nc6", "Qh5", "Nf6", "Qxf7#"];

function player(id: string, username: string, rating: number): PlayerSummary {
  return {
    _id: id as PlayerId,
    username,
    avatarUrl: "",
    rating,
  };
}

const HUMAN = player("mock_player_human", "quinn", 1284);
const RIVAL = player("mock_player_rival", "adrienne", 1311);

const BASE: Omit<MockScenario, "id" | "label" | "summary"> = {
  mode: "ai",
  viewerRole: "white",
  difficulty: "beginner",
  aiColor: "b",
  moves: ITALIAN,
  status: "active",
  rated: true,
  hintsUsed: 1,
  undoCount: 0,
  spectatorCount: 0,
  reviewPly: null,
  layoutMode: "default",
  flipping: false,
  whiteName: "quinn",
  blackName: "Pip",
  white: HUMAN,
  black: null,
  commentary: [],
  ai: { phase: "idle", engineStatus: "ready", downloadPercent: 100, hint: null },
  rating: null,
};

const AI_COMMENTARY: MockCommentaryRow[] = [
  { ply: 4, text: "Knights before bishops — that is what my club captain says, anyway.", source: "eve", persona: "pip" },
  { ply: 8, text: "You have the centre. I am going to poke at it and see what falls over.", source: "eve", persona: "pip" },
  { ply: 12, text: "Check — not a scary one, but I had to try it before you castled.", source: "eve", persona: "pip" },
];

export const MOCK_SCENARIOS: Record<MockScenarioId, MockScenario> = {
  "ai-midgame": {
    ...BASE,
    id: "ai-midgame",
    label: "AI · mid-game",
    summary: "13 plies, three commentary rows, Pip thinking.",
    commentary: AI_COMMENTARY,
    ai: { phase: "agent", engineStatus: "ready", downloadPercent: 100, hint: null },
  },
  "ai-hint": {
    ...BASE,
    id: "ai-hint",
    label: "AI · hint",
    summary: "A hint has come back and is tagged in the chat.",
    hintsUsed: 2,
    commentary: AI_COMMENTARY,
    ai: {
      phase: "idle",
      engineStatus: "ready",
      downloadPercent: 100,
      hint: {
        san: "O-O",
        text: "Castle. Your king is still in the middle and the d-file is about to open.",
        source: "eve",
      },
    },
  },
  "online-draw-offer": {
    ...BASE,
    id: "online-draw-offer",
    label: "Online · draw offered",
    summary: "A rated online game with an offer standing from Black.",
    mode: "online",
    viewerRole: "white",
    difficulty: undefined,
    aiColor: undefined,
    blackName: "adrienne",
    black: RIVAL,
    drawOffer: "b",
    hintsUsed: 0,
    commentary: [],
  },
  "local-flip": {
    ...BASE,
    id: "local-flip",
    label: "Local · hand-over",
    summary: "Pass-and-play with the hand-over overlay showing.",
    mode: "local",
    viewerRole: "local",
    difficulty: undefined,
    aiColor: undefined,
    blackName: "Player 2",
    rated: false,
    hintsUsed: 0,
    flipping: true,
    commentary: [],
  },
  review: {
    ...BASE,
    id: "review",
    label: "Reviewing move 8",
    summary: "Live game with the board rewound to ply 8.",
    reviewPly: 8,
    commentary: AI_COMMENTARY,
  },
  finished: {
    ...BASE,
    id: "finished",
    label: "Finished · result dialog",
    summary: "Checkmate, rating delta and the result dialog open.",
    moves: SCHOLARS,
    status: "checkmate",
    winner: "w",
    endReason: "checkmate",
    hintsUsed: 3,
    undoCount: 1,
    commentary: [
      { ply: 2, text: "Same as last time then. Fine by me.", source: "eve", persona: "pip" },
      { ply: 6, text: "Oh. Oh no. I have seen this one before.", source: "eve", persona: "pip" },
    ],
    rating: { delta: 12, after: 1296 },
  },
  fullscreen: {
    ...BASE,
    id: "fullscreen",
    label: "Focus layout",
    summary: "The §5.2 board-focus layout with its floating HUD.",
    layoutMode: "focus",
    commentary: AI_COMMENTARY,
  },
};

export function isMockScenarioId(value: string | null): value is MockScenarioId {
  return value !== null && (MOCK_SCENARIO_IDS as readonly string[]).includes(value);
}

/* ------------------------------------------------------------ pure replay */

export interface MockPosition {
  fen: string;
  turn: Colour;
  moves: string[];
  isCheckmate: boolean;
  isDraw: boolean;
}

/**
 * Replays a scenario's SAN list. Throws on an illegal move — which is exactly
 * what `game-controller.test.ts` relies on to keep the fixtures honest.
 */
export function mockPosition(moves: string[]): MockPosition {
  const chess = replay(moves);
  return {
    fen: chess.fen(),
    turn: chess.turn(),
    moves: chess.history(),
    isCheckmate: chess.isCheckmate(),
    isDraw: chess.isDraw(),
  };
}
