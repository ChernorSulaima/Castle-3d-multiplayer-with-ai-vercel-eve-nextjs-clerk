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
import { ChevronDownIcon, EyeIcon, MinimizeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import type { ChatCommentaryRow } from "@/components/ai/chat-model";
import type { ChatHintState, ChatSystemChip } from "@/components/ai/game-chat";
import {
  FocusHud,
  Kbd,
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
import { GameSheetPeek, GameSidebar, type SidebarTab } from "./game-sidebar";
import { GameStatusPill } from "./game-status-pill";
import { GAME_SHORTCUTS } from "./game-shortcuts";
import { PromotionPicker } from "./promotion-picker";
import { TurnOverlay } from "./turn-overlay";
import { useIsCompact } from "./use-viewport";

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
  // §5.3's sheet is now opened, never defaulted open: at rest the panel is the
  // one-line peek strip above the action bar, so the board keeps the phone.
  const [sheetOpen, setSheetOpen] = useState(false);

  const presenceChips = usePresenceChips(meta.opponentOnline);
  const drawChips = useDrawChips(
    controller.drawOfferFrom,
    (game?.status ?? "active") === "active",
  );

  // Neither the focus layout nor a phone at rest shows the panel, so anything Pip
  // says while the board has the screen would otherwise arrive silently. One count
  // and a baseline stamped the moment the panel goes away is all the bookkeeping
  // this needs — no per-row ids, no read receipts, and it resets itself the moment
  // the panel is back (leaving focus, or opening the sheet).
  const messageCount =
    meta.commentary.length +
    presenceChips.length +
    drawChips.length +
    (controller.drawOfferFrom === null ? 0 : 1);
  const panelHidden = focus || (compact && !sheetOpen);
  const [unreadFrom, setUnreadFrom] = useState({ hidden: panelHidden, at: messageCount });
  if (unreadFrom.hidden !== panelHidden) setUnreadFrom({ hidden: panelHidden, at: messageCount });
  const unread =
    panelHidden && unreadFrom.hidden ? Math.max(0, messageCount - unreadFrom.at) : 0;

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

  // The peek strip carries whatever sits at the BOTTOM of the panel. `GameChat`
  // sorts system chips with no ply after every bubble, so a chip — "Draw declined",
  // "Game over · 1-0" — outranks the last thing the persona said here too, and the
  // strip and the list never disagree about what was said most recently.
  const lastChip = systemChips.at(-1) ?? null;
  const lastComment = meta.commentary.at(-1) ?? null;
  const peekText = lastChip?.text ?? lastComment?.text ?? null;
  const peekSpeaker = lastChip !== null ? null : (persona?.persona.name ?? null);

  const statusPill = (
    <GameStatusPill
      reviewPly={reviewPly}
      moveNumber={Math.max(1, Math.ceil(totalPlies / 2) + (game.turn === "w" ? 1 : 0))}
      turnLabel={controller.turnLabel}
      active={active}
      inCheck={board.checkSquare !== null}
      canMove={controller.canMove}
      totalPlies={totalPlies}
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

  // FR-31: the same banner in both layouts. In focus it is a persistent HUD
  // layer rather than a row above the action bar — an offer that fades out while
  // the clock runs is an offer the player never answered.
  const drawOfferOpen = controller.drawOfferFrom !== null && seat !== null;
  const drawOffer = (
    <DrawOfferDialog
      offerFrom={controller.drawOfferFrom}
      seat={seat}
      pending={controller.pending}
      onRespond={actions.respondDraw}
      className={focus ? "border-primary/50 bg-card/95 shadow-soft backdrop-blur-md" : undefined}
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

  return (
    <div
      className={cn(
        "flex w-full flex-col bg-background",
        // The board never scrolls (§5.1) — at every width the screen is exactly
        // one viewport tall and the board takes whatever height is left over.
        focus ? "fixed inset-0 z-50 h-[100dvh]" : "h-[calc(100dvh-3.5rem)] overflow-hidden",
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
              smaller of the two axes without measuring anything in JS.
              Full-bleed below `lg`: on a phone the square is capped by the column
              WIDTH, so every pixel of side padding comes straight off the board.
              The desk keeps its 8px margin, the phone gives it to the hero. */}
          <div
            className="relative grid min-h-0 flex-1 place-items-center p-0 [container-type:size] lg:p-2"
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
                topCenter={drawOfferOpen ? drawOffer : undefined}
                // Outside the fading layer on purpose: the way out, and the way
                // to find out what the keys do, are the two things that must
                // never be a guess on a screen with no header (§5.2).
                persistent={
                  <>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Keyboard shortcuts"
                      className="border border-border bg-card/85 shadow-soft backdrop-blur-md"
                      onClick={() => setShortcutsOpen(true)}
                    >
                      <Kbd aria-hidden className="border-0 bg-transparent px-0">
                        ?
                      </Kbd>
                    </Button>
                    <Button
                      variant="ghost"
                      className="relative border border-border bg-card/85 shadow-soft backdrop-blur-md"
                      aria-label={
                        unread === 0
                          ? undefined
                          : `Exit fullscreen, ${unread} new ${unread === 1 ? "message" : "messages"}`
                      }
                      onClick={toggleFocus}
                    >
                      <MinimizeIcon aria-hidden />
                      Exit fullscreen
                      {unread === 0 ? null : (
                        <span
                          aria-hidden
                          className="tabular absolute -top-1.5 -right-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[12px] leading-none font-semibold text-primary-foreground"
                        >
                          {unread > 9 ? "9+" : unread}
                        </span>
                      )}
                    </Button>
                  </>
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

          {/* §5.3 calls this "sticky": with the column pinned to one viewport it is
              always the last visible row, so plain flow does the job without a
              scrollport. On a phone the panel rides just above it as one line. */}
          {focus ? null : (
            <div className="z-20 flex shrink-0 flex-col gap-2 p-2">
              {drawOffer}
              {compact ? (
                <>
                  {sheetOpen ? null : (
                    <GameSheetPeek
                      speaker={peekSpeaker}
                      text={peekText}
                      quiet={isAi ? "Chat, moves and game info" : "Moves and game info"}
                      unread={unread}
                      onExpand={() => setSheetOpen(true)}
                    />
                  )}
                  <GameMobileBar
                    {...barProps}
                    panelTab={tab}
                    onOpenPanel={() => setSheetOpen(true)}
                  />
                </>
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
          onOpenChange={setSheetOpen}
          modal={false}
          disablePointerDismissal
          showSwipeHandle
        >
          {/* A FIXED-height sheet, not a snap point: a snap-point drawer is a
              full-height popup slid down, so its content is laid out for the whole
              viewport and the newest chat bubble ends up below the fold.
              `--drawer-height` is the shadcn popup's own hook. It is 60dvh because
              the reader ASKED for it — at rest the panel is the one-line strip, and
              the board never loses the screen to a sheet nobody opened. */}
          <DrawerContent
            aria-label="Game panel"
            style={{ "--drawer-height": "60dvh" } as React.CSSProperties}
          >
            <DrawerHeader className="sr-only">
              <DrawerTitle>Game panel</DrawerTitle>
              <DrawerDescription>Chat, moves and game information.</DrawerDescription>
            </DrawerHeader>
            {/* The sheet covers the action bar while it is open, so the way back to
                the board cannot be a swipe a first-timer has to guess at. */}
            <DrawerClose
              render={
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Hide the game panel"
                  // 44px square: it is a thumb target on a phone, not a desk affordance.
                  className="absolute top-2 right-1.5 z-10 size-11"
                />
              }
            >
              <ChevronDownIcon aria-hidden />
            </DrawerClose>
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
