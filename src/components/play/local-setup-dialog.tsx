"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MAX_LOCAL_NAME_LENGTH } from "@/lib/constants";
import { describeConvexError } from "@/components/providers/convex-errors";

export function LocalSetupDialog({
  open,
  onOpenChange,
  /** True the moment the create mutation is sent, false again if it rejects. Lets
   *  `/play` tell this self-started game apart from a `queue.pair` match, which it
   *  otherwise cannot: both simply make an id appear in `games.myActiveGame`. */
  onStartingChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStartingChange?: (starting: boolean) => void;
}) {
  const router = useRouter();
  const createLocalGame = useMutation(api.games.createLocalGame);
  const [playerTwoName, setPlayerTwoName] = useState("");
  const [starting, setStarting] = useState(false);

  async function start() {
    if (starting) return;
    setStarting(true);
    onStartingChange?.(true);
    const trimmed = playerTwoName.trim();
    try {
      const gameId = await createLocalGame(
        trimmed.length > 0 ? { playerTwoName: trimmed } : {},
      );
      router.push(`/game/${gameId}`);
    } catch (error) {
      setStarting(false);
      onStartingChange?.(false);
      toast.error(describeConvexError(error, "Could not start the game. Try again."));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Two players, one device</DialogTitle>
          <DialogDescription>
            The board flips between turns so whoever is to move always looks from their own side.
            Local games are never rated and never touch the leaderboard.
          </DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void start();
          }}
        >
          <Label htmlFor="player-two-name">Player 2 name (optional)</Label>
          <Input
            id="player-two-name"
            value={playerTwoName}
            maxLength={MAX_LOCAL_NAME_LENGTH}
            placeholder="Player 2"
            autoComplete="off"
            onChange={(event) => setPlayerTwoName(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Up to {MAX_LOCAL_NAME_LENGTH} characters. You play White.
          </p>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={starting}>
            Cancel
          </Button>
          <Button onClick={start} disabled={starting}>
            {starting ? "Starting…" : "Start game"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
