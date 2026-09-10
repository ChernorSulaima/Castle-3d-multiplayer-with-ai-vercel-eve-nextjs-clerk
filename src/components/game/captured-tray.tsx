"use client";
// src/components/game/captured-tray.tsx  [P3]
// FR-16 captured pieces + material count. The 3D scene has its own tray (P4);
// this one belongs to the 2D layout and the side panel.
import { PIECE_VALUES } from "@/lib/constants";
import { formatMaterialAdvantage } from "@/lib/format";
import { cn } from "@/lib/ui";
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
  // "" when this side is level or behind — only the player who is ahead carries
  // the number, so the pair of trays never states the same fact twice.
  const advantage = formatMaterialAdvantage(captured, colour);
  const opponent: Colour = colour === "w" ? "b" : "w";

  return (
    <div
      className={cn("flex min-h-6 flex-wrap items-center gap-0.5", className)}
      aria-label={`Pieces captured by ${colour === "w" ? "white" : "black"}`}
    >
      {/* §5.1: "glyphs + material diff in mono". 16px keeps a full tray inside the
          48px player row and pairs with the 12px micro step beside it. */}
      {taken.map((type, index) => (
        <PieceGlyph
          key={`${type}-${index}`}
          type={type}
          colour={opponent}
          className="size-4 shrink-0"
          title={index === 0 ? pieceName(type, opponent) : undefined}
        />
      ))}
      {advantage ? (
        <>
          <span
            aria-hidden
            className="tabular ml-1 font-mono text-[12px] font-medium tracking-[0.02em] text-muted-foreground"
          >
            {advantage}
          </span>
          {/* On its own "+2" is a bare number in the middle of a player row. */}
          <span className="sr-only">, {advantage.slice(1)} ahead in material</span>
        </>
      ) : null}
    </div>
  );
}
