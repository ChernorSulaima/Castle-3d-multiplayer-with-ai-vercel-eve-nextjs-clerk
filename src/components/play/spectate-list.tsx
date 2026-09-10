"use client";
// src/components/play/spectate-list.tsx  [U4]
// "Live now" (UI_REDESIGN §6): a grid of spectate cards, each with a MiniBoard
// thumbnail of the current position, both player chips, the move count and a
// Watch button.
//
// Why a per-card subscription for the position: `games.listLive` returns names,
// ratings and counts but no FEN, and its return validator is shared with the
// landing ticker (U1), so widening it is not this package's call. `games.get` is
// the existing query that carries the position, and a live game is a document
// that changes a few times a minute — a handful of extra subscriptions on a
// lobby page is the cheaper half of that trade. The grid is capped at
// LIVE_GRID_LIMIT for exactly that reason.
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { MiniBoard, PlayerChip } from "@/components/ui-kit";
import { Skeleton } from "@/components/ui/skeleton";
import { buttonVariants } from "@/components/ui/button";
import { DEFAULT_FEN } from "@/lib/constants";
import { pluralize } from "@/lib/format";
import type { SquareId } from "@/lib/types";
import { cn } from "@/lib/ui";

/** Nine cards fill three rows at the widest breakpoint and cap the subscriptions. */
export const LIVE_GRID_LIMIT = 9;

export interface SpectateGame {
  _id: string;
  whiteName: string;
  blackName: string;
  whiteRating: number;
  blackRating: number;
  moveCount: number;
  spectatorCount: number;
}

export interface SpectateCardViewProps {
  game: SpectateGame;
  /** The live position. Falls back to the opening position while it loads. */
  fen?: string;
  lastMove?: { from: SquareId; to: SquareId } | null;
}

/** Pure — the /dev/pages harness renders this with fixed positions. */
export function SpectateCardView({ game, fen, lastMove = null }: SpectateCardViewProps) {
  return (
    <li className="flex min-w-0 items-start gap-3 rounded-xl border border-border bg-card p-3">
      <MiniBoard
        fen={fen ?? DEFAULT_FEN}
        size={72}
        lastMove={lastMove}
        label={`${game.whiteName} versus ${game.blackName}, after ${pluralize(game.moveCount, "move")}`}
        className={cn(fen === undefined && "opacity-60")}
      />

      <div className="flex min-w-0 flex-1 flex-col gap-1.5 overflow-hidden">
        <PlayerChip
          name={game.whiteName}
          rating={game.whiteRating > 0 ? game.whiteRating : null}
          side="w"
          size="sm"
        />
        <PlayerChip
          name={game.blackName}
          rating={game.blackRating > 0 ? game.blackRating : null}
          side="b"
          size="sm"
        />
        <p className="tabular font-mono text-[12px] text-muted-foreground">
          {game.moveCount} moves
          {game.spectatorCount > 0 ? ` · ${game.spectatorCount} watching` : null}
        </p>
      </div>

      <Link
        prefetch={false}
        href={`/game/${game._id}`}
        aria-label={`Watch ${game.whiteName} against ${game.blackName}`}
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        Watch
      </Link>
    </li>
  );
}

function SpectateCard({ game, enabled }: { game: SpectateGame; enabled: boolean }) {
  // `games.get` requires an identity, so it stays skipped until Convex has
  // validated the session — otherwise the first render throws inside the query.
  const view = useQuery(
    api.games.get,
    enabled ? { gameId: game._id as Id<"games"> } : "skip",
  );
  const doc = view?.game;
  const last = doc?.lastMove;

  return (
    <SpectateCardView
      game={game}
      fen={doc?.fen}
      lastMove={
        last === undefined || last === null
          ? null
          : { from: last.from as SquareId, to: last.to as SquareId }
      }
    />
  );
}

export interface SpectateGridViewProps {
  games: SpectateGame[];
  /** Renders the MiniBoards from these FENs instead of subscribing (harness only). */
  positions?: Record<string, string>;
}

/** Pure grid — used directly by the /dev/pages harness. */
export function SpectateGridView({ games, positions }: SpectateGridViewProps) {
  if (games.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
        No live games right now. Start one and it will show up here.
      </p>
    );
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {games.map((game) => (
        <SpectateCardView key={game._id} game={game} fen={positions?.[game._id]} />
      ))}
    </ul>
  );
}

/** FR-8. `games.listLive` is public and already filtered to online games. */
export function SpectateList({ enabled }: { enabled: boolean }) {
  const games = useQuery(api.games.listLive, { limit: LIVE_GRID_LIMIT });

  if (games === undefined) {
    return (
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-busy>
        {Array.from({ length: 3 }, (_, i) => (
          <li key={i}>
            <Skeleton className="h-[6.5rem] w-full rounded-xl" />
          </li>
        ))}
      </ul>
    );
  }

  if (games.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
        No live games right now. Start one and it will show up here.
      </p>
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {games.map((game) => (
        <SpectateCard
          key={game._id}
          enabled={enabled}
          game={{
            _id: game._id,
            whiteName: game.whiteName,
            blackName: game.blackName,
            whiteRating: game.whiteRating,
            blackRating: game.blackRating,
            moveCount: game.moveCount,
            spectatorCount: game.spectatorCount,
          }}
        />
      ))}
    </ul>
  );
}
