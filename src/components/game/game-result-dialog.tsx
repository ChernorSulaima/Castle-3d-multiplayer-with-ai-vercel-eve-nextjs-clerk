"use client";
// src/components/game/game-result-dialog.tsx  [P3]
// FR-45 / §E.9.4: the end-of-game card — headline, rating delta (FR-49), the
// take-back count and a rematch. It opens once per finished game and can be
// dismissed so the player can keep reviewing the position (FR-54).
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import {
  formatEndReason,
  formatGameResult,
  formatRatingDelta,
  outcomeFor,
  pluralize,
} from "@/lib/format";
import type { Colour, GameView } from "@/lib/types";
import { api } from "../../../convex/_generated/api";

export interface GameResultDialogProps {
  view: GameView;
  /** The viewer's seat; null for spectators (they get the banner, not a rematch). */
  seat: Colour | "both" | null;
  /** The viewer's own username, used to look up the rating change. */
  viewerUsername: string | null;
}

export function GameResultDialog({ view, seat, viewerUsername }: GameResultDialogProps) {
  const router = useRouter();
  const { game } = view;
  const finished = game.status !== "active" && game.status !== "waiting";
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);
  // `games.undo` resurrects a finished game (FR-43), so the SAME game can finish the
  // same way twice. `endedAt` is cleared by the take-back and rewritten by the next
  // finalize, which is what makes this key distinguish the two endings.
  const dismissKey = `${game._id}:${game.status}:${game.endedAt ?? 0}`;
  const open = finished && dismissedFor !== dismissKey;

  const createAiGame = useMutation(api.games.createAiGame);
  const createLocalGame = useMutation(api.games.createLocalGame);
  const [rematching, setRematching] = useState(false);

  // FR-49: the delta was written in the same transaction that finished the game.
  const ratingRows = useQuery(
    api.ratingHistory.forPlayer,
    finished && game.rated && viewerUsername
      ? { username: viewerUsername, pool: game.mode === "ai" ? "ai" : "human", limit: 10 }
      : "skip",
  );
  const delta = ratingRows?.find((row) => row.gameId === game._id) ?? null;

  const myColour: Colour | null = seat === "both" || seat === null ? null : seat;
  const outcome = outcomeFor(game.status, game.winner, myColour);

  const rematch = useCallback(async () => {
    setRematching(true);
    try {
      if (game.mode === "ai" && game.difficulty && game.aiColor) {
        const id = await createAiGame({
          difficulty: game.difficulty,
          // Keep the same seat the player had.
          playerColor: game.aiColor === "w" ? "b" : "w",
        });
        router.push(`/game/${id}`);
        return;
      }
      if (game.mode === "local") {
        const id = await createLocalGame({
          playerTwoName: game.localPlayerTwoName,
        });
        router.push(`/game/${id}`);
        return;
      }
      router.push("/play");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start a rematch.");
    } finally {
      setRematching(false);
    }
  }, [game, createAiGame, createLocalGame, router]);

  const headline = formatGameResult(game.status, game.winner, game.endReason, {
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {outcome === "win"
              ? "You won"
              : outcome === "loss"
                ? "You lost"
                : game.winner === "draw"
                  ? "Draw"
                  : "Game over"}
          </DialogTitle>
          <DialogDescription>{headline}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          {game.status === "abandoned" ? (
            <Badge variant="outline">Opponent disconnected</Badge>
          ) : null}
          {game.endReason ? (
            <Badge variant="ghost" className="capitalize">
              {formatEndReason(game.endReason).replace(/^by /, "")}
            </Badge>
          ) : null}
          {game.rated ? (
            delta ? (
              <Badge variant={delta.delta >= 0 ? "default" : "destructive"}>
                {formatRatingDelta(delta.delta)} rating ({delta.after})
              </Badge>
            ) : (
              <Badge variant="outline">Rated</Badge>
            )
          ) : (
            <Badge variant="outline">
              Unrated
              {game.undoCount > 0 ? ` — ${pluralize(game.undoCount, "take-back")}` : ""}
            </Badge>
          )}
        </div>

        {game.undoCount > 0 && outcome === "win" ? (
          <p className="text-sm text-muted-foreground">
            Won with {pluralize(game.undoCount, "take-back")}.
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => setDismissedFor(dismissKey)}>
            Review the game
          </Button>
          {seat === null ? (
            <Link href="/play" className={buttonVariants()}>
              Back to play
            </Link>
          ) : (
            <Button
              disabled={rematching}
              onClick={() => {
                void rematch();
              }}
            >
              {game.mode === "online" ? "Find another match" : "Rematch"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
