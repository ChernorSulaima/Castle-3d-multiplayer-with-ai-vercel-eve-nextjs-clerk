"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FILTER_HINTS,
  LeaderboardFilters,
} from "@/components/leaderboard/leaderboard-filters";
import { LEADERBOARD_SIZE } from "@/lib/constants";
import { formatRating, formatRecord, formatWinRate } from "@/lib/format";
import type { LeaderboardFilter } from "@/lib/types";

function initials(username: string): string {
  return username.slice(0, 2).toUpperCase();
}

/** FR-50 / FR-52: top 100, live via subscription, three rating pools. */
export function LeaderboardTable() {
  const [filter, setFilter] = useState<LeaderboardFilter>("all");
  const rows = useQuery(api.leaderboard.top, { filter, limit: LEADERBOARD_SIZE });

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <LeaderboardFilters value={filter} onChange={setFilter} />
        <p className="text-xs text-muted-foreground">{FILTER_HINTS[filter]}</p>
      </div>

      {rows === undefined ? (
        <div className="grid gap-2" aria-busy>
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No rated players yet. Win a game and the board is yours.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12 text-right">#</TableHead>
              <TableHead>Player</TableHead>
              <TableHead className="text-right">Rating</TableHead>
              <TableHead className="text-right whitespace-nowrap">Record</TableHead>
              <TableHead className="text-right">Win rate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.playerId}>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {row.rank}
                </TableCell>
                <TableCell>
                  <Link
                    href={`/profile/${encodeURIComponent(row.username)}`}
                    className="flex items-center gap-2.5 rounded-md font-medium transition-opacity hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    <Avatar size="sm">
                      <AvatarImage src={row.avatarUrl} alt="" />
                      <AvatarFallback>{initials(row.username)}</AvatarFallback>
                    </Avatar>
                    <span className="truncate">{row.username}</span>
                  </Link>
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatRating(row.rating)}
                </TableCell>
                <TableCell className="text-right tabular-nums whitespace-nowrap text-muted-foreground">
                  {formatRecord(row)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {formatWinRate(row)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
