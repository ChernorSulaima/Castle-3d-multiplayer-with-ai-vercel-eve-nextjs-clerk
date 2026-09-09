"use client";
// src/components/ai/engine-loading.tsx
//
// First-load state for the Stockfish worker. stockfish@11.0.0 is 669 KB gzipped and
// its glue exposes NO download-progress channel (that was an SF18-only feature), so
// this is deliberately an INDETERMINATE bar until `uciok` — measured at ~108 ms warm,
// ~1 s on a cold broadband load (§E.4 step 3).
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useAiStore } from "@/lib/stores/ai-store";
import { cn } from "cn";

export interface EngineLoadingProps {
  /** Wire to `useAiTurn(...).retryEngine`. Omit to hide the retry button. */
  onRetry?: () => void;
  className?: string;
}

export function EngineLoading({ onRetry, className }: EngineLoadingProps) {
  const status = useAiStore((s) => s.engineStatus);
  const percent = useAiStore((s) => s.downloadPercent);

  if (status === "ready" || status === "idle") return null;

  if (status === "error") {
    return (
      <div
        role="alert"
        className={cn(
          "flex flex-wrap items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive",
          className,
        )}
      >
        <span className="flex-1">
          The chess engine could not start. The AI will still move, but more simply.
        </span>
        {onRetry !== undefined ? (
          <Button variant="outline" size="xs" onClick={onRetry}>
            Retry
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn("space-y-1.5", className)} data-slot="engine-loading">
      <p className="text-xs text-muted-foreground" id="engine-loading-label">
        Loading chess engine…
      </p>
      <Progress
        // `value={null}` is Base UI's indeterminate mode — correct here because the
        // engine reports no progress events.
        value={percent > 0 ? percent : null}
        aria-labelledby="engine-loading-label"
        className="w-full"
      />
    </div>
  );
}
