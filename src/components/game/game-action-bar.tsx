"use client";
// src/components/game/game-action-bar.tsx  [U2]
// UI_REDESIGN §5.1's always-visible action bar. Three groups, every button
// labelled, every disabled button carrying the reason in its tooltip:
//
//   View   2D/3D (T) · Flip (R) · Camera ▾ (3D) · Fullscreen (F)
//   Game   Hint · Take back · Offer draw · Resign
//   More   PGN ▾ · Room · Shortcuts
//
// Icon + label from 1280px up, icon-only with a tooltip below that (`labelFrom`).
// Nothing here talks to Convex: every verb is a `GameActions` call or a callback.
import {
  BoxIcon,
  CameraIcon,
  ChevronDownIcon,
  CopyIcon,
  DownloadIcon,
  ExpandIcon,
  FileTextIcon,
  FlagIcon,
  Grid2x2Icon,
  HandshakeIcon,
  KeyboardIcon,
  LightbulbIcon,
  MinimizeIcon,
  RefreshCwIcon,
  SettingsIcon,
  UndoIcon,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ActionBar, ActionButton, ActionGroup, ActionSeparator } from "@/components/ui-kit";
import { errorCopyFor } from "@/lib/errors";
import { useUiStore } from "@/lib/stores/ui-store";
import { cn } from "@/lib/ui";
import type { BoardView, CameraPresetId, Colour, GameActions, GameMode } from "@/lib/types";

/** Below this the text labels collapse and the tooltip carries the name (§5.1). */
const LABEL_FROM = "xl" as const;

export interface GameActionBarProps {
  mode: GameMode;
  /** null for spectators: the Game group disappears entirely. */
  seat: Colour | "both" | null;
  boardView: BoardView;
  webglAvailable: boolean | null;
  orientation: Colour;
  /** True while the shell is in the §5.2 focus layout. */
  focus: boolean;
  pending: boolean;
  canUndo: boolean;
  canResign: boolean;
  canOfferDraw: boolean;
  drawOffered: boolean;
  hint: {
    available: boolean;
    remaining: number;
    disabledReason: string | null;
    request(): void;
  };
  actions: GameActions;
  onToggleView(): void;
  onToggleFocus(): void;
  onOpenRoom(): void;
  onOpenShortcuts(): void;
  /** "focus" drops the More group and the labels — it is the floating HUD bar. */
  variant?: "full" | "focus";
  className?: string;
}

const CAMERA_ITEMS: { preset: CameraPresetId; label: string }[] = [
  { preset: "white", label: "White seat" },
  { preset: "black", label: "Black seat" },
  { preset: "top", label: "Top down" },
  { preset: "cinematic", label: "Orbit" },
];

