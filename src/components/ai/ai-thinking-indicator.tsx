"use client";
// src/components/ai/ai-thinking-indicator.tsx
//
// The three phases of an AI turn (§E.4): engine -> agent -> applying. FR-38 targets
// a p50 under 3 s but the hard ceiling is NFR-5's 10 s, so past
// AI_TARGET_LATENCY_MS the elapsed seconds appear and the copy softens to
// "still thinking" rather than the UI looking stuck (§I-11).
import { useEffect, useState } from "react";
import { AI_TARGET_LATENCY_MS } from "@/lib/constants";
import { useAiStore } from "@/lib/stores/ai-store";
import type { AiPhase } from "@/lib/types";
import { cn } from "cn";

const PHASE_LABEL: Record<Exclude<AiPhase, "idle">, string> = {
  engine: "Calculating…",
  agent: "Choosing a move…",
  applying: "Playing the move…",
};

export interface AiThinkingIndicatorProps {
  /** Persona name, e.g. "Marco". Used in the screen-reader announcement. */
  name?: string;
  className?: string;
}

export function AiThinkingIndicator({ name, className }: AiThinkingIndicatorProps) {
  const phase = useAiStore((s) => s.phase);
  const seconds = useElapsedSeconds(phase !== "idle");

  if (phase === "idle") return null;

  const slow = seconds * 1000 >= AI_TARGET_LATENCY_MS;
  const label = slow ? "Still thinking…" : PHASE_LABEL[phase];

  return (
    <p
      className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}
      // The move itself is announced by P3's move-announcer; this is status only.
      role="status"
      aria-live="polite"
    >
      <span aria-hidden="true" className="flex gap-1">
        <Dot delay="0ms" />
        <Dot delay="150ms" />
        <Dot delay="300ms" />
      </span>
      <span>
        {name === undefined ? label : `${name}: ${label}`}
        {slow ? <span className="ml-1 tabular-nums opacity-70">{seconds}s</span> : null}
      </span>
    </p>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="size-1.5 animate-bounce rounded-full bg-current motion-reduce:animate-none"
      style={{ animationDelay: delay }}
    />
  );
}

/** Whole seconds since `running` became true. Ticks 4×/s but only re-renders on a second boundary. */
function useElapsedSeconds(running: boolean): number {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!running) return;
    const startedAt = Date.now();
    const tick = () => {
      const next = Math.floor((Date.now() - startedAt) / 1000);
      setSeconds((previous) => (previous === next ? previous : next));
    };
    // Zero the counter on the next macrotask. `react-hooks/set-state-in-effect` is an
    // error in this repo (§D.12 rule 6), so the reset cannot happen in the effect body.
    const immediate = setTimeout(tick, 0);
    const id = setInterval(tick, 250);
    return () => {
      clearTimeout(immediate);
      clearInterval(id);
    };
  }, [running]);

  return running ? seconds : 0;
}
