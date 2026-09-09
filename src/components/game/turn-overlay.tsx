"use client";
// src/components/game/turn-overlay.tsx  [P3]
// FR-21d: the "pass the device" hand-over card for local two-player games. It is
// shown while the controller reports `flipping` (skipped under reduced motion,
// FR-21g, because the controller never enters the flip state then).
import { cn } from "@/lib/utils";
import { formatColour } from "@/lib/format";
import type { Colour } from "@/lib/types";

export interface TurnOverlayProps {
  visible: boolean;
  turn: Colour;
  name: string;
}

export function TurnOverlay({ visible, turn, name }: TurnOverlayProps) {
  return (
    <div
      aria-hidden={!visible}
      className={cn(
        "pointer-events-none absolute inset-0 z-20 flex items-center justify-center transition-opacity duration-200",
        visible ? "opacity-100" : "opacity-0",
      )}
    >
      <div
        className={cn(
          "rounded-xl bg-popover/95 px-6 py-4 text-center shadow-lg ring-1 ring-border transition-transform duration-200",
          visible ? "scale-100" : "scale-95",
        )}
      >
        <p className="text-lg font-semibold">{formatColour(turn)} to move</p>
        <p className="text-sm text-muted-foreground">Pass the device to {name}</p>
      </div>
    </div>
  );
}
