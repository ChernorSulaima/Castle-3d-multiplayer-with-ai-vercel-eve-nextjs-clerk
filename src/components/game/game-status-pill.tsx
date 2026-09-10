"use client";
// src/components/game/game-status-pill.tsx  [U2]
// UI_REDESIGN §5.1: 'Status pill (centre top): "Move 12 · White to move" /
// "Check" (ember) / "Reviewing move 8 · Back to live" (brass, clickable) /
// result text when over. Difficulty badge for AI games.'
import { RadioIcon, RotateCcwIcon, TriangleAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatPill } from "@/components/ui-kit";
import { cn } from "@/lib/ui";

export interface GameStatusPillProps {
  /** null while live; otherwise the ply being reviewed. */
  reviewPly: number | null;
  /** Whole moves played so far. */
  moveNumber: number;
  /** "You", "Marco", "Player 2" — from `controller.turnLabel`. */
  turnLabel: string;
  active: boolean;
  inCheck: boolean;
  /** Shown once the game is over, e.g. "White wins by checkmate". */
  resultText: string | null;
  onBackToLive(): void;
  className?: string;
}

export function GameStatusPill({
  reviewPly,
  moveNumber,
  turnLabel,
  active,
  inCheck,
  resultText,
  onBackToLive,
  className,
}: GameStatusPillProps) {
  if (reviewPly !== null) {
    // Ply 0 is the position before White's first move, not "move 0".
    const where = reviewPly === 0 ? "the start" : `move ${Math.ceil(reviewPly / 2)}`;
    return (
      <Button
        size="sm"
        variant="ghost"
        onClick={onBackToLive}
        aria-label={`Reviewing ${where}. Go back to the live position.`}
        className={cn(
          "h-7 shrink-0 gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2.5 text-[13px] text-primary hover:bg-primary/20",
          className,
        )}
      >
        <RotateCcwIcon aria-hidden />
        <span className="tabular">Reviewing {where}</span>
        <span aria-hidden className="hidden opacity-60 sm:inline">
          ·
        </span>
        <span aria-hidden className="hidden font-medium sm:inline">
          Back to live
        </span>
      </Button>
    );
  }

  if (!active) {
    return (
      <StatPill
        role="status"
        className={cn("shrink-0", className)}
        value={resultText ?? "Game over"}
      />
    );
  }

  if (inCheck) {
    return (
      <StatPill
        role="status"
        tone="danger"
        className={cn("shrink-0", className)}
        value={
          <span className="inline-flex items-center gap-1.5">
            <TriangleAlertIcon className="size-3.5" aria-hidden />
            Check
          </span>
        }
        label={
          <>
            <span className="sr-only">· </span>
            <span className="sr-only sm:not-sr-only">{turnLabel} to move</span>
          </>
        }
      />
    );
  }

  return (
    <StatPill
      role="status"
      tone="live"
      dot
      className={cn("shrink-0", className)}
      value={`Move ${Math.max(1, moveNumber)}`}
      label={<span className="sr-only sm:not-sr-only">· {turnLabel} to move</span>}
    />
  );
}

/** The small "live position" marker used in the Moves tab footer. */
export function LivePositionNote({ className }: { className?: string }) {
  return (
    <p className={cn("flex items-center gap-1.5 text-[12px] text-muted-foreground", className)}>
      <RadioIcon className="size-3.5 text-live" aria-hidden />
      Live position
    </p>
  );
}
