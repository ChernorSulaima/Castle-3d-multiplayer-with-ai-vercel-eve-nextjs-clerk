"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRating, formatRatingDelta } from "@/lib/format";
import type { RatingPool } from "@/lib/types";
import { cn } from "@/lib/utils";

const HISTORY_LIMIT = 60;

type Pool = RatingPool | "all";

const POOLS: ReadonlyArray<{ value: Pool; label: string }> = [
  { value: "all", label: "All" },
  { value: "human", label: "vs Humans" },
  { value: "ai", label: "vs AI" },
];

/**
 * FR-53. Hand-rolled inline SVG — no chart library, no extra dependency.
 *
 * Both degenerate cases have to be guarded or the `points` string fills with
 * NaN and the polyline silently renders nothing: a single point (divide by
 * `n - 1 === 0`) and a flat history (divide by `span === 0`).
 */
export function Sparkline({
  values,
  width = 320,
  height = 72,
  strokeWidth = 2,
  className,
}: {
  values: number[];
  width?: number;
  height?: number;
  strokeWidth?: number;
  className?: string;
}) {
  if (values.length === 0) return null;

  const p = strokeWidth; // padding keeps the stroke inside the viewBox
  const n = values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;

  const points = values.map((value, i) => {
    const x = n > 1 ? p + (i * (width - 2 * p)) / (n - 1) : width / 2;
    const y = span === 0 ? height / 2 : p + (1 - (value - min) / span) * (height - 2 * p);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  const first = values[0];
  const last = values[n - 1];
  const trend =
    last > first ? "text-emerald-500" : last < first ? "text-rose-500" : "text-muted-foreground";
  const [lastX, lastY] = points[n - 1].split(",");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn("h-18 w-full", trend, className)}
      role="img"
      aria-label={`Rating history from ${formatRating(first)} to ${formatRating(last)}`}
      preserveAspectRatio="none"
    >
      <polygon
        points={`${p},${height} ${points.join(" ")} ${width - p},${height}`}
        fill="currentColor"
        fillOpacity={0.12}
      />
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={lastX} cy={lastY} r={strokeWidth * 1.6} fill="currentColor" />
    </svg>
  );
}

export function RatingSparkline({ username }: { username: string }) {
  const [pool, setPool] = useState<Pool>("all");
  const history = useQuery(api.ratingHistory.forPlayer, {
    username,
    pool,
    limit: HISTORY_LIMIT,
  });

  // Rows arrive oldest-first, so prefixing the first row's `before` gives the
  // starting rating and n+1 points for n rated games.
  const values =
    history === undefined || history.length === 0
      ? []
      : [history[0].before, ...history.map((row) => row.after)];
  const net = values.length > 1 ? values[values.length - 1] - values[0] : 0;

  return (
    <section aria-label="Rating history" className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Rating history</h2>
        <div role="group" aria-label="Rating pool" className="flex flex-wrap gap-1.5">
          {POOLS.map((option) => (
            <Button
              key={option.value}
              size="xs"
              variant={option.value === pool ? "default" : "outline"}
              aria-pressed={option.value === pool}
              onClick={() => setPool(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      {history === undefined ? (
        <Skeleton className="h-18 w-full" />
      ) : values.length < 2 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          Not enough rated games yet to draw a line.
        </p>
      ) : (
        <div className="grid gap-1">
          <Sparkline values={values} />
          <p className="text-xs text-muted-foreground tabular-nums">
            {formatRating(values[0])} → {formatRating(values[values.length - 1])} (
            {formatRatingDelta(net)}) over {history.length} rated{" "}
            {history.length === 1 ? "game" : "games"}
          </p>
        </div>
      )}
    </section>
  );
}
