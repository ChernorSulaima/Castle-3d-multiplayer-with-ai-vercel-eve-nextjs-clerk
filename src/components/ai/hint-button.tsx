"use client";
// src/components/ai/hint-button.tsx — FR-40
//
// Renders ONLY for Beginner and Casual vs-AI games and only on the human's turn.
// The three-per-game limit is charged by /api/ai/hint itself (`api.games.useHint`
// with the caller's token) so that the cap holds for a caller that skips this
// component entirely; `remaining` below is the live `game.hintsUsed` and updates
// through the subscription as soon as the route has charged.
//
// U2 note: the round trip now lives in `use-hint.ts`, which the game screen's chat
// composer (UI_REDESIGN §5.1) calls directly. This component is the standalone
// button for anywhere outside that shell.
import { useQuery } from "convex/react";
import { LightbulbIcon } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { MAX_HINTS_PER_GAME } from "@/lib/constants";
import { DIFFICULTIES } from "@/lib/difficulty";
import { useAiStore } from "@/lib/stores/ai-store";
import type { Difficulty, GameId } from "@/lib/types";
import { cn } from "cn";
import { useHint } from "./use-hint";

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

  const hint = useAiStore((s) => s.hint);
  const { pending, request } = useHint({
    gameId,
    fen: game?.fen ?? "",
    enabled: isAiGame && hintsAllowed,
  });

  const remaining = Math.max(0, MAX_HINTS_PER_GAME - (game?.hintsUsed ?? 0));
  const humanToMove =
    game !== null &&
    game.status === "active" &&
    game.aiColor !== undefined &&
    game.turn !== game.aiColor;

  if (!isAiGame || !hintsAllowed) return null;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Button
        variant="outline"
        size="sm"
        onClick={request}
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
