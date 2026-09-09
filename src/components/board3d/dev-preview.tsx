// src/components/board3d/dev-preview.tsx
// Development-only harness for /dev/board3d. It fabricates a `BoardViewProps` from a
// local chess.js position and a local PieceTracker so the whole 3D package can be driven
// in a browser with no Clerk session, no Convex deployment and no game controller.
// Nothing here ships to production — the route calls notFound() outside development.
"use client";
import { useCallback, useState } from "react";
import { Chess } from "chess.js";
import { Button } from "@/components/ui/button";
import { CAMERA_FLIP_MS } from "@/lib/constants";
import { capturedFromMoves, checkSquareOf, fenAtPly, lastMoveAtPly, legalTargetsFor, needsPromotion } from "@/lib/chess";
import { PieceTracker } from "@/lib/piece-tracker";
import { ROOM_ORDER } from "@/lib/rooms";
import { useUiStore } from "@/lib/stores/ui-store";
import type {
  BoardPiece,
  CapturedPieces,
  Colour,
  LastMove,
  PromotionPiece,
  PromotionPrompt,
  QualityTier,
  RoomPresetId,
  SquareId,
} from "@/lib/types";
import { Board3DLoader } from "./board-3d-loader";

const SCRIPTS: Record<string, string[]> = {
  // Ruy Lopez with a queen trade — exercises slides, captures and the tray.
  "Long game": [
    "d4", "d5", "c4", "e6", "Nc3", "Nf6", "Bg5", "Be7", "e3", "O-O", "Nf3", "h6", "Bh4", "b6",
    "cxd5", "Nxd5", "Bxe7", "Qxe7", "Nxd5", "exd5", "Rc1", "Be6", "Qa4", "c5", "Qa3", "Rc8",
    "Bb5", "a6", "dxc5", "bxc5", "O-O", "Ra7", "Be2", "Nd7", "Nd4", "Qf8", "Nxe6", "fxe6",
  ],
  // Scholar's mate — the fastest way to see the check and checkmate indicators.
  "Quick mate": ["e4", "e5", "Bc4", "Nc6", "Qh5", "Nf6", "Qxf7#"],
};

const SCRIPT_NAMES = Object.keys(SCRIPTS);
const ROOM_CHOICES: RoomPresetId[] = [...ROOM_ORDER, "custom"];
const TIER_CHOICES: QualityTier[] = ["auto", "low", "medium", "high"];

interface DevBoardState {
  moves: string[];
  fen: string;
  position: BoardPiece[];
  lastMove: LastMove | null;
  turn: Colour;
  checkSquare: SquareId | null;
  captured: CapturedPieces;
}

function buildState(tracker: PieceTracker, moves: string[], jumped: boolean): DevBoardState {
  if (jumped) tracker.reset();
  const fen = fenAtPly(moves, moves.length);
  const lastMove = jumped ? null : lastMoveAtPly(moves, moves.length);
  return {
    moves,
    fen,
    position: tracker.sync(fen, moves.length, (ply) => lastMoveAtPly(moves, ply)),
    lastMove,
    turn: new Chess(fen).turn(),
    checkSquare: checkSquareOf(fen),
    captured: capturedFromMoves(moves),
  };
}

