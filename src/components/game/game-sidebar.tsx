"use client";
// src/components/game/game-sidebar.tsx  [U2]
// UI_REDESIGN §5.1's right column: Chat (default in AI games) / Moves / Info.
// Pure — the chat rows, the hint state and the presence chips all arrive as props.
import { useState } from "react";
import Link from "next/link";
import {
  ChevronFirstIcon,
  ChevronLastIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  CopyIcon,
  DownloadIcon,
  PauseIcon,
  PlayIcon,
  RotateCcwIcon,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GameChat, type ChatHintState, type ChatSystemChip } from "@/components/ai/game-chat";
import type { ChatCommentaryRow } from "@/components/ai/chat-model";
import { MoveList } from "@/components/ui-kit";
import { PIECE_MODEL_CREDIT } from "@/lib/constants";
import { DIFFICULTIES } from "@/lib/difficulty";
import { formatDateTime, formatMode, pluralize } from "@/lib/format";
import { cn, focusRing } from "@/lib/ui";
import type {
  Colour,
  GameActions,
  GameMode,
  GameView,
  MoveHistoryRow,
  PlayerSummary,
} from "@/lib/types";
import { SanInput } from "./accessibility/san-input";
import { LivePositionNote } from "./game-status-pill";

export type SidebarTab = "chat" | "moves" | "info";

export interface GameSidebarProps {
  view: GameView;
  mode: GameMode;
  seat: Colour | "both" | null;
  history: MoveHistoryRow[];
  totalPlies: number;
  reviewPly: number | null;
  autoplay: boolean;
  canUndo: boolean;
  canMove: boolean;
  pending: boolean;
  actions: GameActions;
  /** Persisted commentary rows, oldest first. */
  commentary: ChatCommentaryRow[];
  systemChips: ChatSystemChip[];
  hint: ChatHintState;
  spectatorCount: number;
  onRetryEngine?(): void;
  tab: SidebarTab;
  onTabChange(tab: SidebarTab): void;
  className?: string;
}

/* ------------------------------------------------------------------- moves */

function ReplayControls({
  reviewPly,
  totalPlies,
  autoplay,
  actions,
}: {
  reviewPly: number | null;
  totalPlies: number;
  autoplay: boolean;
  actions: GameActions;
}) {
  const atStart = reviewPly === 0;
  const live = reviewPly === null;

  return (
    <div className="flex items-center gap-1" role="group" aria-label="Replay controls">
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="First move"
        disabled={totalPlies === 0 || atStart}
        onClick={() => actions.goToPly(0)}
      >
        <ChevronFirstIcon />
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="Previous move"
        disabled={totalPlies === 0 || atStart}
        onClick={() => actions.stepReview(-1)}
      >
        <ChevronLeftIcon />
      </Button>
      <Button
        size="sm"
        variant={autoplay ? "secondary" : "ghost"}
        aria-pressed={autoplay}
        disabled={totalPlies === 0}
        onClick={() => actions.setAutoplay(!autoplay)}
      >
        {autoplay ? <PauseIcon aria-hidden /> : <PlayIcon aria-hidden />}
        {autoplay ? "Pause" : "Autoplay"}
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="Next move"
        disabled={live}
        onClick={() => actions.stepReview(1)}
      >
        <ChevronRightIcon />
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="Latest position"
        disabled={live}
        onClick={() => actions.goToPly(null)}
      >
        <ChevronLastIcon />
      </Button>
    </div>
  );
}

/**
 * FR-46's rewind, with the confirmation it always needed. Taking the game back to
 * move 8 DELETES every move after it — the one destructive thing on this screen,
 * and it used to fire from a hover icon on the first click.
 */
