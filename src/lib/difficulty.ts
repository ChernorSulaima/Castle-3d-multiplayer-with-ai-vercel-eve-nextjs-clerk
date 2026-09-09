// src/lib/difficulty.ts
import type { Difficulty } from "./types";

export interface Persona {
  key: string;
  name: string;
  blurb: string;
}

export interface DifficultyConfig {
  id: Difficulty;
  label: string;
  description: string;
  /** UCI `go depth`. */
  depth: number;
  /** UCI `MultiPV` for the candidate list handed to the agent. */
  multiPv: number;
  /** Hard `stop` timeout for the search; bestmove arrives ~50 ms later. */
  searchTimeoutMs: number;
  /**
   * PRD §3.8's selection policy, word for word, in both places it is applied:
   * pushed to the agent as `clientContext.selectionPolicy` (the primary chooser)
   * and implemented in `selectCandidate` (the fallback). The two MUST agree —
   * `difficulty.test.ts` asserts each string is also the matching row of
   * `agent/instructions.md`, so edit all three together.
   *
   * There is no engine-side handicap: candidate generation always runs at Skill
   * Level 20 (stockfish.md §6 — below 20 Stockfish randomises `bestmove` and
   * forces internal MultiPV >= 4, so the ranking would not match the move it
   * plays). PRD §3.8's "Stockfish Skill Level" column is therefore deliberately
   * unimplemented; depth alone shapes how far ahead the candidates look.
   */
  selectionPolicy: string;
  persona: Persona;
  /** Fixed Elo used when rating an AI game (FR-49). */
  aiRating: number;
  hintsAllowed: boolean;
}

export const DIFFICULTIES: Record<Difficulty, DifficultyConfig> = {
  beginner: {
    id: "beginner",
    label: "Beginner",
    description: "Learning the ropes. Explains what you could have done better.",
    depth: 2, multiPv: 5, searchTimeoutMs: 800,
    selectionPolicy:
      "Pick a random candidate from the top 5; about half the time prefer a quiet (non-capturing) move.",
    persona: { key: "pip", name: "Pip", blurb: "Cheerful club newcomer; encouraging, a bit nervous." },
    aiRating: 800,
    hintsAllowed: true,
  },
  casual: {
    id: "casual",
    label: "Casual",
    description: "A friendly game with a chatty café player.",
    depth: 6, multiPv: 3, searchTimeoutMs: 1200,
    selectionPolicy: "Pick a random candidate from the top 3.",
    persona: { key: "marco", name: "Marco", blurb: "Friendly café player; chatty, light jokes." },
    aiRating: 1100,
    hintsAllowed: true,
  },
  intermediate: {
    id: "intermediate",
    label: "Intermediate",
    description: "A patient coach who names the idea behind each move.",
    depth: 10, multiPv: 3, searchTimeoutMs: 1800,
    selectionPolicy: "Pick rank 1 about 70% of the time, otherwise rank 2.",
    persona: { key: "ada", name: "Ada", blurb: "Patient coach; names the idea (pin, outpost, tempo)." },
    aiRating: 1400,
    hintsAllowed: false,
  },
  advanced: {
    id: "advanced",
    label: "Advanced",
    description: "A serious tournament player. Terse and accurate.",
    depth: 14, multiPv: 2, searchTimeoutMs: 2400,
    selectionPolicy: "Always pick rank 1 (the best move).",
    persona: { key: "viktor", name: "Viktor", blurb: "Dry, confident tournament player; terse." },
    aiRating: 1800,
    hintsAllowed: false,
  },
  grandmaster: {
    id: "grandmaster",
    label: "Grandmaster",
    description: "No mercy, and she will tell you about it.",
    depth: 18, multiPv: 2, searchTimeoutMs: 2600,
    selectionPolicy: "Always pick rank 1 (the best move).",
    persona: { key: "kasparova", name: "Kasparova", blurb: "Imperious grandmaster; cutting one-liners." },
    aiRating: 2300,
    hintsAllowed: false,
  },
};

export const DIFFICULTY_ORDER: Difficulty[] = [
  "beginner", "casual", "intermediate", "advanced", "grandmaster",
];

export const AI_RATING: Record<Difficulty, number> = {
  beginner: 800, casual: 1100, intermediate: 1400, advanced: 1800, grandmaster: 2300,
};

export function aiDisplayName(difficulty: Difficulty): string {
  return DIFFICULTIES[difficulty].persona.name;
}
