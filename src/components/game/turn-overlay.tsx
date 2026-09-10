"use client";
// src/components/game/turn-overlay.tsx  [P3 → restyled U2]
// FR-21d / UI_REDESIGN §5.4: the "pass the device" hand-over card for local
// two-player games — a full-board scrim with a Fraunces headline. It is shown
// while the controller reports `flipping` (skipped under reduced motion, FR-21g,
// because the controller never enters the flip state then).
import { Display } from "@/components/ui-kit";
import { formatColour } from "@/lib/format";
import { cn } from "@/lib/ui";
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
        "pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-xl",
        "bg-background/70 backdrop-blur-[2px] transition-opacity duration-200",
        visible ? "opacity-100" : "opacity-0",
      )}
    >
      <div
        className={cn(
          "max-w-[80%] rounded-xl border border-border bg-card px-7 py-5 text-center shadow-soft",
          "transition-transform duration-200",
          visible ? "scale-100" : "scale-95",
        )}
      >
        <Display level={3} as="p" className="text-[1.75rem] sm:text-[2rem]">
          {formatColour(turn)} to move
        </Display>
        <p className="mt-1 text-sm text-muted-foreground">Pass the device to {name}</p>
      </div>
    </div>
  );
}