function RewindAction({
  ply,
  pending,
  onRewind,
}: {
  ply: number;
  pending: boolean;
  onRewind(): void;
}) {
  // `AlertDialogAction` is a plain Button in this shadcn port — it does not close
  // the dialog — so the open state is held here and the action closes it itself.
  const [open, setOpen] = useState(false);
  // `ply` is a half-move; players count in whole moves, and so does the status pill.
  // The SIDE is part of the button's name because both halves of a row round to the
  // same move number, and two controls that do different things cannot share a name.
  const move = Math.max(1, Math.ceil(ply / 2));
  const name = `Rewind to ${ply % 2 === 1 ? "White" : "Black"}'s move ${move}`;
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button
            size="icon-sm"
            variant="secondary"
            aria-label={name}
            title={name}
            disabled={pending}
          />
        }
      >
        <RotateCcwIcon />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Rewind to move {move}?</AlertDialogTitle>
          <AlertDialogDescription>Every move after it is removed.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep the game</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              setOpen(false);
              onRewind();
            }}
          >
            Rewind
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function MovesTab({
  history,
  totalPlies,
  reviewPly,
  autoplay,
  canUndo,
  canMove,
  pending,
  mode,
  seat,
  actions,
}: Pick<
  GameSidebarProps,
  | "history"
  | "totalPlies"
  | "reviewPly"
  | "autoplay"
  | "canUndo"
  | "canMove"
  | "pending"
  | "mode"
  | "seat"
  | "actions"
>) {
  // FR-46: rewinding to a chosen ply only exists outside online matches.
  const rewindable = mode !== "online" && seat !== null && canUndo;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <MoveList
          rows={history}
          currentPly={reviewPly ?? totalPlies}
          onSelect={(ply) => actions.goToPly(ply === totalPlies ? null : ply)}
          renderAction={
            rewindable
              ? (ply) => (
                  <RewindAction
                    ply={ply}
                    pending={pending}
                    onRewind={() => {
                      void actions.undo(ply);
                    }}
                  />
                )
              : undefined
          }
        />
      </div>

      <div className="flex flex-col gap-2 border-t border-border p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <ReplayControls
            reviewPly={reviewPly}
            totalPlies={totalPlies}
            autoplay={autoplay}
            actions={actions}
          />
          {reviewPly === null ? <LivePositionNote /> : null}
        </div>
        {seat !== null ? (
          <SanInput disabled={!canMove || pending} onSubmitSan={actions.submitSan} />
        ) : null}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- info */

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="shrink-0 text-[12px] text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right text-[13px] text-foreground">{children}</dd>
    </div>
  );
}

function ProfileLink({ player }: { player: PlayerSummary | null }) {
  if (player === null) return null;
  return (
    <Link
      prefetch={false}
      href={`/profile/${player.username}`}
      className={cn("rounded-sm text-primary underline-offset-2 hover:underline", focusRing)}
    >
      {player.username}
    </Link>
  );
}

function CreditLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className={cn(
        "rounded-sm underline underline-offset-2 hover:text-foreground",
        focusRing,
      )}
    >
      {children}
    </a>
  );
}