export function Board3DDevPreview() {
  const [tracker] = useState(() => new PieceTracker());
  const [state, setState] = useState<DevBoardState>(() => buildState(tracker, [], true));
  const [scriptName, setScriptName] = useState(SCRIPT_NAMES[0]);
  const [selected, setSelected] = useState<SquareId | null>(null);
  const [promotion, setPromotion] = useState<PromotionPrompt | null>(null);
  const [orientation, setOrientation] = useState<Colour>("w");
  const [flipping, setFlipping] = useState(false);
  const [interactive, setInteractive] = useState(true);

  const roomPreset = useUiStore((s) => s.roomPreset);
  const qualityTier = useUiStore((s) => s.qualityTier);
  const resolvedTier = useUiStore((s) => s.resolvedTier);
  const postFxEnabled = useUiStore((s) => s.postFxEnabled);
  const reducedMotion = useUiStore((s) => s.reducedMotion);
  const cameraPreset = useUiStore((s) => s.cameraPreset);

  const applyMove = useCallback(
    (from: SquareId, to: SquareId, promotionPiece?: PromotionPiece) => {
      setState((current) => {
        const chess = new Chess(current.fen);
        try {
          const move = chess.move({ from, to, promotion: promotionPiece });
          return buildState(tracker, [...current.moves, move.san], false);
        } catch {
          return current;
        }
      });
      setSelected(null);
      setPromotion(null);
    },
    [tracker],
  );

  const onSquareSelect = useCallback(
    (square: SquareId) => {
      setSelected((current) => {
        if (current === square) return null;
        if (current) {
          const targets = legalTargetsFor(state.fen, current);
          if (targets.some((target) => target.to === square)) {
            if (needsPromotion(state.fen, current, square)) {
              setPromotion({ from: current, to: square, colour: state.turn });
              return current;
            }
            applyMove(current, square);
            return null;
          }
        }
        const piece = new Chess(state.fen).get(square);
        return piece && piece.color === state.turn ? square : null;
      });
    },
    [applyMove, state.fen, state.turn],
  );

  const playNext = useCallback(() => {
    const script = SCRIPTS[scriptName];
    setState((current) => {
      const san = script[current.moves.length];
      if (!san) return current;
      const chess = new Chess(current.fen);
      try {
        chess.move(san);
      } catch {
        return current;
      }
      return buildState(tracker, [...current.moves, san], false);
    });
    setSelected(null);
  }, [scriptName, tracker]);

  const reset = useCallback(() => {
    setState(buildState(tracker, [], true));
    setSelected(null);
    setPromotion(null);
  }, [tracker]);

  const legalTargets = selected ? legalTargetsFor(state.fen, selected) : [];

  /** Simulates the local-2P hand-over: flip the seat and freeze tweens (§E.6, NFR-10). */
  const simulateFlip = useCallback(() => {
    const next: Colour = orientation === "w" ? "b" : "w";
    setOrientation(next);
    useUiStore.getState().setCameraPreset(next === "w" ? "white" : "black");
    setFlipping(true);
    window.setTimeout(() => setFlipping(false), CAMERA_FLIP_MS);
  }, [orientation]);

  return (
    <div className="flex min-h-dvh flex-col gap-2 p-2 sm:p-4">
      <header className="flex flex-wrap items-center gap-1.5 text-xs">
        <Button size="sm" onClick={playNext}>
          Play next move ({state.moves.length}/{SCRIPTS[scriptName].length})
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            const index = SCRIPT_NAMES.indexOf(scriptName);
            setScriptName(SCRIPT_NAMES[(index + 1) % SCRIPT_NAMES.length]);
            reset();
          }}
        >
          Script: {scriptName}
        </Button>
        <Button size="sm" variant="outline" onClick={reset}>
          Reset position
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            const index = ROOM_CHOICES.indexOf(roomPreset);
            useUiStore.getState().setRoomPreset(ROOM_CHOICES[(index + 1) % ROOM_CHOICES.length]);
          }}
        >
          Room: {roomPreset}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            const index = TIER_CHOICES.indexOf(qualityTier);
            useUiStore.getState().setQualityTier(TIER_CHOICES[(index + 1) % TIER_CHOICES.length]);
          }}
        >
          Quality: {qualityTier} ({resolvedTier})
        </Button>
        <Button
          size="sm"
          variant="outline"
          aria-pressed={postFxEnabled}
          onClick={() => useUiStore.getState().setPostFxEnabled(!postFxEnabled)}
        >
          Post FX: {postFxEnabled ? "on" : "off"}
        </Button>
        <Button size="sm" variant="outline" onClick={simulateFlip}>
          Flip seat ({orientation === "w" ? "white" : "black"})
        </Button>
        <Button
          size="sm"
          variant="outline"
          aria-pressed={reducedMotion}
          onClick={() => useUiStore.getState().setReducedMotion(!reducedMotion)}
        >
          Reduced motion: {reducedMotion ? "on" : "off"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          aria-pressed={interactive}
          onClick={() => setInteractive((value) => !value)}
        >
          Interactive: {interactive ? "on" : "off"}
        </Button>
        <span className="text-muted-foreground">
          camera: {cameraPreset} · turn: {state.turn === "w" ? "white" : "black"} · selected:{" "}
          {selected ?? "none"} · targets: {legalTargets.length}
          {state.checkSquare ? ` · check on ${state.checkSquare}` : ""}
          {flipping ? " · flipping" : ""}
        </span>
      </header>

      {promotion && (
        <div className="flex items-center gap-1.5 text-xs" role="group" aria-label="Choose a promotion piece">
          <span>Promote to:</span>
          {(["q", "r", "b", "n"] as PromotionPiece[]).map((piece) => (
            <Button
              key={piece}
              size="sm"
              onClick={() => applyMove(promotion.from, promotion.to, piece)}
            >
              {piece.toUpperCase()}
            </Button>
          ))}
          <Button size="sm" variant="ghost" onClick={() => setPromotion(null)}>
            Cancel
          </Button>
        </div>
      )}

      {/* `absolute inset-0` inside a sized flex child gives the Canvas a definite
          height — r3f measures its wrapper and a percentage chain that bottoms out in
          `height: auto` collapses to the 300x150 canvas default. */}
      <main className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-border">
        <div className="absolute inset-0">
        <Board3DLoader
          fen={state.fen}
          position={state.position}
          orientation={orientation}
          turn={state.turn}
          interactive={interactive && !flipping}
          animate={!reducedMotion && !flipping}
          selectedSquare={selected}
          legalTargets={legalTargets}
          lastMove={state.lastMove}
          checkSquare={state.checkSquare}
          captured={state.captured}
          promotion={promotion}
          reviewPly={null}
          onSquareSelect={onSquareSelect}
          onMove={(from, to) => applyMove(from, to)}
          onPromotionChoice={(piece) =>
            promotion && piece ? applyMove(promotion.from, promotion.to, piece) : setPromotion(null)
          }
          onDeselect={() => setSelected(null)}
          onRenderFailure={(reason) => console.warn("[dev/board3d] render failure:", reason)}
        />
        </div>
      </main>
    </div>
  );
}
