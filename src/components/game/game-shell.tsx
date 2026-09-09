"use client";
// src/components/game/game-shell.tsx  [P3]
// The client root of /game/[id]. It mounts `useGameController` ABOVE the 2D/3D
// swap (§D.11.8) so switching views never unmounts the game state, and it owns
// the responsive layout: side panel on desktop, drawer on mobile (NFR-6).
import { useCallback, useEffect, useState } from "react";
import { ListIcon, SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Skeleton } from "@/components/ui/skeleton";
import { CommentaryPanel } from "@/components/ai/commentary-panel";
import { HintButton } from "@/components/ai/hint-button";
import { SettingsForm } from "@/components/settings/settings-form";
import { useAiTurn } from "@/hooks/use-ai-turn";
import { useGameController } from "@/hooks/use-game-controller";
import { useHeartbeat } from "@/hooks/use-heartbeat";
import { useSettingsWriter } from "@/hooks/use-settings-sync";
import { ABANDON_TIMEOUT_MS } from "@/lib/constants";
import { useUiStore } from "@/lib/stores/ui-store";
import type { BoardView, Colour, GameId, GameView } from "@/lib/types";
import { MoveAnnouncer } from "./accessibility/move-announcer";
import { BoardSurface } from "./board-surface";
import { DrawOfferDialog } from "./draw-offer-dialog";
import { GameControls } from "./game-controls";
import { GameHeader } from "./game-header";
import { GameResultDialog } from "./game-result-dialog";
import { MoveHistoryPanel } from "./move-history-panel";
import { PromotionPicker } from "./promotion-picker";
import { ReviewBar } from "./review-bar";
import { SpectatorBanner } from "./spectator-banner";
import { TurnOverlay } from "./turn-overlay";

export interface GameShellProps {
  gameId: GameId;
  /** Server-preloaded `api.games.get` result — the first render uses it verbatim. */
  initialView: GameView | null;
}

const PRESENCE_TICK_MS = 20_000;

function seatOf(view: GameView | null): Colour | "both" | null {
  switch (view?.viewerRole) {
    case "white":
      return "w";
    case "black":
      return "b";
    case "local":
      return "both";
    default:
      return null;
  }
}

