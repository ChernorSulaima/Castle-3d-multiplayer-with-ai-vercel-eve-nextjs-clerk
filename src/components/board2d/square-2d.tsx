"use client";
// src/components/board2d/square-2d.tsx  [P3]
// One board square: colour, highlights, coordinates and the click/keyboard target.
// It is a `gridcell` inside the board's `grid`/`row` structure (NFR-7).
import { cn } from "@/lib/utils";
import type { SquareId } from "@/lib/types";

export interface Square2DProps {
  square: SquareId;
  light: boolean;
  /** Custom room colours (FR-21j); null falls back to the --board-* tokens. */
  colour: string | null;
  selected: boolean;
  legal: boolean;
  capture: boolean;
  lastMove: boolean;
  check: boolean;
  /** The roving-tabindex cursor (only one square in the board is tabbable). */
  cursor: boolean;
  label: string;
  fileLabel: string | null;
  rankLabel: string | null;
  disabled: boolean;
  onSelect(square: SquareId): void;
  onFocusSquare(square: SquareId): void;
}

export function Square2D({
  square,
  light,
  colour,
  selected,
  legal,
  capture,
  lastMove,
  check,
  cursor,
  label,
  fileLabel,
  rankLabel,
  disabled,
  onSelect,
  onFocusSquare,
}: Square2DProps) {
  return (
    <div
      role="gridcell"
      data-square={square}
      aria-label={label}
      aria-selected={selected}
      aria-disabled={disabled || undefined}
      tabIndex={cursor ? 0 : -1}
      onClick={() => onSelect(square)}
      onFocus={() => onFocusSquare(square)}
      className={cn(
        "relative touch-manipulation outline-none select-none",
        colour === null && (light ? "bg-board-light" : "bg-board-dark"),
        !disabled && "cursor-pointer",
        "focus-visible:z-20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
      )}
      style={colour === null ? undefined : { backgroundColor: colour }}
    >
      {/* last move (FR-16) */}
      {lastMove ? (
        <span className="pointer-events-none absolute inset-0 bg-board-last/45" aria-hidden />
      ) : null}
      {/* selection (FR-16) */}
      {selected ? (
        <span
          className="pointer-events-none absolute inset-0 bg-board-select/55 ring-2 ring-board-select ring-inset"
          aria-hidden
        />
      ) : null}
      {/* king in check */}
      {check ? (
        <span
          className="pointer-events-none absolute inset-0 bg-board-check/55 ring-2 ring-board-check ring-inset"
          aria-hidden
        />
      ) : null}
      {/* legal destination: dot for a quiet move, ring for a capture */}
      {legal && !capture ? (
        <span
          className="pointer-events-none absolute top-1/2 left-1/2 h-[28%] w-[28%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-board-legal/80"
          aria-hidden
        />
      ) : null}
      {legal && capture ? (
        <span
          className="pointer-events-none absolute inset-[8%] rounded-full ring-[4px] ring-board-capture/85 ring-inset"
          aria-hidden
        />
      ) : null}
      {/* coordinates (FR-16) */}
      {rankLabel ? (
        <span
          className="pointer-events-none absolute top-0.5 left-1 text-[clamp(7px,1.4vw,11px)] leading-none font-medium text-foreground/55 tabular-nums"
          aria-hidden
        >
          {rankLabel}
        </span>
      ) : null}
      {fileLabel ? (
        <span
          className="pointer-events-none absolute right-1 bottom-0.5 text-[clamp(7px,1.4vw,11px)] leading-none font-medium text-foreground/55"
          aria-hidden
        >
          {fileLabel}
        </span>
      ) : null}
    </div>
  );
}
