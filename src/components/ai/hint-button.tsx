"use client";
// src/components/ai/hint-button.tsx — FR-40
//
// Renders ONLY for Beginner and Casual vs-AI games and only on the human's turn.
// The three-per-game limit is charged by /api/ai/hint itself (`api.games.useHint`
// with the caller's token) so that the cap holds for a caller that skips this
// component entirely; `remaining` below is the live `game.hintsUsed` and updates
// through the subscription as soon as the route has charged.
//
// Drop it straight into P3's controls: `<HintButton gameId={gameId} />`.
import { useCallback } from "react";
import { useQuery } from "convex/react";
import { LightbulbIcon } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { MAX_HINTS_PER_GAME } from "@/lib/constants";
import { DIFFICULTIES } from "@/lib/difficulty";
import { postAiHint } from "@/lib/engine/ai-client";
import { linesToCandidates } from "@/lib/engine/candidates";
import { useStockfish } from "@/lib/engine/use-stockfish";
import { useAiStore } from "@/lib/stores/ai-store";
import type { Candidate, Difficulty, GameId } from "@/lib/types";
import { cn } from "cn";

/** A hint search is shallower than a real AI turn — it must feel instant. */
const HINT_DEPTH = 12;
const HINT_MULTI_PV = 3;
const HINT_SEARCH_TIMEOUT_MS = 1_500;

export interface HintButtonProps {
  gameId: GameId;
  className?: string;
}

export function HintButton({ gameId, className }: HintButtonProps) {
  const view = useQuery(api.games.get, { gameId });
  const game = view?.game ?? null;
  const difficulty = game?.difficulty as Difficulty | undefined;
  const hintsAllowed = difficulty !== undefined && DIFFICULTIES[difficulty].hintsAllowed;
  // Spectators get no hint button: `games.useHint` would reject them anyway.
  const isParticipant = view?.viewerRole === "white" || view?.viewerRole === "black";
  const isAiGame = game !== null && game.mode === "ai" && isParticipant;

  const { search } = useStockfish(isAiGame && hintsAllowed);
  const pending = useAiStore((s) => s.hintPending);
  const hint = useAiStore((s) => s.hint);

  const fen = game?.fen ?? "";
  const remaining = Math.max(0, MAX_HINTS_PER_GAME - (game?.hintsUsed ?? 0));
  const humanToMove =
    game !== null &&
    game.status === "active" &&
    game.aiColor !== undefined &&
    game.turn !== game.aiColor;

  const requestHint = useCallback(async () => {
    const store = useAiStore.getState();
    store.setHintPending(true);
    store.setHint(null);
    try {
      let candidates: Candidate[] = [];
      try {
        const result = await search({
          fen,
          depth: HINT_DEPTH,
          multiPv: HINT_MULTI_PV,
          skillLevel: 20,
          timeoutMs: HINT_SEARCH_TIMEOUT_MS,
        });
        candidates = linesToCandidates(fen, result.lines);
      } catch {
        // No engine: the route falls back to the legal-move list.
      }

      const result = await postAiHint({ gameId, candidates });
      useAiStore.getState().setHint(result);
    } catch (error) {
      useAiStore.getState().setHint(null);
      toast.error(hintErrorMessage(error));
    } finally {
      useAiStore.getState().setHintPending(false);
    }
  }, [fen, gameId, search]);

  if (!isAiGame || !hintsAllowed) return null;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          void requestHint();
        }}
        disabled={pending || remaining === 0 || !humanToMove}
        aria-label={`Get a hint. ${remaining} of ${MAX_HINTS_PER_GAME} remaining.`}
      >
        <LightbulbIcon data-icon="inline-start" aria-hidden="true" />
        {pending ? "Thinking…" : "Hint"}
        <span className="tabular-nums opacity-70">
          {remaining}/{MAX_HINTS_PER_GAME}
        </span>
      </Button>
      {hint !== null ? (
        <p
          className="rounded-lg border border-border bg-muted/40 px-2.5 py-2 text-xs"
          role="status"
          aria-live="polite"
        >
          <strong className="font-semibold">{hint.san}</strong>
          {hint.text.length > 0 ? <span className="ml-1.5">{hint.text}</span> : null}
        </p>
      ) : null}
    </div>
  );
}

function hintErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : "";
  if (raw.includes("hint-limit")) return `No hints left — ${MAX_HINTS_PER_GAME} per game.`;
  if (raw.includes("hints-unavailable")) return "Hints are only available on Beginner and Casual.";
  if (raw.includes("game-not-active")) return "This game has finished.";
  if (raw.includes("not-your-turn")) return "Wait for your turn to ask for a hint.";
  return "Could not fetch a hint. Try again.";
}
