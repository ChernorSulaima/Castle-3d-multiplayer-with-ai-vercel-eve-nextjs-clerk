"use client";
// src/components/game/game-result-dialog.tsx  [P3 → rebuilt U2]
// FR-45 / §E.9.4 / UI_REDESIGN §5.4: 'Fraunces headline ("You won", "Draw", "You
// resigned"), result line, rating change in mono with a brass/ember delta, "Won
// with 2 take-backs" when applicable, buttons: Play again (same mode), Review
// game, Back to lobby.'
//
// PURE: the rating row and the rematch mutation are fed in by `GameShell`, so
// /dev/game can open this dialog with no Convex at all.
import { useState } from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Display } from "@/components/ui-kit";
import {
  formatEndReason,
  formatGameResult,
  formatRatingDelta,
  outcomeFor,
  pluralize,
} from "@/lib/format";
import { cn } from "@/lib/ui";
import type { Colour, GameView } from "@/lib/types";

export interface GameResultDialogProps {
  view: GameView;
  /** The viewer's seat; null for spectators (they get a link, not a rematch). */
  seat: Colour | "both" | null;
  /** The viewer's rating change for this game, when there was one (FR-49). */
  rating: { delta: number; after: number } | null;
  /** True while the rematch mutation is in flight. */
  playAgainPending?: boolean;
  onPlayAgain(): void;
  /** Where "Back to lobby" goes. */
  lobbyHref?: string;
}

function headlineFor(view: GameView, seat: Colour | "both" | null): string {
  const { game } = view;
  const myColour: Colour | null = seat === "both" || seat === null ? null : seat;
  const outcome = outcomeFor(game.status, game.winner, myColour);
  if (outcome === "loss" && game.status === "resigned") return "You resigned";
  if (outcome === "win") return "You won";
  if (outcome === "loss") return "You lost";
  if (game.winner === "draw") return "Draw";
  return "Game over";
}

export function GameResultDialog({
  view,
  seat,
  rating,
  playAgainPending = false,
  onPlayAgain,
  lobbyHref = "/play",
}: GameResultDialogProps) {
  const { game } = view;
  const finished = game.status !== "active" && game.status !== "waiting";
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);
  // `games.undo` resurrects a finished game (FR-43), so the SAME game can finish the
  // same way twice. `endedAt` is cleared by the take-back and rewritten by the next
  // finalize, which is what makes this key distinguish the two endings.
  const dismissKey = `${game._id}:${game.status}:${game.endedAt ?? 0}`;
  const open = finished && dismissedFor !== dismissKey;

  const myColour: Colour | null = seat === "both" || seat === null ? null : seat;
  const outcome = outcomeFor(game.status, game.winner, myColour);
  const detail = formatGameResult(game.status, game.winner, game.endReason, {
    whiteName: view.whiteName,
    blackName: view.blackName,
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setDismissedFor(dismissKey);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          {/* The Fraunces face rides on a child span, not on DialogTitle itself:
              the shadcn title already carries `font-heading text-base`, and two
              font-family utilities on one element resolve by stylesheet order. */}
          <DialogTitle>
            <Display level={3} as="span" className="block text-[2rem]">
              {headlineFor(view, seat)}
            </Display>
          </DialogTitle>
          <DialogDescription>{detail}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          {rating !== null ? (
            <span
              className={cn(
                "tabular inline-flex items-baseline gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[13px]",
                rating.delta >= 0
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-destructive/40 bg-destructive/10 text-destructive",
              )}
            >
              <span className="font-medium">{formatRatingDelta(rating.delta)}</span>
              <span className="opacity-75">{rating.after}</span>
            </span>
          ) : game.rated ? (
            <Badge variant="outline">Rated</Badge>
          ) : (
            <Badge variant="outline">Unrated</Badge>
          )}
          {game.status === "abandoned" ? (
            <Badge variant="outline">Opponent disconnected</Badge>
          ) : null}
          {game.endReason ? (
            <Badge variant="ghost" className="capitalize">
              {formatEndReason(game.endReason).replace(/^by /, "")}
            </Badge>
          ) : null}
        </div>

        {game.undoCount > 0 ? (
          <p className="text-[13px] text-muted-foreground">
            {outcome === "win" ? "Won with " : "Played with "}
            {pluralize(game.undoCount, "take-back")}.
          </p>
        ) : null}

        <DialogFooter className="sm:justify-between">
          <Button variant="ghost" onClick={() => setDismissedFor(dismissKey)}>
            Review game
          </Button>
          <div className="flex flex-wrap gap-2">
            <Link
              prefetch={false}
              href={lobbyHref}
              className={buttonVariants({ variant: "outline" })}
            >
              Back to lobby
            </Link>
            {seat === null ? null : (
              <Button disabled={playAgainPending} onClick={onPlayAgain}>
                Play again
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
