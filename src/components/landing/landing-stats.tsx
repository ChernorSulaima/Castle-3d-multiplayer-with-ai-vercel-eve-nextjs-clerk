"use client";
// src/components/landing/landing-stats.tsx  [U1]
// "● 14 playing now · 1,204 games" (§3), from the public `stats.landing` query.
// Both numbers are capped reads (see convex/stats.ts): at the cap the second one
// prints "1,000+" rather than a number that would quietly stop being true.
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { StatPill } from "@/components/ui-kit";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/ui";

/** Keep in step with `GAMES_PLAYED_CAP` in convex/stats.ts. */
const GAMES_PLAYED_CAP = 1000;

function formatGamesPlayed(count: number): string {
  return count >= GAMES_PLAYED_CAP
    ? `${GAMES_PLAYED_CAP.toLocaleString("en-US")}+`
    : count.toLocaleString("en-US");
}

export function LandingStats({ className }: { className?: string }) {
  const stats = useQuery(api.stats.landing, {});

  return (
    <div className={cn("flex h-7 flex-wrap items-center gap-2", className)}>
      {stats === undefined ? (
        <>
          <Skeleton className="h-7 w-32 rounded-full" />
          <Skeleton className="h-7 w-28 rounded-full" />
        </>
      ) : (
        <>
          <StatPill
            tone={stats.playingNow > 0 ? "live" : "default"}
            dot
            value={stats.playingNow.toLocaleString("en-US")}
            label="playing now"
          />
          <StatPill value={formatGamesPlayed(stats.gamesPlayed)} label="games played" />
        </>
      )}
    </div>
  );
}
