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
  /** UCI `Skill Level` used ONLY for the raw-Stockfish fallback search.
   *  Candidate generation always runs at Skill Level 20 (stockfish.md §6:
   *  Skill Level < 20 randomises `bestmove` and forces internal MultiPV >= 4). */
  skillLevel: number;
  /** UCI `go depth`. */
  depth: number;
  /** UCI `MultiPV` for the candidate list handed to the agent. */
  multiPv: number;
  /** Hard `stop` timeout for the search; bestmove arrives ~50 ms later. */
  searchTimeoutMs: number;
  /** Human-readable policy. The agent enforces it (agent/instructions.md). */
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
    skillLevel: 1, depth: 2, multiPv: 5, searchTimeoutMs: 800,
    selectionPolicy:
      "Pick a random candidate from ranks 2-4 unless rank 1 delivers mate or avoids being mated.",
    persona: { key: "pip", name: "Pip", blurb: "Cheerful club newcomer; encouraging, a bit nervous." },
    aiRating: 800,
    hintsAllowed: true,
  },
  casual: {
    id: "casual",
    label: "Casual",
    description: "A friendly game with a chatty café player.",
    skillLevel: 5, depth: 6, multiPv: 3, searchTimeoutMs: 1200,
    selectionPolicy: "Pick rank 1 or 2, preferring natural developing or capturing moves.",
    persona: { key: "marco", name: "Marco", blurb: "Friendly café player; chatty, light jokes." },
    aiRating: 1100,
    hintsAllowed: true,
  },
  intermediate: {
    id: "intermediate",
    label: "Intermediate",
    description: "A patient coach who names the idea behind each move.",
    skillLevel: 10, depth: 10, multiPv: 3, searchTimeoutMs: 1800,
    selectionPolicy: "Pick rank 1 unless rank 2 is within 30 centipawns and more thematic.",
    persona: { key: "ada", name: "Ada", blurb: "Patient coach; names the idea (pin, outpost, tempo)." },
    aiRating: 1400,
    hintsAllowed: false,
  },
  advanced: {
    id: "advanced",
    label: "Advanced",
    description: "A serious tournament player. Terse and accurate.",
    skillLevel: 15, depth: 14, multiPv: 2, searchTimeoutMs: 2400,
    selectionPolicy: "Always pick rank 1.",
    persona: { key: "viktor", name: "Viktor", blurb: "Dry, confident tournament player; terse." },
    aiRating: 1800,
    hintsAllowed: false,
  },
  grandmaster: {
    id: "grandmaster",
    label: "Grandmaster",
    description: "No mercy, and she will tell you about it.",
    skillLevel: 20, depth: 18, multiPv: 2, searchTimeoutMs: 2600,
    selectionPolicy: "Always pick rank 1.",
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
