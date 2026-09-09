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
  /** Ply rendered by the previous `sync`, or null when nothing has been rendered. */
  private lastPly: number | null = null;

  reset(): void {
    this.slots.clear();
    this.seq = 0;
    this.lastPly = null;
  }

  /**
   * Produce the piece list for `fen`, which is the position after `ply` half-moves.
   *
   * Only an ADJACENT step has one move that explains the transition, and the
   * direction decides which move that is: stepping FORWARD to `ply` it is the move
   * ending at `ply`; stepping BACKWARD to `ply` it is the move ending at `ply + 1`,
   * replayed in reverse. Every other transition (first render, a review jump, a
   * take-back) re-derives ids — those are not animated (§E.8.6).
   *
   * `moveEndingAt` is called at most once and only for an adjacent step, so the
   * caller may replay the game inside it.
   */
  sync(
    fen: string,
    ply: number,
    moveEndingAt: (ply: number) => LastMove | null,
  ): BoardPiece[] {
    const previousPly = this.lastPly;
    this.lastPly = ply;

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

    // `reverse` is true when the move is being un-played, i.e. it is carrying the
    // pieces from their destination squares back to their origins.
    const applyMove = (move: LastMove | null, reverse: boolean) => {
      if (!move) return;
      const rook = CASTLE_ROOK[`${move.from}${move.to}`];
      const castled = rook !== undefined && move.san.startsWith("O-O");
      if (reverse) {
        carry(move.to, move.from);
        if (castled) carry(rook.to, rook.from);
        return;
      }
      carry(move.from, move.to);
      if (castled) carry(rook.from, rook.to);
    };

    if (previousPly !== null && ply === previousPly + 1) {
      applyMove(moveEndingAt(ply), false);
    } else if (previousPly !== null && ply === previousPly - 1) {
      applyMove(moveEndingAt(previousPly), true);
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
