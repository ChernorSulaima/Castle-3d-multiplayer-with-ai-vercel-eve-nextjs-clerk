"use client";
// src/components/game/game-sidebar.tsx  [U2]
// UI_REDESIGN §5.1's right column: Chat (default in AI games) / Moves / Info.
// Pure — the chat rows, the hint state and the presence chips all arrive as props.
import Link from "next/link";
import {
  ChevronFirstIcon,
  ChevronLastIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  DownloadIcon,
  PauseIcon,
  PlayIcon,
  RotateCcwIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GameChat, type ChatHintState, type ChatSystemChip } from "@/components/ai/game-chat";
import type { ChatCommentaryRow } from "@/components/ai/chat-model";
import { MoveList } from "@/components/ui-kit";
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
                  <Button
                    size="icon-sm"
                    variant="secondary"
                    aria-label={`Rewind to move ${ply} and play on from there`}
                    title="Rewind to here"
                    disabled={pending}
                    onClick={() => {
                      void actions.undo(ply);
                    }}
                  >
                    <RotateCcwIcon />
                  </Button>
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

function InfoTab({
  view,
  totalPlies,
  spectatorCount,
  actions,
}: Pick<GameSidebarProps, "view" | "totalPlies" | "spectatorCount" | "actions">) {
  const { game } = view;
  const difficulty = game.difficulty ? DIFFICULTIES[game.difficulty] : null;

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
        <InfoRow label="Rated">{game.rated ? "Yes" : "No"}</InfoRow>
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
    </div>
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
          totalPlies={totalPlies}
          spectatorCount={spectatorCount}
          actions={actions}
        />
      </TabsContent>
    </Tabs>
  );
}
