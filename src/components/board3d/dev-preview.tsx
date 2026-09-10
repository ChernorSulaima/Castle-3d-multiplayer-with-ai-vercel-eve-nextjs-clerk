// src/components/board3d/dev-preview.tsx
// Development-only harness for /dev/board3d. It fabricates a `BoardViewProps` from a
// local chess.js position and a local PieceTracker so the whole 3D package can be driven
// in a browser with no Clerk session, no Convex deployment and no game controller.
// Nothing here ships to production — the route calls notFound() outside development.
//
// It also exercises the §10.4 showcase contract: the toggle swaps the board into
// showcase mode, the second section below the board proves the off-screen frameloop
// pause (the fps read-out in the header stops), and the header reports the
// `onFirstFrame` callback the landing hero fades itself in with.
"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import { Button } from "@/components/ui/button";
import { CAMERA_FLIP_MS } from "@/lib/constants";
import { capturedFromMoves, checkSquareOf, fenAtPly, lastMoveAtPly, legalTargetsFor, needsPromotion } from "@/lib/chess";
import { PieceTracker } from "@/lib/piece-tracker";
import { ROOM_ORDER } from "@/lib/rooms";
import { useUiStore } from "@/lib/stores/ui-store";
import { cn } from "@/lib/ui";
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
import type { Board3DShowcase } from "./showcase";

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
/** No "custom" here: a showcase room without colours is just Minimal twice. */
const SHOWCASE_ROOMS: RoomPresetId[] = [...ROOM_ORDER];
/** No report for this long means the render loop is not running. */
const FPS_STALE_MS = 900;

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

  /* ------------------------------------------------- §10.4 showcase mode */
  const [showcaseOn, setShowcaseOn] = useState(false);
  const [showcaseRoom, setShowcaseRoom] = useState<RoomPresetId>("study");
  const [showControls, setShowControls] = useState(false);
  const [pauseOffscreen, setPauseOffscreen] = useState(true);
  const [fps, setFps] = useState<number | null>(null);
  const [fpsStale, setFpsStale] = useState(true);
  const [firstFrameMs, setFirstFrameMs] = useState<number | null>(null);
  const lastFrameReport = useRef(0);
  const mountedAt = useRef(0);
  useEffect(() => {
    mountedAt.current = performance.now();
  }, []);

  const onFrameRate = useCallback((value: number) => {
    lastFrameReport.current = performance.now();
    setFps(value);
    setFpsStale(false);
  }, []);

  const onFirstFrame = useCallback(() => {
    setFirstFrameMs(Math.round(performance.now() - mountedAt.current));
  }, []);

  // The sampler is silent while the loop is paused, so staleness is what proves the
  // pause. Returning the previous value keeps React from re-rendering four times a
  // second while nothing has changed.
  useEffect(() => {
    const id = window.setInterval(() => {
      setFpsStale((previous) => {
        const stale = performance.now() - lastFrameReport.current > FPS_STALE_MS;
        return stale === previous ? previous : stale;
      });
    }, 250);
    return () => window.clearInterval(id);
  }, []);

  const roomPreset = useUiStore((s) => s.roomPreset);
  const qualityTier = useUiStore((s) => s.qualityTier);
  const resolvedTier = useUiStore((s) => s.resolvedTier);
  const postFxEnabled = useUiStore((s) => s.postFxEnabled);
  const reducedMotion = useUiStore((s) => s.reducedMotion);
  const cameraPreset = useUiStore((s) => s.cameraPreset);
  // FR-24 lives on this flag, not on the preset: any interaction with the GAME board
  // clears it while `cameraPreset` stays "cinematic". Showing it makes the difference
  // between the game board and a showcase board visible in the harness.
  const cinematic = useUiStore((s) => s.cinematic);

  /**
   * The §10.4 prop. Tier and post FX are read from the store and PASSED IN — in
   * showcase mode the board never reads the store itself, so this is what keeps the
   * Quality / Post FX buttons above meaningful.
   */
  const showcase: Board3DShowcase | undefined = useMemo(
    () =>
      showcaseOn
        ? {
            roomPreset: showcaseRoom,
            cameraPreset: "cinematic",
            tier: resolvedTier,
            postFx: postFxEnabled,
            hideControls: !showControls,
            pauseWhenOffscreen: pauseOffscreen,
          }
        : undefined,
    [pauseOffscreen, postFxEnabled, resolvedTier, showControls, showcaseOn, showcaseRoom],
  );

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
      <header className="sticky top-14 z-20 -mx-2 flex flex-wrap items-center gap-1.5 border-b border-border bg-background/90 px-2 py-2 text-xs backdrop-blur-sm sm:-mx-4 sm:px-4">
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

        <Button
          size="sm"
          variant={showcaseOn ? "default" : "outline"}
          aria-pressed={showcaseOn}
          onClick={() => setShowcaseOn((value) => !value)}
        >
          Showcase: {showcaseOn ? "on" : "off"}
        </Button>
        {showcaseOn && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const index = SHOWCASE_ROOMS.indexOf(showcaseRoom);
                setShowcaseRoom(SHOWCASE_ROOMS[(index + 1) % SHOWCASE_ROOMS.length]);
              }}
            >
              Showcase room: {showcaseRoom}
            </Button>
            <Button
              size="sm"
              variant="outline"
              aria-pressed={showControls}
              onClick={() => setShowControls((value) => !value)}
            >
              Overlay: {showControls ? "shown" : "hidden"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              aria-pressed={pauseOffscreen}
              onClick={() => setPauseOffscreen((value) => !value)}
            >
              Pause offscreen: {pauseOffscreen ? "on" : "off"}
            </Button>
          </>
        )}

        <span className="text-muted-foreground">
          camera: {cameraPreset} (orbit {cinematic ? "on" : "off"}) · turn:{" "}
          {state.turn === "w" ? "white" : "black"} · selected:{" "}
          {selected ?? "none"} · targets: {legalTargets.length}
          {state.checkSquare ? ` · check on ${state.checkSquare}` : ""}
          {flipping ? " · flipping" : ""}
        </span>
        <span className="tabular text-muted-foreground" aria-live="off">
          {/* Ember is reserved for danger (§1.1) — a paused loop is expected, not wrong. */}
          fps: <strong className={cn("font-mono", fpsStale ? "text-fg-muted" : "text-live")}>
            {fpsStale ? "0 (paused)" : (fps ?? "—")}
          </strong>
          {" · first frame: "}
          {firstFrameMs === null ? "waiting" : `${firstFrameMs} ms`}
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
      {/* In showcase mode the board gets a fixed height and a second section below it,
          so scrolling can push the canvas off screen and the fps read-out above proves
          the frameloop actually stopped (§10.4). */}
      <main
        className={cn(
          "relative overflow-hidden rounded-xl border border-border",
          showcaseOn ? "h-[70vh] shrink-0" : "min-h-0 flex-1",
        )}
      >
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
          showcase={showcase}
          onFirstFrame={onFirstFrame}
          onFrameRate={onFrameRate}
        />
        </div>
      </main>

      {showcaseOn && (
        <section className="flex h-[110vh] shrink-0 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card/40 p-6 text-center">
          <h2 className="font-display text-2xl">Scroll test</h2>
          <p className="max-w-md text-sm text-fg-muted">
            With the board above off screen the canvas switches to{" "}
            <code className="rounded-sm bg-bg-sunken px-1 py-0.5 font-mono text-xs">
              frameloop=&quot;demand&quot;
            </code>{" "}
            and stops rendering: the fps read-out in the header falls to 0 (paused).
            Scroll back up and it picks the orbit up again.
          </p>
        </section>
      )}
    </div>
  );
}