function InfoTab({
  view,
  mode,
  totalPlies,
  spectatorCount,
  actions,
}: Pick<GameSidebarProps, "view" | "mode" | "totalPlies" | "spectatorCount" | "actions">) {
  const { game } = view;
  const difficulty = game.difficulty ? DIFFICULTIES[game.difficulty] : null;

  // "Rated: Yes/No" is a database column, not an answer. The player is asking one
  // question — does this game move my rating? — so the panel answers it in a
  // sentence, and says WHY when the answer is no (FR-43 unrates on a take-back).
  const ratingNote =
    mode === "local"
      ? "Local games are never rated."
      : game.undoCount > 0
        ? "Take-backs made this game unrated."
        : game.rated
          ? "This game counts toward your rating."
          : "This game does not count toward your rating.";

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-3">
      <dl className="divide-y divide-border/60">
        <InfoRow label="White">
          <span className="font-medium">{view.whiteName}</span>
          {view.white ? (
            <span className="tabular ml-1.5 font-mono text-muted-foreground">
              {view.white.rating}
            </span>
          ) : null}
        </InfoRow>
        <InfoRow label="Black">
          <span className="font-medium">{view.blackName}</span>
          {view.black ? (
            <span className="tabular ml-1.5 font-mono text-muted-foreground">
              {view.black.rating}
            </span>
          ) : null}
        </InfoRow>
        <InfoRow label="Mode">{formatMode(game.mode)}</InfoRow>
        {difficulty ? (
          <InfoRow label="Difficulty">
            {difficulty.label}
            <span className="ml-1.5 text-muted-foreground">{difficulty.persona.name}</span>
          </InfoRow>
        ) : null}
        <div className="py-1.5">
          <dt className="sr-only">Rating</dt>
          <dd className="text-[13px] text-muted-foreground">{ratingNote}</dd>
        </div>
        {game.undoCount > 0 ? (
          <InfoRow label="Take-backs">
            <span className="tabular font-mono">{game.undoCount}</span>
          </InfoRow>
        ) : null}
        <InfoRow label="Started">{formatDateTime(game.createdAt)}</InfoRow>
        <InfoRow label="Moves">
          <span className="tabular font-mono">{totalPlies}</span>
        </InfoRow>
        <InfoRow label="Watching">{pluralize(Math.max(0, spectatorCount), "person", "people")}</InfoRow>
        {view.white || view.black ? (
          <InfoRow label="Profiles">
            <span className="flex flex-wrap justify-end gap-2">
              <ProfileLink player={view.white} />
              <ProfileLink player={view.black} />
            </span>
          </InfoRow>
        ) : null}
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            void actions.copyPgn();
          }}
        >
          <CopyIcon aria-hidden />
          Copy PGN
        </Button>
        <Button size="sm" variant="outline" onClick={actions.downloadPgn}>
          <DownloadIcon aria-hidden />
          Download
        </Button>
      </div>

      {/* MANDATORY (§I-7): the piece models are CC BY 3.0, so this credit is a
          licence obligation — and the game screen is where people actually look at
          them. Settings keeps the long version; this is the one-line one. */}
      <p className="mt-4 border-t border-border/60 pt-3 text-[12px] leading-relaxed text-muted-foreground">
        Pieces by{" "}
        <CreditLink href={PIECE_MODEL_CREDIT.authorUrl}>Jarlan Perez via Poly Pizza</CreditLink> (
        <CreditLink href={PIECE_MODEL_CREDIT.licenseUrl}>CC BY 3.0</CreditLink>) · HDRIs from{" "}
        <CreditLink href="https://polyhaven.com">Poly Haven</CreditLink> (CC0) ·{" "}
        <CreditLink href="https://stockfishchess.org">Stockfish</CreditLink> (
        <CreditLink href="/stockfish/sf18/LICENSE-GPL-3.0.txt">GPL v3</CreditLink>)
      </p>
    </div>
  );
}

/* -------------------------------------------------------------- sheet peek */

export interface GameSheetPeekProps {
  /** Who spoke the newest line, or null when it is one of the centred system chips. */
  speaker: string | null;
  /** The newest line in the panel; null until something has been said. */
  text: string | null;
  /** What the strip offers while the panel is quiet, e.g. "Moves and game info". */
  quiet: string;
  /** How many lines have arrived since the reader last had the panel open. */
  unread?: number;
  onExpand(): void;
  className?: string;
}

/**
 * §5.3's bottom sheet, at rest.
 *
 * The sheet used to camp on 42dvh of a phone so the newest bubble stayed visible —
 * which cost the board more than the bubble was worth. This is the same promise in
 * one 44px line: who spoke and what they said, tappable to open the full panel.
 * The board keeps the screen; the conversation keeps its voice.
 */