export function GameShell({ gameId, initialView }: GameShellProps) {
  const controller = useGameController(gameId, initialView);
  const { view, board, actions } = controller;
  const game = view?.game ?? null;
  const active = game?.status === "active";

  const boardView = useUiStore((s) => s.boardView);
  const webglAvailable = useUiStore((s) => s.webglAvailable);
  const historyDrawerOpen = useUiStore((s) => s.historyDrawerOpen);
  const setHistoryDrawerOpen = useUiStore((s) => s.setHistoryDrawerOpen);
  const settingsDrawerOpen = useUiStore((s) => s.settingsDrawerOpen);
  const setSettingsDrawerOpen = useUiStore((s) => s.setSettingsDrawerOpen);

  // FR-15: the in-game 2D/3D toggle is a PLAYER SETTING, so it has to survive a reload.
  // The controller may only touch `api.games.*`, so the write-back is wired here.
  const saveSettings = useSettingsWriter();
  const setControllerBoardView = actions.setBoardView;
  const setBoardViewPersisted = useCallback(
    (next: BoardView) => {
      setControllerBoardView(next);
      saveSettings({ boardView: next });
    },
    [setControllerBoardView, saveSettings],
  );

  useHeartbeat(gameId, active === true);

  // P5 owns the pipeline; the game page is where it has to be mounted. Spectators
  // must never drive it — `games.makeAiMove` requires a participant.
  const isSpectator = view?.viewerRole === "spectator";
  const aiTurn = useAiTurn(game?.mode === "ai" && !isSpectator ? gameId : null);

  // A clock for the "opponent may have disconnected" hint. Never read during
  // render from `Date.now()` directly — that is a purity error under the compiler.
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!active || game?.mode !== "online") return;
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, PRESENCE_TICK_MS);
    return () => clearInterval(id);
  }, [active, game?.mode]);

  if (!controller.ready || game === null || view === null) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-3 p-4">
        {controller.error === null ? (
          <>
            <Skeleton className="h-16 w-full" />
            <Skeleton className="aspect-square w-full max-w-[min(100%,80vh)] rounded-xl" />
            <p className="sr-only" role="status">
              Loading the game
            </p>
          </>
        ) : (
          <p role="alert" className="text-sm text-muted-foreground">
            {controller.error}
          </p>
        )}
      </div>
    );
  }

  const seat = seatOf(view);
  const totalPlies = game.moves.length;
  const viewerUsername =
    seat === "w" || seat === "both"
      ? (view.white?.username ?? null)
      : seat === "b"
        ? (view.black?.username ?? null)
        : null;
  const opponentStale =
    now > 0 && game.mode === "online" && now - game.lastMoveAt > ABANDON_TIMEOUT_MS;

  const historyPanel = (idPrefix: string, className?: string) => (
    <MoveHistoryPanel
      idPrefix={idPrefix}
      className={className}
      history={controller.history}
      reviewPly={controller.reviewPly}
      totalPlies={totalPlies}
      goToPly={actions.goToPly}
      copyPgn={actions.copyPgn}
      downloadPgn={actions.downloadPgn}
    />
  );

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-4 p-3 sm:p-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-3">
        <GameHeader
          view={view}
          captured={board.captured}
          turn={board.turn}
          turnLabel={controller.turnLabel}
          orientation={board.orientation}
          boardView={boardView}
          webglAvailable={webglAvailable}
          opponentStale={opponentStale}
          onBoardViewChange={setBoardViewPersisted}
        />

        {view.viewerRole === "spectator" ? (
          <SpectatorBanner spectatorCount={game.spectatorCount ?? 0} />
        ) : null}

        <DrawOfferDialog
          offerFrom={controller.drawOfferFrom}
          seat={seat}
          pending={controller.pending}
          onRespond={actions.respondDraw}
        />

        <div className="relative">
          <BoardSurface {...board} />
          {game.mode === "local" ? (
            <TurnOverlay
              visible={controller.flipping}
              turn={game.turn}
              name={game.turn === "w" ? view.whiteName : view.blackName}
            />
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <ReviewBar
            reviewPly={controller.reviewPly}
            totalPlies={totalPlies}
            autoplay={controller.autoplay}
            goToPly={actions.goToPly}
            stepReview={actions.stepReview}
            setAutoplay={actions.setAutoplay}
          />
          <div className="flex items-center gap-2">
            <Drawer open={historyDrawerOpen} onOpenChange={setHistoryDrawerOpen}>
              <DrawerTrigger
                render={<Button size="sm" variant="outline" className="lg:hidden" />}
              >
                <ListIcon aria-hidden />
                Moves
              </DrawerTrigger>
              <DrawerContent className="max-h-[80dvh]">
                <DrawerHeader>
                  <DrawerTitle>Move history</DrawerTitle>
                  <DrawerDescription>
                    Tap a move to review that position.
                  </DrawerDescription>
                </DrawerHeader>
                {historyPanel("drawer", "max-h-[55dvh]")}
              </DrawerContent>
            </Drawer>

            {/* FR-21h: "players choose the room from a picker in the game settings
                drawer". <SettingsForm /> writes through to the ui-store synchronously,
                so a room change is visible behind the drawer while it is still open,
                and it never touches the game document (FR-21m). */}
            <Drawer open={settingsDrawerOpen} onOpenChange={setSettingsDrawerOpen}>
              <DrawerTrigger render={<Button size="sm" variant="outline" />}>
                <SettingsIcon aria-hidden />
                Room
              </DrawerTrigger>
              <DrawerContent className="max-h-[85dvh]">
                <DrawerHeader>
                  <DrawerTitle>Board &amp; room settings</DrawerTitle>
                  <DrawerDescription>
                    Changes apply immediately and never interrupt the game.
                  </DrawerDescription>
                </DrawerHeader>
                <div className="overflow-y-auto px-4 pb-6">
                  <SettingsForm />
                </div>
              </DrawerContent>
            </Drawer>
          </div>
        </div>

        <GameControls
          mode={game.mode}
          seat={seat}
          orientation={board.orientation}
          reviewPly={controller.reviewPly}
          pending={controller.pending}
          canMove={controller.canMove}
          canUndo={controller.canUndo}
          canResign={controller.canResign}
          canOfferDraw={controller.canOfferDraw}
          actions={actions}
          hintSlot={
            game.mode === "ai" && !isSpectator ? <HintButton gameId={gameId} /> : null
          }
        />

        {game.mode === "ai" ? (
          <CommentaryPanel
            gameId={gameId}
            onRetryEngine={aiTurn.retryEngine}
            className="rounded-lg border border-border"
          />
        ) : null}
      </div>

      <aside className="hidden min-h-0 rounded-lg border border-border lg:flex lg:max-h-[calc(100dvh-8rem)] lg:flex-col">
        {historyPanel("panel")}
      </aside>

      <PromotionPicker prompt={board.promotion} onChoose={actions.choosePromotion} />

      <GameResultDialog view={view} seat={seat} viewerUsername={viewerUsername} />

      <MoveAnnouncer
        lastMove={board.lastMove}
        turn={board.turn}
        checkSquare={board.checkSquare}
        status={game.status}
        winner={game.winner}
        whiteName={view.whiteName}
        blackName={view.blackName}
        reviewPly={controller.reviewPly}
      />
    </div>
  );
}