function CameraMenu({ orientation }: { orientation: Colour }) {
  const setCameraPreset = useUiStore((s) => s.setCameraPreset);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button size="sm" variant="ghost" className="shrink-0" aria-label="Camera angle" />
        }
      >
        <CameraIcon aria-hidden />
        <span className="sr-only xl:not-sr-only">Camera</span>
        <ChevronDownIcon aria-hidden className="opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top">
        <DropdownMenuLabel>Camera</DropdownMenuLabel>
        {CAMERA_ITEMS.map((item) => (
          <DropdownMenuItem key={item.preset} onClick={() => setCameraPreset(item.preset)}>
            {item.label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setCameraPreset(orientation === "w" ? "white" : "black")}>
          Reset view
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PgnMenu({ actions }: { actions: GameActions }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button size="sm" variant="ghost" className="shrink-0" aria-label="PGN export" />
        }
      >
        <FileTextIcon aria-hidden />
        <span className="sr-only xl:not-sr-only">PGN</span>
        <ChevronDownIcon aria-hidden className="opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top">
        <DropdownMenuItem
          onClick={() => {
            void actions.copyPgn();
          }}
        >
          <CopyIcon aria-hidden />
          Copy PGN
        </DropdownMenuItem>
        <DropdownMenuItem onClick={actions.downloadPgn}>
          <DownloadIcon aria-hidden />
          Download PGN
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Resign + its confirmation (§5.1 "danger, confirms"). Exported so §5.3's More
 *  sheet can offer the same guarded action at full width. */
export function ResignAction({
  mode,
  disabledReason,
  wide = false,
  onResign,
}: {
  mode: GameMode;
  disabledReason: string | null;
  /** Full-width row for the mobile More drawer instead of a bar button. */
  wide?: boolean;
  onResign(): void;
}) {
  const blocked = disabledReason !== null;
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            size={wide ? "default" : "sm"}
            variant="destructive"
            aria-label="Resign the game"
            title={disabledReason ?? "Resign the game"}
            aria-disabled={blocked || undefined}
            className={cn(
              wide ? "justify-start" : "shrink-0",
              blocked && "pointer-events-none opacity-50",
            )}
          />
        }
      >
        <FlagIcon aria-hidden />
        <span className={wide ? undefined : "sr-only xl:not-sr-only"}>Resign</span>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Resign this game?</AlertDialogTitle>
          <AlertDialogDescription>
            {mode === "online"
              ? "Your opponent wins immediately and both ratings are updated."
              : "The game ends immediately."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep playing</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onResign}>
            Resign
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function GameActionBar({
  mode,
  seat,
  boardView,
  webglAvailable,
  orientation,
  focus,
  pending,
  canUndo,
  canResign,
  canOfferDraw,
  drawOffered,
  hint,
  actions,
  onToggleView,
  onToggleFocus,
  onOpenRoom,
  onOpenShortcuts,
  variant = "full",
  className,
}: GameActionBarProps) {
  const compact = variant === "focus";
  const labelFrom = LABEL_FROM;
  const is3d = boardView === "3d";
  const noWebgl = webglAvailable === false;

  const undoReason =
    mode === "online"
      ? errorCopyFor("undo-not-allowed", "game")
      : !canUndo
        ? "There is nothing to take back yet."
        : null;

  const drawReason = drawOffered
    ? "A draw offer is already on the table."
    : !canOfferDraw
      ? errorCopyFor("game-not-active", "game")
      : null;

  const fullscreenAction = (
    <ActionButton
      icon={focus ? MinimizeIcon : ExpandIcon}
      label={focus ? "Exit" : "Fullscreen"}
      labelFrom={labelFrom}
      shortcut="F"
      tooltip={focus ? "Leave the focus layout" : "Fill the screen with the board"}
      onClick={onToggleFocus}
    />
  );

  return (
    <ActionBar
      label="Game actions"
      className={cn(compact && "w-auto bg-card/90 backdrop-blur-md", className)}
    >
      <ActionGroup>
        <ActionButton
          icon={is3d ? Grid2x2Icon : BoxIcon}
          label={is3d ? "2D" : "3D"}
          labelFrom={labelFrom}
          shortcut="T"
          tooltip={is3d ? "Switch to the 2D board" : "Switch to the 3D board"}
          disabledReason={
            !is3d && noWebgl
              ? "3D needs WebGL2, which this browser or GPU does not provide."
              : undefined
          }
          onClick={onToggleView}
        />
        <ActionButton
          icon={RefreshCwIcon}
          label="Flip"
          labelFrom={labelFrom}
          shortcut="R"
          tooltip="Turn the board around"
          onClick={() => actions.setOrientation(orientation === "w" ? "b" : "w")}
        />
        {is3d && !noWebgl ? <CameraMenu orientation={orientation} /> : null}
        {/* §5.2 puts Exit LAST in the focus HUD — it is the way out, so it reads
            after the things you came here to do — and §5.1 puts Fullscreen with the
            other view controls. Same button, two homes. */}
        {compact && seat !== null ? null : fullscreenAction}
      </ActionGroup>

      {seat !== null ? (
        <>
          <ActionSeparator />
          <ActionGroup>
            {hint.available ? (
              <ActionButton
                icon={LightbulbIcon}
                label="Hint"
                labelFrom={labelFrom}
                tooltip="Ask your opponent for a nudge"
                badge={`${hint.remaining} left`}
                disabledReason={hint.disabledReason ?? undefined}
                onClick={hint.request}
              />
            ) : null}

            <ActionButton
              icon={UndoIcon}
              label={mode === "local" ? "Undo move" : "Take back"}
              labelFrom={labelFrom}
              tooltip="Rewind the last move"
              disabledReason={undoReason ?? undefined}
              onClick={() => {
                void actions.undo();
              }}
            />

            {!compact && mode === "online" ? (
              <ActionButton
                icon={HandshakeIcon}
                label="Offer draw"
                labelFrom={labelFrom}
                tooltip="Offer your opponent a draw"
                disabledReason={drawReason ?? undefined}
                onClick={() => {
                  void actions.offerDraw();
                }}
              />
            ) : null}

            {!compact ? (
              <ResignAction
                mode={mode}
                disabledReason={
                  canResign && !pending ? null : errorCopyFor("game-not-active", "game")
                }
                onResign={() => {
                  void actions.resign();
                }}
              />
            ) : null}

            {compact ? fullscreenAction : null}
          </ActionGroup>
        </>
      ) : null}

      {compact ? null : (
        <>
          <ActionSeparator />
          <ActionGroup className="ml-auto">
            <PgnMenu actions={actions} />
            <ActionButton
              icon={SettingsIcon}
              label="Room"
              labelFrom={labelFrom}
              tooltip="Board and room settings"
              onClick={onOpenRoom}
            />
            <ActionButton
              icon={KeyboardIcon}
              label="Shortcuts"
              labelFrom={labelFrom}
              shortcut="?"
              tooltip="Keyboard shortcuts"
              onClick={onOpenShortcuts}
            />
          </ActionGroup>
        </>
      )}
    </ActionBar>
  );
}
