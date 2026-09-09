"use client";
// src/components/game/captured-tray.tsx  [P3]
// FR-16 captured pieces + material count. The 3D scene has its own tray (P4);
// this one belongs to the 2D layout and the side panel.
import { PIECE_VALUES } from "@/lib/constants";
import { formatMaterialAdvantage } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CapturedPieces, Colour, PieceSymbol } from "@/lib/types";
import { PieceGlyph, pieceName } from "@/components/board2d/pieces-svg";

const ORDER: PieceSymbol[] = ["q", "r", "b", "n", "p"];

export interface CapturedTrayProps {
  captured: CapturedPieces;
  /** The side whose captures are shown. */
  colour: Colour;
  className?: string;
}

export function CapturedTray({ captured, colour, className }: CapturedTrayProps) {
  const taken = [...captured[colour]].sort(
    (a, b) => PIECE_VALUES[b] - PIECE_VALUES[a] || ORDER.indexOf(a) - ORDER.indexOf(b),
  );
  const advantage = formatMaterialAdvantage(captured, colour);
  const opponent: Colour = colour === "w" ? "b" : "w";

  return (
    <div
      className={cn("flex min-h-6 flex-wrap items-center gap-0.5", className)}
      aria-label={`Pieces captured by ${colour === "w" ? "white" : "black"}`}
    >
      {taken.map((type, index) => (
        <PieceGlyph
          key={`${type}-${index}`}
          type={type}
          colour={opponent}
          className="h-5 w-5 shrink-0"
          title={index === 0 ? pieceName(type, opponent) : undefined}
        />
      ))}
      {advantage ? (
        <span className="ml-1 text-xs font-medium text-muted-foreground tabular-nums">
          {advantage}
        </span>
      ) : null}
    </div>
  );
}
