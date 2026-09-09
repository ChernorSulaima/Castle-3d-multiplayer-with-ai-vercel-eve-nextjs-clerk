"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { buttonVariants } from "@/components/ui/button";
import { formatRating } from "@/lib/format";

const SPECTATE_LIMIT = 25;

/** FR-8. `games.listLive` is public and already filtered to online games. */
export function SpectateList() {
  const games = useQuery(api.games.listLive, { limit: SPECTATE_LIMIT });

  if (games === undefined) {
    return (
      <div className="grid gap-2" aria-busy>
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <p className="py-6 text-sm text-muted-foreground">
        Nobody is playing an online game right now. Start one and someone can watch you.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>White</TableHead>
          <TableHead>Black</TableHead>
          <TableHead className="text-right">Moves</TableHead>
          <TableHead className="text-right">Watching</TableHead>
          <TableHead className="text-right">
            <span className="sr-only">Open</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {games.map((game) => (
          <TableRow key={game._id}>
            <TableCell className="font-medium whitespace-nowrap">
              {game.whiteName}{" "}
              <span className="text-muted-foreground tabular-nums">
                {formatRating(game.whiteRating)}
              </span>
            </TableCell>
            <TableCell className="font-medium whitespace-nowrap">
              {game.blackName}{" "}
              <span className="text-muted-foreground tabular-nums">
                {formatRating(game.blackRating)}
              </span>
            </TableCell>
            <TableCell className="text-right tabular-nums">{game.moveCount}</TableCell>
            <TableCell className="text-right tabular-nums">{game.spectatorCount}</TableCell>
            <TableCell className="text-right">
              <Link
                href={`/game/${game._id}`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Watch
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
