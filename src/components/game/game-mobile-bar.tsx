"use client";
// src/components/game/game-mobile-bar.tsx  [U2]
// UI_REDESIGN §5.3: "sticky action bar (5 primary buttons + 'More' sheet)".
// The five that matter with a thumb — board view, flip, fullscreen, the one
// game verb this mode offers, and the panel — stay out; everything else moves
// into a Drawer so the board keeps the screen.
import {
  BoxIcon,
  CameraIcon,
  CopyIcon,
  DownloadIcon,
  EllipsisIcon,
  ExpandIcon,
  Grid2x2Icon,
  HandshakeIcon,
  InfoIcon,
  KeyboardIcon,
  LightbulbIcon,
  ListIcon,
  MessagesSquareIcon,
  MinimizeIcon,
  RefreshCwIcon,
  SettingsIcon,
  UndoIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { ActionBar } from "@/components/ui-kit";
import { errorCopyFor } from "@/lib/errors";
import { useUiStore } from "@/lib/stores/ui-store";
import { cn } from "@/lib/ui";
import type { BoardView, CameraPresetId, Colour, GameActions, GameMode } from "@/lib/types";
import { ResignAction } from "./game-action-bar";

/** Which tab the panel button opens onto, so the label names what happens. */
export type MobilePanelTab = "chat" | "moves" | "info";

const PANEL_BUTTON: Record<MobilePanelTab, { icon: typeof BoxIcon; label: string }> = {
  chat: { icon: MessagesSquareIcon, label: "Chat" },
  moves: { icon: ListIcon, label: "Moves" },
  info: { icon: InfoIcon, label: "Info" },
};

export interface GameMobileBarProps {
  mode: GameMode;
  seat: Colour | "both" | null;
  boardView: BoardView;
  webglAvailable: boolean | null;
  orientation: Colour;
  focus: boolean;
  pending: boolean;
  canUndo: boolean;
  canResign: boolean;
  canOfferDraw: boolean;
  hint: { available: boolean; remaining: number; disabledReason: string | null; request(): void };
  actions: GameActions;
  /** The tab the sheet will land on — names the panel button (§4 "say what happens"). */
  panelTab: MobilePanelTab;
  onToggleView(): void;
  onToggleFocus(): void;
  onOpenPanel(): void;
  onOpenRoom(): void;
  onOpenShortcuts(): void;
  className?: string;
}

const CAMERA_ITEMS: { preset: CameraPresetId; label: string }[] = [
  { preset: "white", label: "White seat" },
  { preset: "black", label: "Black seat" },
  { preset: "top", label: "Top down" },
  { preset: "cinematic", label: "Orbit" },
];

/**
 * One thumb-sized button: icon over a 10px caption, so nothing is a mystery glyph.
 *
 * `min-h-11` is the 44px touch floor, and the caption is the accessible name unless
 * `srLabel` gives a fuller one — "Exit" reads as a whole verb under the icon while a
 * screen reader still hears "Exit fullscreen".
 */
function BarButton({
  icon: Icon,
  label,
  srLabel,
  onClick,
  disabled = false,
  tone = "default",
  className,
}: {
  icon: typeof BoxIcon;
  label: string;
  srLabel?: string;
  onClick(): void;
  disabled?: boolean;
  tone?: "default" | "primary";
  className?: string;
}) {
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      aria-disabled={disabled || undefined}
      aria-label={srLabel}
      className={cn(
        "h-auto min-h-11 min-w-0 flex-1 flex-col gap-0.5 px-0.5 py-1.5 text-[12px] font-medium",
        tone === "primary" && "text-primary",
        disabled && "opacity-50",
        className,
      )}
    >
      <Icon aria-hidden className="size-5" />
      <span aria-hidden={srLabel ? true : undefined} className="truncate">
        {label}
      </span>
    </Button>
  );
}

function MoreItem({
  icon: Icon,
  label,
  onClick,
  disabled = false,
  danger = false,
}: {
  icon: typeof BoxIcon;
  label: string;
  onClick(): void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <Button
      variant={danger ? "destructive" : "outline"}
      className="justify-start"
      disabled={disabled}
      onClick={onClick}
    >
      <Icon aria-hidden />
      {label}
    </Button>
  );
}

