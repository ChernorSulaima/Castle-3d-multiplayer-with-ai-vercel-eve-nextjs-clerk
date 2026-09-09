"use client";

import { Button } from "@/components/ui/button";
import type { LeaderboardFilter } from "@/lib/types";

const FILTERS: ReadonlyArray<{ value: LeaderboardFilter; label: string; hint: string }> = [
  { value: "all", label: "All", hint: "Overall rating across every mode" },
  { value: "human", label: "vs Humans", hint: "Rating from online games only" },
  { value: "ai", label: "vs AI", hint: "Rating from games against the computer" },
];

/**
 * FR-51. A toggle-button group rather than tabs: there is one table, not three
 * panels, so `aria-pressed` describes it honestly and needs no panel plumbing.
 */
export function LeaderboardFilters({
  value,
  onChange,
}: {
  value: LeaderboardFilter;
  onChange: (next: LeaderboardFilter) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Leaderboard filter"
      className="flex flex-wrap items-center gap-1.5"
    >
      {FILTERS.map((filter) => (
        <Button
          key={filter.value}
          size="sm"
          variant={filter.value === value ? "default" : "outline"}
          aria-pressed={filter.value === value}
          title={filter.hint}
          onClick={() => onChange(filter.value)}
        >
          {filter.label}
        </Button>
      ))}
    </div>
  );
}

export const FILTER_HINTS: Record<LeaderboardFilter, string> = {
  all: FILTERS[0].hint,
  human: FILTERS[1].hint,
  ai: FILTERS[2].hint,
};
