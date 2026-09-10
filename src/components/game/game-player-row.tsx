"use client";
// src/components/game/game-player-row.tsx  [U2]
// UI_REDESIGN §5.1: "Player rows: avatar 32, name, rating in mono, a --live dot +
// 'to move' label on the side to move; captured pieces tray inline on the right of
// each row (glyphs + material diff in mono)." 48px tall, one per side.
import { WifiOffIcon } from "lucide-react";
import { PlayerChip } from "@/components/ui-kit";
import { cn } from "@/lib/ui";
import type { CapturedPieces, Colour, PlayerSummary } from "@/lib/types";
import { CapturedTray } from "./captured-tray";

export interface GamePlayerRowProps extends React.ComponentProps<"div"> {
  name: string;
  player: PlayerSummary | null;
  colour: Colour;
  toMove: boolean;
  captured: CapturedPieces;
  /** e.g. "AI · Beginner", "Player 2". */
  subtitle?: React.ReactNode;
  /** Only ever true for the opponent in an online game (FR-32). */
  stale?: boolean;
  /** Slot on the right of the row, before the tray — the status pill sits here. */
  children?: React.ReactNode;
}

export function GamePlayerRow({
  name,
  player,
  colour,
  toMove,
  captured,
  subtitle,
  stale = false,
  className,
  children,
  ...props
}: GamePlayerRowProps) {
  return (
    <div
      className={cn(
        "flex min-h-12 shrink-0 items-center gap-3 px-1 py-1.5 sm:px-2",
        className,
      )}
      {...props}
    >
      <PlayerChip
        name={name}
        avatarUrl={player?.avatarUrl ?? null}
        rating={player?.rating ?? null}
        side={colour}
        toMove={toMove}
        subtitle={subtitle}
        className="min-w-0 shrink"
      />

      {stale ? (
        <span
          role="status"
          className="hidden shrink-0 items-center gap-1.5 rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[12px] text-destructive sm:inline-flex"
        >
          <WifiOffIcon className="size-3.5" aria-hidden />
          May have disconnected
        </span>
      ) : null}

      {children}

      <CapturedTray captured={captured} colour={colour} className="ml-auto justify-end" />
    </div>
  );
}
