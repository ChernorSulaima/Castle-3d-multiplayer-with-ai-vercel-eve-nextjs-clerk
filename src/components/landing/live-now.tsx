"use client";
// src/components/landing/live-now.tsx  [U1]
// "LIVE NOW: live games list (Watch) + top 5 rating" (§3). It replaces the old
// marquee-ish `live-ticker.tsx` but keeps its two rules: `games.listLive` is a
// public query, so this renders for guests too, and only the links are gated —
// `/game/[id]` sits behind the proxy and a guest click would bounce through
// /sign-in.
import Link from "next/link";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Display, Eyebrow, PlayerChip, Section, StatPill } from "@/components/ui-kit";
import { Skeleton } from "@/components/ui/skeleton";
import { buttonVariants } from "@/components/ui/button";
import { pluralize } from "@/lib/format";
import { cn, focusRing } from "@/lib/ui";
import type { LiveGameSummary } from "@/lib/types";

const LIVE_LIMIT = 6;
const TOP_LIMIT = 5;

function GameRow({ game, canWatch }: { game: LiveGameSummary; canWatch: boolean }) {
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border border-border bg-card p-3 sm:flex-nowrap">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">
        <PlayerChip
          size="sm"
          side="w"
          name={game.whiteName}
          rating={game.whiteRating || null}
          className="min-w-0"
        />
        <span aria-hidden className="text-[13px] text-muted-foreground">
          vs
        </span>
        <PlayerChip
          size="sm"
          side="b"
          name={game.blackName}
          rating={game.blackRating || null}
          className="min-w-0"
        />
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <span className="tabular font-mono text-[13px] text-muted-foreground">
          {pluralize(game.moveCount, "move")}
        </span>
        {game.spectatorCount > 0 ? (
          <StatPill
            tone="live"
            dot
            value={game.spectatorCount}
            label="watching"
          />
        ) : null}
        {canWatch ? (
          <Link
            prefetch={false}
            href={`/game/${game._id}`}
            aria-label={`Watch ${game.whiteName} against ${game.blackName}`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 px-3")}
          >
            Watch
          </Link>
        ) : null}
      </div>
    </li>
  );
}

export function LiveNow() {
  const { isAuthenticated } = useConvexAuth();
  const games = useQuery(api.games.listLive, { limit: LIVE_LIMIT });
  const top = useQuery(api.leaderboard.top, { filter: "all", limit: TOP_LIMIT });

  return (
    <Section id="live-now" padding="lg" className="scroll-mt-20" aria-labelledby="live-now-heading">
      <Eyebrow>Live now</Eyebrow>
      <Display level={3} as="h2" id="live-now-heading" className="mt-2">
        Games in progress.
      </Display>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div>
          {games === undefined ? (
            <ul className="flex flex-col gap-2">
              {[0, 1, 2].map((i) => (
                <li key={i}>
                  <Skeleton className="h-[3.75rem] w-full rounded-xl" />
                </li>
              ))}
            </ul>
          ) : games.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-6 text-[15px] text-muted-foreground">
              No live games right now. Start one and it will show up here.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {games.map((game) => (
                <GameRow key={game._id} game={game} canWatch={isAuthenticated} />
              ))}
            </ul>
          )}

          {games !== undefined && games.length > 0 && !isAuthenticated ? (
            <p className="mt-3 text-[13px] text-muted-foreground">
              <Link
                prefetch={false}
                href="/sign-in"
                className={cn("text-primary underline-offset-4 hover:underline", focusRing)}
              >
                Sign in
              </Link>{" "}
              to watch a game as it happens.
            </p>
          ) : null}
        </div>

        <aside className="rounded-xl border border-border bg-card p-4" aria-labelledby="top-players">
          <h3 id="top-players" className="text-sm font-medium text-foreground">
            Top rated
          </h3>

          {top === undefined ? (
            <ul className="mt-3 flex flex-col gap-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <li key={i}>
                  <Skeleton className="h-7 w-full rounded-md" />
                </li>
              ))}
            </ul>
          ) : top.length === 0 ? (
            <p className="mt-3 text-[13px] text-muted-foreground">
              Nobody has played a rated game yet. The first one is yours.
            </p>
          ) : (
            <ol className="mt-3 flex flex-col gap-2">
              {top.map((row) => (
                <li key={row.playerId} className="flex items-center gap-3">
                  <span className="tabular w-4 shrink-0 font-mono text-[13px] text-muted-foreground">
                    {row.rank}
                  </span>
                  <PlayerChip
                    size="sm"
                    name={row.username}
                    avatarUrl={row.avatarUrl || null}
                    rating={row.rating}
                    className="min-w-0 flex-1"
                  />
                </li>
              ))}
            </ol>
          )}

          <Link
            prefetch={false}
            href="/leaderboard"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "mt-4 h-8 w-full px-3",
            )}
          >
            See the leaderboard
          </Link>
        </aside>
      </div>
    </Section>
  );
}
