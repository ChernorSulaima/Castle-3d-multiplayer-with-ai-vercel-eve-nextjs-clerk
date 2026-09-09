"use client";
// src/hooks/use-ai-turn.ts
//
// The AI turn orchestrator (§E.4). Mount it ONCE per game page, above the 2D/3D
// board swap, next to `useGameController`:
//
//     const ai = useAiTurn(gameId);
//
// It self-subscribes to `api.games.get` (Convex dedupes identical query+args, so
// this costs nothing on top of the controller's own subscription) and runs the
// pipeline whenever the AI is to move:
//
//   stockfish (Skill Level 20 + MultiPV) -> POST /api/ai/move -> games.makeAiMove
//   + commentary.append + games.setEveSession
//
// It is the ONLY place besides `useGameController` that writes game state to
// Convex, and it writes exactly those three mutations (§D.11 rule 1).
import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import { postAiMove } from "@/lib/engine/ai-client";
import {
  candidatesFromLegalMoves,
  linesToCandidates,
  normaliseMove,
  selectCandidate,
  uciToSan,
} from "@/lib/engine/candidates";
import { useStockfish } from "@/lib/engine/use-stockfish";
import type { SearchRequest, SearchResult } from "@/lib/engine/stockfish-client";
import { STOCKFISH_CANDIDATE_SKILL_LEVEL } from "@/lib/constants";
import { DIFFICULTIES } from "@/lib/difficulty";
import { useAiStore } from "@/lib/stores/ai-store";
import type { Candidate, Difficulty, GameId } from "@/lib/types";

/** Neutral line used when the agent produced no commentary (FR-36 fallback path). */
const FALLBACK_COMMENTARY = "Your move.";
/** Attempts per ply before the turn is parked with a visible error. */
const MAX_TURN_ATTEMPTS = 2;
const RETRY_DELAY_MS = 1_500;

export interface AiTurnState {
  /** True when this game is an active vs-AI game (the engine is mounted). */
  active: boolean;
  /** True while the pipeline is running for the current ply. */
  thinking: boolean;
  /** Last error code, or null. `stale-ai-move` is swallowed (another tab won). */
  error: string | null;
  /** Re-run the UCI handshake after a failed engine load. */
  retryEngine(): void;
}

