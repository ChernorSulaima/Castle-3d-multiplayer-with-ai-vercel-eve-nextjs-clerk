"use client";

import Link from "next/link";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRating, pluralize } from "@/lib/format";
import type { LiveGameSummary } from "@/lib/types";

const TICKER_LIMIT = 12;

function GameChip({ game }: { game: LiveGameSummary }) {
  return (
    <span className="flex items-center gap-2 whitespace-nowrap">
      <span className="font-medium">{game.whiteName}</span>
      <span className="text-muted-foreground/70 tabular-nums">{formatRating(game.whiteRating)}</span>
      <span className="text-muted-foreground/50">vs</span>
      <span className="font-medium">{game.blackName}</span>
      <span className="text-muted-foreground/70 tabular-nums">{formatRating(game.blackRating)}</span>
      <span className="text-muted-foreground/50">·</span>
      <span className="text-muted-foreground/70 tabular-nums">
        {pluralize(game.moveCount, "move")}
      </span>
      {game.spectatorCount > 0 ? (
        <span className="text-muted-foreground/70 tabular-nums">
          · {pluralize(game.spectatorCount, "watcher")}
        </span>
      ) : null}
    </span>
  );
}

/**
 * FR-8 / the landing ticker. `games.listLive` is a public query, so this renders
 * for guests too; only the links are gated, because `/game/[id]` is behind the
 * proxy and a guest click would bounce through `/sign-in`.
 */
export function LiveTicker() {
  const { isAuthenticated } = useConvexAuth();
  const games = useQuery(api.games.listLive, { limit: TICKER_LIMIT });

  return (
    <section
      aria-label="Games in progress"
      className="border-y border-border/60 bg-muted/30"
    >
      <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
        <span className="flex shrink-0 items-center gap-2 text-xs font-medium tracking-wide uppercase">
          <span
            aria-hidden
            className="size-2 rounded-full bg-emerald-500 motion-safe:animate-pulse"
          />
          Live
        </span>

        <div className="min-w-0 flex-1 overflow-x-auto no-scrollbar">
          {games === undefined ? (
            <div className="flex items-center gap-6">
              <Skeleton className="h-4 w-56" />
              <Skeleton className="h-4 w-56" />
            </div>
          ) : games.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No games in progress right now — start one and you will be first on the board.
            </p>
          ) : (
            <ul className="flex items-center gap-6 text-sm">
              {games.map((game) =>
                isAuthenticated ? (
                  <li key={game._id}>
                    <Link
                      href={`/game/${game._id}`}
                      className="rounded-sm transition-opacity hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                      <GameChip game={game} />
                    </Link>
                  </li>
                ) : (
                  <li key={game._id}>
                    <GameChip game={game} />
                  </li>
                ),
              )}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
