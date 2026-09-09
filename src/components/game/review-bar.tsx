"use client";
// src/components/game/review-bar.tsx  [P3]
// FR-42 / FR-54 / §E.8: first / prev / next / last, autoplay and the
// "Reviewing move N" banner. Works for a live game and for a finished replay.
import {
  ChevronFirstIcon,
  ChevronLastIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PauseIcon,
  PlayIcon,
  RadioIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ReviewBarProps {
  reviewPly: number | null;
  totalPlies: number;
  autoplay: boolean;
  className?: string;
  goToPly(ply: number | null): void;
  stepReview(delta: number): void;
  setAutoplay(on: boolean): void;
}

export function ReviewBar({
  reviewPly,
  totalPlies,
  autoplay,
  className,
  goToPly,
  stepReview,
  setAutoplay,
}: ReviewBarProps) {
  const atStart = reviewPly === 0;
  const live = reviewPly === null;
  const moveNumber = reviewPly === null ? Math.ceil(totalPlies / 2) : Math.ceil(reviewPly / 2);

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <div className="flex items-center gap-1" role="group" aria-label="Replay controls">
        <Button
          size="icon-sm"
          variant="outline"
          aria-label="First move"
          disabled={totalPlies === 0 || atStart}
          onClick={() => goToPly(0)}
        >
          <ChevronFirstIcon />
        </Button>
        <Button
          size="icon-sm"
          variant="outline"
          aria-label="Previous move"
          disabled={totalPlies === 0 || atStart}
          onClick={() => stepReview(-1)}
        >
          <ChevronLeftIcon />
        </Button>
        <Button
          size="icon-sm"
          variant="outline"
          aria-label={autoplay ? "Pause replay" : "Play replay"}
          disabled={totalPlies === 0}
          onClick={() => setAutoplay(!autoplay)}
        >
          {autoplay ? <PauseIcon /> : <PlayIcon />}
        </Button>
        <Button
          size="icon-sm"
          variant="outline"
          aria-label="Next move"
          disabled={live}
          onClick={() => stepReview(1)}
        >
          <ChevronRightIcon />
        </Button>
        <Button
          size="icon-sm"
          variant="outline"
          aria-label="Latest position"
          disabled={live}
          onClick={() => goToPly(null)}
        >
          <ChevronLastIcon />
        </Button>
      </div>

      {live ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <RadioIcon className="size-3.5" aria-hidden />
          Live position
        </p>
      ) : (
        <div className="flex items-center gap-2" role="status">
          <p className="text-xs font-medium">
            Reviewing move {moveNumber}
            <span className="ml-1 text-muted-foreground">(read-only)</span>
          </p>
          <Button size="xs" variant="ghost" onClick={() => goToPly(null)}>
            Return to live
          </Button>
        </div>
      )}
    </div>
  );
}