export function useAiTurn(gameId: GameId | null | undefined): AiTurnState {
  const view = useQuery(api.games.get, gameId ? { gameId } : "skip");
  const game = view?.game ?? null;

  // A spectator watching a vs-AI game must NOT drive the AI: `games.makeAiMove`
  // would reject them with `not-a-participant`, and booting a second engine on
  // their machine would be pure waste.
  const isParticipant = view?.viewerRole === "white" || view?.viewerRole === "black";
  const isAiGame = game !== null && game.mode === "ai" && isParticipant;
  const { search, retry: retryEngine } = useStockfish(isAiGame);

  const makeAiMove = useMutation(api.games.makeAiMove);
  const appendCommentary = useMutation(api.commentary.append);
  const setEveSession = useMutation(api.games.setEveSession);

  const phase = useAiStore((s) => s.phase);
  const storedError = useAiStore((s) => s.error);

  // A stable key for "the AI owes a move at this exact ply". Null whenever it is
  // not the AI's turn — that is the guard against a re-render, a second tab or a
  // take-back kicking off two turns for the same position (§E.4 step 2).
  const turnKey = isAiGame ? aiTurnKey(game) : null;

  const gameRef = useRef<Doc<"games"> | null>(game);
  const startedRef = useRef<string | null>(null);
  const attemptsRef = useRef<Map<string, number>>(new Map());
  const [retryTick, setRetryTick] = useState(0);

  // Declared FIRST so the ref is fresh before the turn effect below runs. Reading
  // the game through a ref keeps `game` out of the turn effect's deps, so an
  // unrelated subscription push cannot abort a turn that is already in flight.
  useEffect(() => {
    gameRef.current = game;
  });

  const searchRef = useRef(search);
  useEffect(() => {
    searchRef.current = search;
  });

  useEffect(() => {
    if (turnKey === null) return;
    if (startedRef.current === turnKey) return;
    startedRef.current = turnKey;

    const snapshot = gameRef.current;
    if (snapshot === null) return;

    const attempts = (attemptsRef.current.get(turnKey) ?? 0) + 1;
    attemptsRef.current.set(turnKey, attempts);

    const controller = new AbortController();
    let cancelled = false;

    void runAiTurn({
      game: snapshot,
      signal: controller.signal,
      search: (request) => searchRef.current(request),
      makeAiMove,
      appendCommentary,
      setEveSession,
    })
      .catch((error: unknown) => {
        if (cancelled) return;
        const code = errorCode(error);
        if (code === "stale-ai-move" || code === "game-not-active" || code === "not-ai-turn") {
          // Another submission already landed, or the game moved on. Not an error.
          useAiStore.getState().resetTurn();
          return;
        }
        useAiStore.getState().setError(code);
        if (attempts < MAX_TURN_ATTEMPTS) {
          setTimeout(() => {
            if (startedRef.current !== turnKey) return;
            startedRef.current = null;
            setRetryTick((tick) => tick + 1);
          }, RETRY_DELAY_MS);
        }
      })
      .finally(() => {
        // Keep the map small: only the ply in flight and its retry counter matter.
        if (attemptsRef.current.size > 4) {
          for (const key of attemptsRef.current.keys()) {
            if (key !== turnKey) attemptsRef.current.delete(key);
          }
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [turnKey, retryTick, makeAiMove, appendCommentary, setEveSession]);

  // A finished / abandoned / rewound game must not leave the panel "thinking".
  useEffect(() => {
    if (turnKey !== null) return;
    if (useAiStore.getState().phase === "idle") return;
    useAiStore.getState().resetTurn();
  }, [turnKey]);

  const retry = useCallback(() => {
    retryEngine();
    startedRef.current = null;
    setRetryTick((tick) => tick + 1);
  }, [retryEngine]);

  return {
    active: isAiGame && game !== null && game.status === "active",
    thinking: turnKey !== null && phase !== "idle",
    error: storedError,
    retryEngine: retry,
  };
}

/* ----------------------------------------------------------------- pipeline */

interface RunAiTurnInput {
  game: Doc<"games">;
  signal: AbortSignal;
  search: (request: SearchRequest) => Promise<SearchResult>;
  makeAiMove: (args: { gameId: GameId; san: string; expectedPly: number }) => Promise<unknown>;
  appendCommentary: (args: {
    gameId: GameId;
    ply: number;
    text: string;
    source: "eve" | "fallback";
    persona?: string;
  }) => Promise<unknown>;
  setEveSession: (args: { gameId: GameId; eveSessionId: string }) => Promise<unknown>;
}

async function runAiTurn(input: RunAiTurnInput): Promise<void> {
  const { game, signal } = input;
  const store = useAiStore.getState();
  const difficulty: Difficulty = game.difficulty ?? "casual";
  const config = DIFFICULTIES[difficulty];
  const expectedPly = game.moves.length;
  const startedAt = Date.now();

  store.resetTurn();
  store.setPhase("engine");

  // 1. Stockfish candidates at Skill Level 20 (honest ranking) with the
  //    difficulty's depth/MultiPV and a hard client-side stop timer.
  let candidates: Candidate[] = [];
  try {
    const result = await input.search({
      fen: game.fen,
      depth: config.depth,
      multiPv: config.multiPv,
      skillLevel: STOCKFISH_CANDIDATE_SKILL_LEVEL,
      timeoutMs: config.searchTimeoutMs,
      signal,
    });
    candidates = linesToCandidates(game.fen, result.lines);
    if (candidates.length === 0 && result.bestmove !== null) {
      const san = uciToSan(game.fen, result.bestmove);
      if (san !== null) {
        candidates = [
          { san, uci: result.bestmove, scoreCp: null, mateIn: null, depth: config.depth, pv: [result.bestmove] },
        ];
      }
    }
  } catch {
    // Engine unavailable — the game must still continue (§E.4 failure modes).
  }
  if (signal.aborted) return;
  if (candidates.length === 0) {
    candidates = candidatesFromLegalMoves(game.fen, Math.max(config.multiPv, 5));
  }
  if (candidates.length === 0) {
    store.setError("no-legal-moves");
    return;
  }

  // 2. The agent turn.
  store.setPhase("agent");
  let move: string | null = null;
  let commentary = "";
  let source: "eve" | "fallback" = "fallback";
  let eveSessionId: string | undefined;
  let persona: string | undefined;

  try {
    const result = await postAiMove(
      {
        gameId: game._id,
        fen: game.fen,
        history: game.moves,
        difficulty,
        candidates,
        eveSessionId: game.eveSessionId,
      },
      {
        signal,
        onDelta: (delta) => {
          useAiStore.getState().appendCommentary(delta);
        },
      },
    );
    if (result !== null) {
      move = normaliseMove(game.fen, result.move);
      commentary = result.commentary;
      source = result.source;
      eveSessionId = result.eveSessionId;
      persona = result.persona;
    }
  } catch {
    if (signal.aborted) return;
    // Any route failure — 4xx/5xx, an offline browser, a dropped stream — falls
    // through to the local difficulty policy below (§E.4 "Failure modes"). The
    // game must never stall on the AI's turn; the "fallback" source badge is the
    // signal that the agent did not answer.
  }
  if (signal.aborted) return;

  // 3. Local re-validation (the route validates too — this is the second gate).
  if (move === null) {
    const picked = selectCandidate(difficulty, candidates);
    if (picked === null) {
      store.setError("no-legal-moves");
      return;
    }
    move = picked.san;
    source = "fallback";
    persona ??= config.persona.name;
  }
  if (source === "fallback" && commentary.trim().length === 0) {
    commentary = FALLBACK_COMMENTARY;
  }

  // 4. Submit. Convex re-verifies mode, turn, ply and legality (§I-6).
  store.setPhase("applying");
  await input.makeAiMove({ gameId: game._id, san: move, expectedPly });

  const text = commentary.trim();
  if (text.length > 0) {
    await input
      .appendCommentary({
        gameId: game._id,
        ply: expectedPly + 1,
        text,
        source,
        persona: persona ?? config.persona.name,
      })
      .catch(() => undefined); // commentary is cosmetic; never fail the move on it
  }
  if (eveSessionId !== undefined && eveSessionId !== game.eveSessionId) {
    await input.setEveSession({ gameId: game._id, eveSessionId }).catch(() => undefined);
  }

  useAiStore.getState().finishTurn(source, Date.now() - startedAt);
}

/* ------------------------------------------------------------------ helpers */

function aiTurnKey(game: Doc<"games"> | null): string | null {
  if (game === null) return null;
  if (game.mode !== "ai" || game.status !== "active") return null;
  if (game.aiColor === undefined || game.turn !== game.aiColor) return null;
  return `${game._id}:${game.moves.length}`;
}

function errorCode(error: unknown): string {
  if (error instanceof Error) {
    // Convex surfaces `throw new Error("illegal-move")` with framing around it.
    const match = /\b(stale-ai-move|not-ai-turn|game-not-active|not-a-participant|illegal-move|not-an-ai-game|game-not-found)\b/.exec(
      error.message,
    );
    return match?.[1] ?? error.message.slice(0, 120);
  }
  return "ai-turn-failed";
}
