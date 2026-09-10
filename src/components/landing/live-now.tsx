"use client";
// src/components/landing/live-now.tsx  [UI upgrade 2 §2.4]
// "Games in progress." — the club's own room, shown as boards rather than rows.
// `games.listLive` is a public query so this renders for guests too; `games.get`
// (the position) requires an identity, so a signed-out visitor sees the tiles,
// the players and the move counts, and is told plainly that the positions and
// the games themselves are behind the door.
import Link from "next/link";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { BoardTile, Display, PlayerChip, Podium, Section } from "@/components/ui-kit";
import { Skeleton } from "@/components/ui/skeleton";
import { buttonVariants } from "@/components/ui/button";
import { cn, focusRing } from "@/lib/ui";
import type { LiveGameSummary, SquareId } from "@/lib/types";

const LIVE_LIMIT = 6;
const TOP_LIMIT = 5;

function profileHref(username: string): string {
  return `/profile/${encodeURIComponent(username)}`;
}

/** One subscription per tile for the position — the same trade the lobby makes. */
function LiveTile({ game, canWatch }: { game: LiveGameSummary; canWatch: boolean }) {
  const view = useQuery(
    api.games.get,
    canWatch ? { gameId: game._id as Id<"games"> } : "skip",
  );
  const doc = view?.game;
  const last = doc?.lastMove;

  return (
    <BoardTile
      canWatch={canWatch}
      game={{
        _id: game._id,
        whiteName: game.whiteName,
        blackName: game.blackName,
        whiteRating: game.whiteRating,
        blackRating: game.blackRating,
        moveCount: game.moveCount,
        spectatorCount: game.spectatorCount,
      }}
      fen={canWatch ? doc?.fen : null}
      lastMove={
        last === undefined || last === null
          ? null
          : { from: last.from as SquareId, to: last.to as SquareId }
      }
    />
  );
}

export function LiveNow() {
  const { isAuthenticated } = useConvexAuth();
  const games = useQuery(api.games.listLive, { limit: LIVE_LIMIT });
  const top = useQuery(api.leaderboard.top, { filter: "all", limit: TOP_LIMIT });
  const empty = games !== undefined && games.length === 0;

  return (
    <Section
      id="live-now"
      padding="none"
      className="scroll-mt-20 py-8 sm:py-12"
      aria-labelledby="live-now-heading"
    >
      <Display level={3} as="h2" id="live-now-heading">
        Games in progress.
      </Display>

      {/* On a quiet day the left column is one line of text; beside a 530px "Top
          rated" aside that left ~400px of empty column with a full-height hairline
          down the middle of nothing. When there is nothing to show, the section is
          one column and the note sits above the aside as a full-width line. */}
      <div
        className={cn(
          "mt-10 grid gap-10 lg:gap-10",
          empty ? null : "lg:grid-cols-[minmax(0,1fr)_20rem]",
        )}
      >
        <div>
          {games === undefined ? (
            <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3" aria-busy>
              {[0, 1, 2].map((i) => (
                <li key={i} className="p-2">
                  <Skeleton className="h-5 w-32 rounded-full" />
                  <Skeleton className="mt-2.5 aspect-square w-full rounded-md" />
                  <Skeleton className="mt-2.5 h-5 w-32 rounded-full" />
                </li>
              ))}
            </ul>
          ) : games.length === 0 ? (
            <p className="text-[15px] text-muted-foreground">
              No live games right now. Start one and it will show up here.
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
              {games.map((game) => (
                <LiveTile key={game._id} game={game} canWatch={isAuthenticated} />
              ))}
            </ul>
          )}

          {games !== undefined && games.length > 0 && !isAuthenticated ? (
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                prefetch={false}
                href="/sign-in"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "h-10 cursor-pointer px-4 transition-colors duration-(--dur-micro)",
                )}
              >
                Sign in to watch
              </Link>
              <p className="text-[13px] text-muted-foreground">
                Positions and live boards open once you are in.
              </p>
            </div>
          ) : null}
        </div>

        <aside
          aria-labelledby="top-players"
          className={cn(empty ? "lg:max-w-80" : "lg:border-l lg:border-border lg:pl-10")}
        >
          <h3 id="top-players" className="text-[1.25rem] leading-tight font-semibold text-foreground">
            Top rated
          </h3>

          {top === undefined ? (
            <ul className="mt-5 flex flex-col gap-2.5" aria-busy>
              {[0, 1, 2, 3, 4].map((i) => (
                <li key={i}>
                  <Skeleton className="h-12 w-full rounded-xl" />
                </li>
              ))}
            </ul>
          ) : top.length === 0 ? (
            <p className="mt-5 text-[13px] text-muted-foreground">
              Nobody has played a rated game yet. The first one is yours.
            </p>
          ) : (
            <>
              <Podium
                // One column in a 20rem aside: the 2 · 1 · 3 shape only makes
                // sense across three columns, so the stack layout drops it.
                layout="stack"
                className="mt-5 sm:items-stretch"
                entries={top.slice(0, 3).map((row) => ({
                  rank: row.rank,
                  name: row.username,
                  rating: row.rating,
                  avatarUrl: row.avatarUrl,
                }))}
                renderName={(entry) => (
                  <Link
                    prefetch={false}
                    href={profileHref(entry.name)}
                    className={cn(
                      "inline-flex min-h-9 items-center rounded-sm px-2 hover:text-primary",
                      focusRing,
                    )}
                  >
                    {entry.name}
                  </Link>
                )}
              />

              {top.length > 3 ? (
                <ol className="mt-4 divide-y divide-border border-t border-border">
                  {top.slice(3).map((row) => (
                    <li key={row.playerId} className="flex items-center gap-3 py-2.5">
                      <span className="tabular w-4 shrink-0 font-mono text-[13px] text-muted-foreground">
                        {row.rank}
                      </span>
                      <Link
                        prefetch={false}
                        href={profileHref(row.username)}
                        className={cn(
                          "flex min-h-9 min-w-0 flex-1 items-center rounded-sm hover:text-primary",
                          focusRing,
                        )}
                      >
                        <PlayerChip
                          size="sm"
                          name={row.username}
                          avatarUrl={row.avatarUrl || null}
                          rating={row.rating}
                          className="min-w-0"
                        />
                      </Link>
                    </li>
                  ))}
                </ol>
              ) : null}
            </>
          )}

          <Link
            prefetch={false}
            href="/leaderboard"
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "mt-5 h-10 w-full cursor-pointer px-4 transition-colors duration-(--dur-micro)",
            )}
          >
            See the leaderboard
          </Link>
        </aside>
      </div>
    </Section>
  );
}
