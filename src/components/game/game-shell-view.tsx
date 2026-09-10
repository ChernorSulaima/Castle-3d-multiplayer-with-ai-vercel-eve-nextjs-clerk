"use client";
// src/components/game/game-shell-view.tsx  [U2]
// The game screen of UI_REDESIGN §5, as a PURE component.
//
// Split rule (§10.3): this file may not import `convex/react`. Everything that
// needs the backend — the controller, commentary rows, presence, the rating
// delta, the rematch mutation, the settings drawer — is handed in by
// `GameShell`, which is why `/dev/game` can render the real screen against a
// mocked controller with no Clerk and no Convex.
//
// Layout, in one place so nothing remounts when it changes (§5.2): the board box
// is the SAME element in the default and focus layouts, only its classes differ.
// Remounting it would tear down the WebGL context and re-download the room.
import { useCallback, useEffect, useRef, useState } from "react";
import { EyeIcon, MinimizeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import type { ChatCommentaryRow } from "@/components/ai/chat-model";
import type { ChatHintState, ChatSystemChip } from "@/components/ai/game-chat";
import {
  FocusHud,
  PlayerChip,
  ShortcutsDialog,
  StatPill,
} from "@/components/ui-kit";
import { useFullscreen } from "@/hooks/use-fullscreen";
import { useShortcuts } from "@/hooks/use-shortcuts";
import { DIFFICULTIES } from "@/lib/difficulty";
import { formatGameResult, pgnResult } from "@/lib/format";
import { useUiStore } from "@/lib/stores/ui-store";
import { cn } from "@/lib/ui";
import type { Colour, GameController, ViewerRole } from "@/lib/types";
import { MoveAnnouncer } from "./accessibility/move-announcer";
import { BoardSurface } from "./board-surface";
import { DrawOfferDialog } from "./draw-offer-dialog";
import { GameActionBar } from "./game-action-bar";
import { GameMobileBar } from "./game-mobile-bar";
import { GamePlayerRow } from "./game-player-row";
import { GameResultDialog } from "./game-result-dialog";
import { GameSidebar, type SidebarTab } from "./game-sidebar";
import { GameStatusPill } from "./game-status-pill";
import { GAME_SHORTCUTS } from "./game-shortcuts";
import { PromotionPicker } from "./promotion-picker";
import { TurnOverlay } from "./turn-overlay";
import { useHasRoomForSheet, useIsCompact } from "./use-viewport";

/** Everything the screen needs that `GameController` does not carry. */
export interface GameShellMeta {
  /** Persisted `commentary` rows, oldest first. */
  commentary: ChatCommentaryRow[];
  /** FR-32: the online opponent has not been seen inside the abandon window. */
  opponentStale: boolean;
  /** Presence for the opponent; null when there is no signal (AI, local, spectating). */
  opponentOnline: boolean | null;
  spectatorCount: number;
  hint: ChatHintState;
  /** The viewer's rating change, once the game is over and it was rated (FR-49). */
  rating: { delta: number; after: number } | null;
  playAgainPending: boolean;
  onPlayAgain(): void;
  onRetryEngine?(): void;
  /** Contents of the Room drawer — `<SettingsForm/>` in the app. */
  roomSettings?: React.ReactNode;
  onRoomOpenChange?(open: boolean): void;
}

export interface GameShellViewProps {
  controller: GameController;
  viewerRole: ViewerRole;
  meta: GameShellMeta;
}

function seatOf(role: ViewerRole): Colour | "both" | null {
  if (role === "white") return "w";
  if (role === "black") return "b";
  if (role === "local") return "both";
  return null;
}

/**
 * Presence transitions as chat chips (§5.1 "opponent reconnected").
 *
 * Derived during render rather than in an effect: `react-hooks/set-state-in-effect`
 * is an error in this repo, and this is the documented "adjust state when a prop
 * changes" escape hatch — it settles in one extra render.
 */
function usePresenceChips(online: boolean | null): ChatSystemChip[] {
  const [state, setState] = useState<{ online: boolean | null; chips: ChatSystemChip[] }>({
    online: null,
    chips: [],
  });

  if (online !== null && state.online !== online) {
    setState((prev) => {
      if (prev.online === online) return prev;
      if (prev.online === null) return { online, chips: prev.chips };
      return {
        online,
        chips: [
          ...prev.chips,
          {
            id: `presence-${prev.chips.length}`,
            text: online ? "Opponent reconnected" : "Opponent may have disconnected",
          },
        ],
      };
    });
  }

  return state.chips;
}

/**
 * "Draw declined" (§5.1's system chips). An offer that disappears while the game
 * is still running was refused; one that disappears as the game ends was taken,
 * and the result chip already says so. Same derive-during-render rule as above.
 */
function useDrawChips(offerFrom: Colour | null, active: boolean): ChatSystemChip[] {
  const [state, setState] = useState<{ offer: Colour | null; chips: ChatSystemChip[] }>({
    offer: offerFrom,
    chips: [],
  });

  if (state.offer !== offerFrom) {
    setState((prev) => {
      if (prev.offer === offerFrom) return prev;
      const declined = prev.offer !== null && offerFrom === null && active;
      return {
        offer: offerFrom,
        chips: declined
          ? [...prev.chips, { id: `draw-${prev.chips.length}`, text: "Draw declined" }]
          : prev.chips,
      };
    });
  }

  return state.chips;
}

export function GameShellView({ controller, viewerRole, meta }: GameShellViewProps) {
  const { view, board, actions } = controller;
  const game = view?.game ?? null;

  const boardView = useUiStore((s) => s.boardView);
  const webglAvailable = useUiStore((s) => s.webglAvailable);
  const layoutMode = useUiStore((s) => s.layoutMode);
  const settingsDrawerOpen = useUiStore((s) => s.settingsDrawerOpen);
  const setSettingsDrawerOpen = useUiStore((s) => s.setSettingsDrawerOpen);

  const compact = useIsCompact();
  const roomForSheet = useHasRoomForSheet();
  const fullscreen = useFullscreen();
  const focus = layoutMode === "focus";

  const isAi = game?.mode === "ai";
  // §5.1: Chat leads in an AI game, Moves otherwise — unless the shell opens straight
  // into a reviewed position (a shared link, the dev harness), where the move list is
  // the whole point.
  const [tab, setTab] = useState<SidebarTab>(isAi && controller.isLive ? "chat" : "moves");

  // Stepping back into the game (§5.1 "click to review") is a request to look at the
  // move list, so the sidebar goes there the moment review starts — the reviewing
  // banner is what brings you back, and the reader is free to switch tabs again while
  // still reviewing. Derived from a render-time comparison rather than an effect, so
  // the list is already on screen for the first reviewed position.
  const [wasLive, setWasLive] = useState(controller.isLive);
  if (wasLive !== controller.isLive) {
    setWasLive(controller.isLive);
    if (!controller.isLive && tab !== "moves") setTab("moves");
  }
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  // null = "the default for this mode"; a boolean once the reader has decided.
  const [sheetOverride, setSheetOverride] = useState<boolean | null>(null);

  const presenceChips = usePresenceChips(meta.opponentOnline);
  const drawChips = useDrawChips(
    controller.drawOfferFrom,
    (game?.status ?? "active") === "active",
  );

  /* --------------------------------------------------------------- focus */

  // §5.2: the header is hidden by an attribute on <html>, which `SiteHeader`
  // already styles against — no cross-package import in either direction.
  useEffect(() => {
    const root = document.documentElement;
    if (focus) root.dataset.layout = "focus";
    else delete root.dataset.layout;
    return () => {
      delete root.dataset.layout;
    };
  }, [focus]);

  // Leaving the browser's own fullscreen (Esc, the OS chrome) must also leave the
  // focus layout, or the header stays hidden with nothing to explain why.
  const wasFullscreen = useRef(false);
  useEffect(() => {
    const was = wasFullscreen.current;
    wasFullscreen.current = fullscreen.active;
    if (was && !fullscreen.active) useUiStore.getState().setLayoutMode("default");
  }, [fullscreen.active]);

  // The layout is session state on a shared store: a player who walks out of a
  // fullscreen game must not find the rest of the app headless.
  useEffect(
    () => () => {
      useUiStore.getState().setLayoutMode("default");
    },
    [],
  );

  const { enter: enterFullscreen, exit: exitFullscreen } = fullscreen;
  const toggleFocus = useCallback(() => {
    const next = useUiStore.getState().layoutMode === "focus" ? "default" : "focus";
    useUiStore.getState().setLayoutMode(next);
    // §5.2: real fullscreen is an enhancement — the layout switches either way.
    if (next === "focus") void enterFullscreen();
    else void exitFullscreen();
  }, [enterFullscreen, exitFullscreen]);

  const toggleView = useCallback(() => {
    const state = useUiStore.getState();
    if (state.boardView === "2d" && state.webglAvailable === false) return;
    actions.setBoardView(state.boardView === "3d" ? "2d" : "3d");
  }, [actions]);

  const orientation = board.orientation;
  const reviewPly = controller.reviewPly;
  useShortcuts({
    onFullscreen: toggleFocus,
    onToggleView: toggleView,
    onFlip: () => actions.setOrientation(orientation === "w" ? "b" : "w"),
    onStep: (delta) => actions.stepReview(delta),
    onFirst: () => actions.goToPly(0),
    onLast: () => actions.goToPly(null),
    onHelp: () => setShortcutsOpen(true),
    onEscape: () => {
      if (useUiStore.getState().layoutMode === "focus") toggleFocus();
      else if (reviewPly !== null) actions.goToPly(null);
    },
  });

  if (game === null || view === null) return null;

  /* -------------------------------------------------------------- derived */

  const seat = seatOf(viewerRole);
  const active = game.status === "active";
  const finished = game.status !== "active" && game.status !== "waiting";
  const totalPlies = game.moves.length;
  const near: Colour = orientation;
  const far: Colour = orientation === "w" ? "b" : "w";
  const persona = game.difficulty ? DIFFICULTIES[game.difficulty] : null;

  const nameOf = (colour: Colour) => (colour === "w" ? view.whiteName : view.blackName);
  const playerOf = (colour: Colour) => (colour === "w" ? view.white : view.black);
  const subtitleOf = (colour: Colour): string | undefined => {
    if (game.mode === "ai" && game.aiColor === colour && persona) {
      return `AI · ${persona.label}`;
    }
    if (game.mode === "local" && colour === "b") return "Same device";
    return undefined;
  };

  const resultText = finished
    ? formatGameResult(game.status, game.winner, game.endReason, {
        whiteName: view.whiteName,
        blackName: view.blackName,
      })
    : null;

  const systemChips: ChatSystemChip[] = [
    ...presenceChips,
    ...drawChips,
    ...(controller.drawOfferFrom !== null
      ? [
          {
            id: "draw-offer",
            text:
              controller.drawOfferFrom === seat
                ? "You offered a draw"
                : "Draw offered — accept or decline above the board",
          },
        ]
      : []),
    ...(finished && game.endReason === "agreement"
      ? [{ id: "draw-accepted", text: "Draw accepted" }]
      : []),
    ...(finished
      ? [
          {
            id: "game-over",
            text: `Game over · ${pgnResult(game.status, game.winner)}`,
          },
        ]
      : []),
  ];

  const statusPill = (
    <GameStatusPill
      reviewPly={reviewPly}
      moveNumber={Math.max(1, Math.ceil(totalPlies / 2) + (game.turn === "w" ? 1 : 0))}
      turnLabel={controller.turnLabel}
      active={active}
      inCheck={board.checkSquare !== null}
      resultText={resultText}
      onBackToLive={() => actions.goToPly(null)}
    />
  );

  const sidebar = (
    <GameSidebar
      view={view}
      mode={game.mode}
      seat={seat}
      history={controller.history}
      totalPlies={totalPlies}
      reviewPly={reviewPly}
      autoplay={controller.autoplay}
      canUndo={controller.canUndo}
      canMove={controller.canMove}
      pending={controller.pending}
      actions={actions}
      commentary={meta.commentary}
      systemChips={systemChips}
      hint={meta.hint}
      spectatorCount={meta.spectatorCount}
      onRetryEngine={meta.onRetryEngine}
      tab={tab}
      onTabChange={setTab}
    />
  );

  const barProps = {
    mode: game.mode,
    seat,
    boardView,
    webglAvailable,
    orientation,
    focus,
    pending: controller.pending,
    canUndo: controller.canUndo,
    canResign: controller.canResign,
    canOfferDraw: controller.canOfferDraw,
    drawOffered: controller.drawOfferFrom !== null,
    hint: meta.hint,
    actions,
    onToggleView: toggleView,
    onToggleFocus: toggleFocus,
    onOpenRoom: () => setSettingsDrawerOpen(true),
    onOpenShortcuts: () => setShortcutsOpen(true),
  };

  // §5.3: the sheet peeks at 40% in AI games so the newest bubble is visible.
  const sheetOpen = sheetOverride ?? (compact && isAi && !focus && roomForSheet);

  return (
    <div
      className={cn(
        "flex w-full flex-col bg-background",
        // The board never scrolls (§5.1) — at every width the screen is exactly
        // one viewport tall and the board takes whatever height is left over.
        focus ? "fixed inset-0 z-50 h-[100dvh]" : "h-[calc(100dvh-3.5rem)] overflow-hidden",
        // §5.3: the bottom sheet peeks over the lower 40dvh, so the column has to
        // end above it — otherwise the action bar sits behind the sheet.
        !focus && sheetOpen && "pb-[42dvh] lg:pb-0",
      )}
      data-layout={focus ? "focus" : "default"}
    >
      {/* The screen is full-bleed by design (§5.1) — the status pill, not a title,
          carries the state — but a document with no heading at all is a dead end for
          a screen-reader user landing here from the lobby. One sr-only h1 names the
          board; everything visible stays exactly as designed. */}
      <h1 className="sr-only">
        {`${view.whiteName} versus ${view.blackName} — ${
          game.mode === "ai" ? "against the computer" : game.mode === "local" ? "pass and play" : "online game"
        }`}
      </h1>

      <div
        className={cn(
          "grid min-h-0 flex-1",
          focus
            ? "grid-cols-1"
            : "lg:grid-cols-[minmax(0,1fr)_23.75rem] xl:grid-cols-[minmax(0,1fr)_25rem]",
        )}
      >
        {/* ------------------------------------------------- board column */}
        <div className="flex min-h-0 min-w-0 flex-col lg:border-r lg:border-border">
          {focus ? null : (
            <GamePlayerRow
              name={nameOf(far)}
              player={playerOf(far)}
              colour={far}
              toMove={active && game.turn === far}
              captured={board.captured}
              subtitle={subtitleOf(far)}
              stale={meta.opponentStale && seat !== null && far !== seat}
              className="border-b border-border/60"
            >
              <div className="shrink-0">{statusPill}</div>
            </GamePlayerRow>
          )}

          {viewerRole === "spectator" && !focus ? (
            <div
              role="status"
              className="flex items-center gap-2 border-b border-border/60 px-3 py-1.5 text-[13px] text-muted-foreground"
            >
              <EyeIcon className="size-3.5 shrink-0" aria-hidden />
              <span className="font-medium text-foreground">Spectating</span>
              <span className="truncate">This board is read-only.</span>
              <StatPill
                className="ml-auto shrink-0"
                value={Math.max(0, meta.spectatorCount)}
                label="watching"
              />
            </div>
          ) : null}

          {/* The board box: one element, two layouts. `container-type: size`
              turns the leftover height into a unit so the square can be the
              smaller of the two axes without measuring anything in JS. */}
          <div
            className="relative grid min-h-0 flex-1 place-items-center p-2 [container-type:size]"
          >
            <div
              className="relative aspect-square h-[min(100cqw,100cqh)] w-[min(100cqw,100cqh)]"
            >
              <BoardSurface {...board} />
              {game.mode === "local" ? (
                <TurnOverlay
                  visible={controller.flipping}
                  turn={game.turn}
                  name={game.turn === "w" ? view.whiteName : view.blackName}
                />
              ) : null}
            </div>

            {focus ? (
              <FocusHud
                autoHide={boardView === "3d"}
                topLeft={
                  <div className="rounded-full border border-border bg-card/90 px-3 py-1.5 shadow-soft backdrop-blur-md">
                    <PlayerChip
                      size="sm"
                      name={nameOf(game.turn)}
                      avatarUrl={playerOf(game.turn)?.avatarUrl ?? null}
                      rating={playerOf(game.turn)?.rating ?? null}
                      side={game.turn}
                      toMove={active}
                      subtitle={active ? undefined : resultText}
                    />
                  </div>
                }
                topRight={
                  <Button
                    size="sm"
                    variant="secondary"
                    className="shadow-soft backdrop-blur-md"
                    onClick={toggleFocus}
                  >
                    <MinimizeIcon aria-hidden />
                    Exit fullscreen
                  </Button>
                }
                bottom={<GameActionBar {...barProps} variant="focus" />}
              />
            ) : null}
          </div>

          {focus ? null : (
            <GamePlayerRow
              name={nameOf(near)}
              player={playerOf(near)}
              colour={near}
              toMove={active && game.turn === near}
              captured={board.captured}
              subtitle={subtitleOf(near)}
              stale={meta.opponentStale && seat !== null && near !== seat}
              className="border-t border-border/60"
            />
          )}

          {/* §5.3 calls this "sticky": with the column pinned to one viewport
              (and the sheet's 40dvh reserved as padding above) it is always the
              last visible row, so plain flow does the job without a scrollport. */}
          {focus ? null : (
            <div className="z-20 flex shrink-0 flex-col gap-2 p-2">
              <DrawOfferDialog
                offerFrom={controller.drawOfferFrom}
                seat={seat}
                pending={controller.pending}
                onRespond={actions.respondDraw}
              />
              {compact ? (
                <GameMobileBar
                  {...barProps}
                  onOpenPanel={() => setSheetOverride(true)}
                />
              ) : (
                <GameActionBar {...barProps} />
              )}
            </div>
          )}
        </div>

        {/* ----------------------------------------------------- sidebar */}
        {focus ? null : (
          <aside className="hidden min-h-0 flex-col bg-card lg:flex">{sidebar}</aside>
        )}
      </div>

      {/* ------------------------------------------- mobile bottom sheet */}
      {compact && !focus ? (
        <Drawer
          open={sheetOpen}
          onOpenChange={setSheetOverride}
          modal={false}
          disablePointerDismissal
          showSwipeHandle
        >
          {/* §5.3's "40% peek" is a FIXED-height sheet, not a snap point: a
              snap-point drawer is a full-height popup slid down, so its content
              is laid out for the whole viewport and the newest chat bubble ends
              up below the fold. `--drawer-height` is the shadcn popup's own hook. */}
          <DrawerContent
            aria-label="Game panel"
            style={{ "--drawer-height": "42dvh" } as React.CSSProperties}
          >
            <DrawerHeader className="sr-only">
              <DrawerTitle>Game panel</DrawerTitle>
              <DrawerDescription>Chat, moves and game information.</DrawerDescription>
            </DrawerHeader>
            <div className="flex min-h-0 flex-1 flex-col">{sidebar}</div>
          </DrawerContent>
        </Drawer>
      ) : null}

      {/* ------------------------------------------------- room settings */}
      {meta.roomSettings ? (
        <Drawer
          open={settingsDrawerOpen}
          onOpenChange={meta.onRoomOpenChange ?? setSettingsDrawerOpen}
        >
          <DrawerContent className="max-h-[85dvh]">
            <DrawerHeader>
              <DrawerTitle>Board &amp; room settings</DrawerTitle>
              <DrawerDescription>
                Changes apply immediately and never interrupt the game.
              </DrawerDescription>
            </DrawerHeader>
            <div className="overflow-y-auto px-4 pb-6">{meta.roomSettings}</div>
          </DrawerContent>
        </Drawer>
      ) : null}

      <ShortcutsDialog
        shortcuts={GAME_SHORTCUTS}
        open={shortcutsOpen}
        onOpenChange={setShortcutsOpen}
      />

      <PromotionPicker prompt={board.promotion} onChoose={actions.choosePromotion} />

      <GameResultDialog
        view={view}
        seat={seat}
        rating={meta.rating}
        playAgainPending={meta.playAgainPending}
        onPlayAgain={meta.onPlayAgain}
      />

      <MoveAnnouncer
        lastMove={board.lastMove}
        turn={board.turn}
        checkSquare={board.checkSquare}
        status={game.status}
        winner={game.winner}
        whiteName={view.whiteName}
        blackName={view.blackName}
        reviewPly={reviewPly}
      />
    </div>
  );
}