export function GameMobileBar({
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
  hint,
  actions,
  panelTab,
  onToggleView,
  onToggleFocus,
  onOpenPanel,
  onOpenRoom,
  onOpenShortcuts,
  className,
}: GameMobileBarProps) {
  const setCameraPreset = useUiStore((s) => s.setCameraPreset);
  const is3d = boardView === "3d";
  const noWebgl = webglAvailable === false;
  const flip = () => actions.setOrientation(orientation === "w" ? "b" : "w");
  const panel = PANEL_BUTTON[panelTab];

  return (
    <ActionBar
      label="Game actions"
      className={cn("gap-0 overflow-visible px-0.5", className)}
    >
      <BarButton
        icon={is3d ? Grid2x2Icon : BoxIcon}
        label={is3d ? "2D" : "3D"}
        disabled={!is3d && noWebgl}
        onClick={() => {
          if (is3d || !noWebgl) onToggleView();
        }}
      />
      <BarButton icon={RefreshCwIcon} label="Flip" onClick={flip} />
      <BarButton
        icon={focus ? MinimizeIcon : ExpandIcon}
        label={focus ? "Exit" : "Fullscreen"}
        srLabel={focus ? "Exit fullscreen" : "Fullscreen"}
        onClick={onToggleFocus}
      />
      {hint.available ? (
        // The count is on the face, not in a tooltip a thumb cannot summon: a hint
        // is spent, so "2 left" is the part of the label that decides the tap. The
        // face is short because a thumb bar is narrow; the accessible name is the
        // action's ONE name, the same words the bar and the composer use.
        <BarButton
          icon={LightbulbIcon}
          label={`Hint · ${hint.remaining} left`}
          srLabel={`Ask for a hint · ${hint.remaining} left`}
          tone="primary"
          className="flex-[1.3]"
          disabled={hint.disabledReason !== null}
          onClick={() => {
            if (hint.disabledReason === null) hint.request();
          }}
        />
      ) : (
        <BarButton
          icon={UndoIcon}
          label={mode === "local" ? "Undo" : "Take back"}
          disabled={!canUndo || mode === "online" || seat === null}
          onClick={() => {
            void actions.undo();
          }}
        />
      )}
      <BarButton icon={panel.icon} label={panel.label} onClick={onOpenPanel} />

      <Drawer>
        <DrawerTrigger
          render={
            <Button
              variant="ghost"
              aria-label="More game actions"
              className="h-auto min-h-11 min-w-0 flex-1 flex-col gap-0.5 px-0.5 py-1.5 text-[12px] font-medium"
            />
          }
        >
          <EllipsisIcon aria-hidden className="size-5" />
          <span>More</span>
        </DrawerTrigger>
        <DrawerContent className="max-h-[80dvh]">
          <DrawerHeader>
            <DrawerTitle>More actions</DrawerTitle>
            <DrawerDescription>
              Everything that does not fit on the bar.
            </DrawerDescription>
          </DrawerHeader>
          <div className="grid gap-2 overflow-y-auto px-4 pb-8">
            {is3d && !noWebgl ? (
              <>
                <p className="eyebrow pt-1">Camera</p>
                <div className="grid grid-cols-2 gap-2">
                  {CAMERA_ITEMS.map((item) => (
                    <Button
                      key={item.preset}
                      variant="outline"
                      className="justify-start"
                      onClick={() => setCameraPreset(item.preset)}
                    >
                      <CameraIcon aria-hidden />
                      {item.label}
                    </Button>
                  ))}
                </div>
              </>
            ) : null}

            {seat !== null ? (
              <>
                <p className="eyebrow pt-2">Game</p>
                {hint.available ? (
                  <MoreItem
                    icon={UndoIcon}
                    label={mode === "local" ? "Undo move" : "Take back"}
                    disabled={!canUndo || mode === "online"}
                    onClick={() => {
                      void actions.undo();
                    }}
                  />
                ) : null}
                {mode === "online" ? (
                  <MoreItem
                    icon={HandshakeIcon}
                    label="Offer draw"
                    disabled={!canOfferDraw || pending}
                    onClick={() => {
                      void actions.offerDraw();
                    }}
                  />
                ) : null}
                <ResignAction
                  mode={mode}
                  wide
                  disabledReason={
                    canResign && !pending ? null : errorCopyFor("game-not-active", "game")
                  }
                  onResign={() => {
                    void actions.resign();
                  }}
                />
              </>
            ) : null}

            <p className="eyebrow pt-2">More</p>
            <MoreItem
              icon={CopyIcon}
              label="Copy PGN"
              onClick={() => {
                void actions.copyPgn();
              }}
            />
            <MoreItem icon={DownloadIcon} label="Download PGN" onClick={actions.downloadPgn} />
            <MoreItem icon={SettingsIcon} label="Board and room settings" onClick={onOpenRoom} />
            <MoreItem icon={KeyboardIcon} label="Keyboard shortcuts" onClick={onOpenShortcuts} />
          </div>
        </DrawerContent>
      </Drawer>
    </ActionBar>
  );
}
