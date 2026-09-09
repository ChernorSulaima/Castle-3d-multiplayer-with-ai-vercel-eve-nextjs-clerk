"use client";
// src/components/game/game-controls.tsx  [P3]
// Resign (FR-30, with confirmation), draw offer (FR-31), take-back (FR-43/FR-21f),
// rewind-to-here (FR-43), board flip (FR-18) and the accessible SAN entry (NFR-7).
// Every mutation goes through the controller — nothing here talks to Convex.
import { FlagIcon, HandshakeIcon, RotateCcwIcon, RefreshCwIcon, UndoIcon } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Colour, GameActions, GameMode } from "@/lib/types";
import { SanInput } from "./accessibility/san-input";

export interface GameControlsProps {
  mode: GameMode;
  /** null for spectators — the whole block is hidden then. */
  seat: Colour | "both" | null;
  orientation: Colour;
  reviewPly: number | null;
  pending: boolean;
  canMove: boolean;
  canUndo: boolean;
  canResign: boolean;
  canOfferDraw: boolean;
  actions: GameActions;
  /** P5's <HintButton /> (FR-40). It renders nothing outside Beginner/Casual. */
  hintSlot?: React.ReactNode;
  className?: string;
}

export function GameControls({
  mode,
  seat,
  orientation,
  reviewPly,
  pending,
  canMove,
  canUndo,
  canResign,
  canOfferDraw,
  actions,
  hintSlot,
  className,
}: GameControlsProps) {
  if (seat === null) return null;

  const undoLabel = mode === "local" ? "Undo move" : "Take back";

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap gap-2">
        {canResign ? (
          <AlertDialog>
            <AlertDialogTrigger
              render={<Button size="sm" variant="outline" disabled={pending} />}
            >
              <FlagIcon aria-hidden />
              Resign
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Resign this game?</AlertDialogTitle>
                <AlertDialogDescription>
                  {mode === "online"
                    ? "Your opponent wins immediately and both ratings are updated."
                    : "The game ends immediately."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep playing</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={() => {
                    void actions.resign();
                  }}
                >
                  Resign
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}

        {mode !== "ai" && canOfferDraw ? (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => {
              void actions.offerDraw();
            }}
          >
            <HandshakeIcon aria-hidden />
            Offer draw
          </Button>
        ) : null}

        {/* FR-46: take-back is hidden entirely in online matches. */}
        {mode !== "online" ? (
          <Button
            size="sm"
            variant="outline"
            disabled={!canUndo || pending}
            onClick={() => {
              void actions.undo();
            }}
          >
            <UndoIcon aria-hidden />
            {undoLabel}
          </Button>
        ) : null}

        {mode !== "online" && reviewPly !== null ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={!canUndo || pending}
            onClick={() => {
              void actions.undo(reviewPly);
            }}
          >
            <RotateCcwIcon aria-hidden />
            Rewind to here
          </Button>
        ) : null}

        <Button
          size="sm"
          variant="ghost"
          onClick={() => actions.setOrientation(orientation === "w" ? "b" : "w")}
        >
          <RefreshCwIcon aria-hidden />
          Flip board
        </Button>

        {hintSlot}
      </div>

      <SanInput disabled={!canMove || pending} onSubmitSan={actions.submitSan} />
    </div>
  );
}
