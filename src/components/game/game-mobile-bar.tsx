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
  KeyboardIcon,
  LightbulbIcon,
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

/** One thumb-sized button: icon over a 10px caption, so nothing is a mystery glyph. */
function BarButton({
  icon: Icon,
  label,
  onClick,
  disabled = false,
  badge,
  tone = "default",
}: {
  icon: typeof BoxIcon;
  label: string;
  onClick(): void;
  disabled?: boolean;
  badge?: string;
  tone?: "default" | "primary";
}) {
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      aria-disabled={disabled || undefined}
      className={cn(
        "h-auto min-w-0 flex-1 flex-col gap-0.5 px-1 py-1.5 text-[10px] font-medium",
        tone === "primary" && "text-primary",
        disabled && "opacity-50",
      )}
    >
      <Icon aria-hidden className="size-5" />
      <span className="truncate">{label}</span>
      {badge ? <span className="tabular sr-only">{badge}</span> : null}
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

  return (
    <ActionBar
      label="Game actions"
      className={cn("gap-0 overflow-visible px-1", className)}
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
        label={focus ? "Exit" : "Full"}
        onClick={onToggleFocus}
      />
      {hint.available ? (
        <BarButton
          icon={LightbulbIcon}
          label={`Hint ${hint.remaining}`}
          tone="primary"
          disabled={hint.disabledReason !== null}
          onClick={() => {
            if (hint.disabledReason === null) hint.request();
          }}
        />
      ) : (
        <BarButton
          icon={UndoIcon}
          label="Undo"
          disabled={!canUndo || mode === "online" || seat === null}
          onClick={() => {
            void actions.undo();
          }}
        />
      )}
      <BarButton icon={MessagesSquareIcon} label="Panel" onClick={onOpenPanel} />

      <Drawer>
        <DrawerTrigger
          render={
            <Button
              variant="ghost"
              aria-label="More game actions"
              className="h-auto min-w-0 flex-1 flex-col gap-0.5 px-1 py-1.5 text-[10px] font-medium"
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
