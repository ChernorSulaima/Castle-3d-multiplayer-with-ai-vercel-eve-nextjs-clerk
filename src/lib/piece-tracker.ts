// src/lib/piece-tracker.ts
// FR-17: pieces must SLIDE, not pop. A FEN carries no identity, so the controller
// owns one tracker per game and re-uses ids across positions. Both boards receive
// the same `BoardPiece[]`, so 2D and 3D animate identically.
import type { BoardPiece, Colour, LastMove, PieceSymbol, SquareId } from "./types";
import { piecesFromFen } from "./chess";

type Slot = { id: string; type: PieceSymbol; colour: Colour };

const CASTLE_ROOK: Record<string, { from: SquareId; to: SquareId }> = {
  "e1g1": { from: "h1", to: "f1" },
  "e1c1": { from: "a1", to: "d1" },
  "e8g8": { from: "h8", to: "f8" },
  "e8c8": { from: "a8", to: "d8" },
};

export class PieceTracker {
  private slots = new Map<SquareId, Slot>();
  private seq = 0;

  reset(): void {
    this.slots.clear();
    this.seq = 0;
  }

  /** Produce the piece list for `fen`. Pass the move that produced it (or null
   *  when jumping to an arbitrary review ply — ids are then re-derived). */
  sync(fen: string, lastMove: LastMove | null): BoardPiece[] {
    const pieces = piecesFromFen(fen);
    const prev = this.slots;
    const next = new Map<SquareId, Slot>();
    const used = new Set<string>();
    const bySquare = new Map<SquareId, (typeof pieces)[number]>();
    for (const p of pieces) bySquare.set(p.square, p);

    const carry = (from: SquareId, to: SquareId) => {
      const slot = prev.get(from);
      const piece = bySquare.get(to);
      if (!slot || !piece || used.has(slot.id)) return;
      used.add(slot.id);
      next.set(to, { id: slot.id, type: piece.type, colour: piece.colour });
    };

    if (lastMove) {
      carry(lastMove.from, lastMove.to);
      const rook = CASTLE_ROOK[`${lastMove.from}${lastMove.to}`];
      if (rook && lastMove.san.startsWith("O-O")) carry(rook.from, rook.to);
    }

    // Pieces that did not move keep their id.
    for (const piece of pieces) {
      if (next.has(piece.square)) continue;
      const slot = prev.get(piece.square);
      if (slot && !used.has(slot.id) && slot.type === piece.type && slot.colour === piece.colour) {
        used.add(slot.id);
        next.set(piece.square, slot);
      }
    }
    // Anything left (first render, review jump, promotion into a new square) gets a fresh id.
    for (const piece of pieces) {
      if (next.has(piece.square)) continue;
      next.set(piece.square, { id: `p${++this.seq}`, type: piece.type, colour: piece.colour });
    }

    this.slots = next;
    return pieces.map((p) => {
      const slot = next.get(p.square)!;
      return { id: slot.id, square: p.square, type: p.type, colour: p.colour };
    });
  }
}