export function GameSheetPeek({
  speaker,
  text,
  quiet,
  unread = 0,
  onExpand,
  className,
}: GameSheetPeekProps) {
  const label =
    text === null
      ? `Open the game panel — ${quiet}`
      : speaker === null
        ? `Open the game panel — ${text}`
        : `Open the game panel — ${speaker} said: ${text}`;

  return (
    <button
      type="button"
      onClick={onExpand}
      aria-label={unread === 0 ? label : `${label} (${pluralize(unread, "new line", "new lines")})`}
      className={cn(
        "flex h-11 w-full shrink-0 items-center gap-2 rounded-xl border border-border bg-card px-3 text-left",
        "transition-colors hover:bg-accent/40",
        focusRing,
        className,
      )}
    >
      {text === null ? (
        <span aria-hidden className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground">
          {quiet}
        </span>
      ) : (
        <>
          {speaker === null ? null : (
            <span aria-hidden className="shrink-0 text-[13px] font-medium text-foreground">
              {speaker}
            </span>
          )}
          <span aria-hidden className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground">
            {text}
          </span>
        </>
      )}
      {unread > 0 ? (
        <span
          aria-hidden
          className="tabular grid h-4 min-w-4 shrink-0 place-items-center rounded-full bg-primary px-1 text-[12px] leading-none font-semibold text-primary-foreground"
        >
          {unread > 9 ? "9+" : unread}
        </span>
      ) : null}
      <ChevronUpIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

/* ----------------------------------------------------------------- sidebar */

export function GameSidebar({
  view,
  mode,
  seat,
  history,
  totalPlies,
  reviewPly,
  autoplay,
  canUndo,
  canMove,
  pending,
  actions,
  commentary,
  systemChips,
  hint,
  spectatorCount,
  onRetryEngine,
  tab,
  onTabChange,
  className,
}: GameSidebarProps) {
  const { game } = view;
  const persona = game.difficulty ? DIFFICULTIES[game.difficulty].persona.name : "The AI";
  const humanColour: Colour | undefined =
    game.aiColor === undefined ? undefined : game.aiColor === "w" ? "b" : "w";
  const moverLabel =
    seat === null ? (humanColour === "w" ? view.whiteName : view.blackName) : "You";

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => onTabChange(value as SidebarTab)}
      className={cn("flex min-h-0 flex-1 flex-col gap-0", className)}
    >
      <TabsList variant="line" className="h-10 w-full shrink-0 gap-1 border-b border-border px-2">
        <TabsTrigger value="chat">Chat</TabsTrigger>
        <TabsTrigger value="moves">Moves</TabsTrigger>
        <TabsTrigger value="info">Info</TabsTrigger>
      </TabsList>

      {/* All three panels stay mounted and visibility is driven by `tab`, not by
          Base UI's exit transition: an outgoing panel is kept in the DOM until its
          animations report finished, and with `flex` on the element that leaves the
          old tab occupying half the sidebar. Keeping them mounted also preserves the
          chat's scroll position across a tab switch. */}
      <TabsContent
        value="chat"
        keepMounted
        className={cn("min-h-0 flex-1 flex-col", tab === "chat" ? "flex" : "hidden")}
      >
        <GameChat
          mode={mode}
          moves={game.moves}
          commentary={commentary}
          aiColor={game.aiColor}
          personaName={persona}
          moverLabel={moverLabel}
          systemChips={systemChips}
          hint={hint}
          onRetryEngine={onRetryEngine}
        />
      </TabsContent>

      <TabsContent
        value="moves"
        keepMounted
        className={cn("min-h-0 flex-1 flex-col", tab === "moves" ? "flex" : "hidden")}
      >
        <MovesTab
          history={history}
          totalPlies={totalPlies}
          reviewPly={reviewPly}
          autoplay={autoplay}
          canUndo={canUndo}
          canMove={canMove}
          pending={pending}
          mode={mode}
          seat={seat}
          actions={actions}
        />
      </TabsContent>

      <TabsContent
        value="info"
        keepMounted
        className={cn("min-h-0 flex-1 flex-col", tab === "info" ? "flex" : "hidden")}
      >
        <InfoTab
          view={view}
          mode={mode}
          totalPlies={totalPlies}
          spectatorCount={spectatorCount}
          actions={actions}
        />
      </TabsContent>
    </Tabs>
  );
}
