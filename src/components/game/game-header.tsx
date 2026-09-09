"use client";
// src/components/game/game-header.tsx  [P3]
// The board header: both players (Clerk avatar + username + rating), the
// difficulty badge (FR-39), status, turn indicator, the 2D/3D toggle (FR-14) and
// the captured trays.
import { CircleDotIcon, WifiOffIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DIFFICULTIES } from "@/lib/difficulty";
import { formatMode, formatRating } from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  BoardView,
  CapturedPieces,
  Colour,
  GameView,
  PlayerSummary,
} from "@/lib/types";
import { BoardViewToggle } from "./board-view-toggle";
import { CapturedTray } from "./captured-tray";

export interface GameHeaderProps {
  view: GameView;
  captured: CapturedPieces;
  /** The side to move in the LIVE game, not in the reviewed position — the to-move
   *  dot and `turnLabel` describe the same thing and must never disagree. */
  turn: Colour;
  turnLabel: string;
  orientation: Colour;
  boardView: BoardView;
  webglAvailable: boolean | null;
  /** True when the opponent has not been seen for longer than the abandon window. */
  opponentStale: boolean;
  onBoardViewChange(view: BoardView): void;
}

function PlayerRow({
  name,
  player,
  colour,
  toMove,
  captured,
}: {
  name: string;
  player: PlayerSummary | null;
  colour: Colour;
  toMove: boolean;
  captured: CapturedPieces;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Avatar className="size-8 shrink-0">
        {player?.avatarUrl ? <AvatarImage src={player.avatarUrl} alt="" /> : null}
        <AvatarFallback>{name.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 truncate text-sm font-medium">
          <span
            className={cn(
              "inline-block size-2 shrink-0 rounded-full ring-1 ring-border",
              colour === "w" ? "bg-white" : "bg-neutral-800",
            )}
            aria-hidden
          />
          <span className="truncate">{name}</span>
          {player ? (
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              {formatRating(player.rating)}
            </span>
          ) : null}
          {toMove ? (
            <CircleDotIcon
              className="size-3.5 shrink-0 text-primary"
              aria-label="to move"
            />
          ) : null}
        </p>
        <CapturedTray captured={captured} colour={colour} />
      </div>
    </div>
  );
}

export function GameHeader({
  view,
  captured,
  turn,
  turnLabel,
  orientation,
  boardView,
  webglAvailable,
  opponentStale,
  onBoardViewChange,
}: GameHeaderProps) {
  const { game } = view;
  const near: Colour = orientation;
  const far: Colour = orientation === "w" ? "b" : "w";
  const nameOf = (colour: Colour) => (colour === "w" ? view.whiteName : view.blackName);
  const playerOf = (colour: Colour) => (colour === "w" ? view.white : view.black);
  const active = game.status === "active";

  return (
    <header className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{formatMode(game.mode)}</Badge>
        {game.difficulty ? (
          <Badge variant="secondary">{DIFFICULTIES[game.difficulty].label}</Badge>
        ) : null}
        {game.rated ? null : <Badge variant="ghost">Unrated</Badge>}
        <p className="text-sm text-muted-foreground" role="status">
          {active ? `${turnLabel} to move` : "Game over"}
        </p>
        {opponentStale && active ? (
          <Badge variant="destructive" className="gap-1">
            <WifiOffIcon aria-hidden />
            Opponent may have disconnected
          </Badge>
        ) : null}
        <div className="ml-auto">
          <BoardViewToggle
            value={boardView}
            webglAvailable={webglAvailable}
            onChange={onBoardViewChange}
          />
        </div>
      </div>

      <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-2">
        <PlayerRow
          name={nameOf(far)}
          player={playerOf(far)}
          colour={far}
          toMove={active && turn === far}
          captured={captured}
        />
        <PlayerRow
          name={nameOf(near)}
          player={playerOf(near)}
          colour={near}
          toMove={active && turn === near}
          captured={captured}
        />
      </div>
    </header>
  );
}
