"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatColour,
  formatDate,
  formatMode,
  formatOutcome,
  outcomeFor,
  pluralize,
  type ResultOutcome,
} from "@/lib/format";
import { DIFFICULTIES } from "@/lib/difficulty";

const RECENT_LIMIT = 25;

const OUTCOME_VARIANT: Record<ResultOutcome, "default" | "secondary" | "outline" | "destructive"> =
  {
    win: "default",
    loss: "destructive",
    draw: "secondary",
    ongoing: "outline",
  };

/** FR-53. Every row links to `/game/[id]`, which opens finished games in review. */
export function RecentGamesTable({ username }: { username: string }) {
  const games = useQuery(api.games.gamesForProfile, { username, limit: RECENT_LIMIT });

  return (
    <section aria-label="Recent games" className="grid gap-3">
      <h2 className="text-sm font-semibold">Recent games</h2>

      {games === undefined ? (
        <div className="grid gap-2" aria-busy>
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : games.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          No games played yet.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Result</TableHead>
              <TableHead>Opponent</TableHead>
              <TableHead className="whitespace-nowrap">Mode</TableHead>
              <TableHead className="text-right">Moves</TableHead>
              <TableHead className="whitespace-nowrap">Date</TableHead>
              <TableHead className="text-right">
                <span className="sr-only">Open</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {games.map((game) => {
              const outcome = outcomeFor(game.status, game.winner, game.myColour);
              return (
                <TableRow key={game._id}>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant={OUTCOME_VARIANT[outcome]}>
                        {formatOutcome(outcome)}
                      </Badge>
                      {!game.rated ? <Badge variant="outline">Unrated</Badge> : null}
                      {game.undoCount > 0 ? (
                        <Badge variant="outline">
                          {pluralize(game.undoCount, "take-back")}
                        </Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-40 truncate font-medium">
                    {game.opponentName}
                    {game.myColour !== null ? (
                      <span className="text-muted-foreground">
                        {" "}
                        · as {formatColour(game.myColour)}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatMode(game.mode)}
                    {game.difficulty !== undefined
                      ? ` · ${DIFFICULTIES[game.difficulty].label}`
                      : ""}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{game.moveCount}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDate(game.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link prefetch={false}
                      href={`/game/${game._id}`}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      {outcome === "ongoing" ? "Open" : "Replay"}
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </section>
  );
}
