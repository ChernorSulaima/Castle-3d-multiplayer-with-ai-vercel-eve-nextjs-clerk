"use client";
// src/components/landing/room-strip.tsx  [U1]
// "Choose your room" (§3): five cards that move the hero board into the room you
// point at. Hover on a pointer device, tap on a phone, focus on a keyboard —
// the active card keeps the brass ring.
//
// Thumbnails are deliberately absent: §3 forbids fabricating them, so the preview
// is the two board swatches plus the HDRI the room actually loads.
import { useCallback, useEffect, useRef } from "react";
import { preloadBoard3D } from "@/components/board3d/board-3d-loader";
import { RoomCard } from "@/components/ui-kit";
import { ROOMS, ROOM_ORDER } from "@/lib/rooms";
import { useUiStore } from "@/lib/stores/ui-store";
import { cn } from "@/lib/ui";
import type { RoomPresetId } from "@/lib/types";
import { useMediaQuery } from "./use-in-view";

/** Enough to survive a mouse crossing the strip, short enough to feel immediate. */
const HOVER_DELAY_MS = 120;

export interface RoomStripProps {
  active: RoomPresetId;
  onSelect(room: RoomPresetId): void;
  className?: string;
}

export function RoomStrip({ active, onSelect, className }: RoomStripProps) {
  const canHover = useMediaQuery("(hover: hover)");
  const hoverTimer = useRef<number | null>(null);
  const warmed = useRef(new Set<string>());

  const cancelHover = useCallback(() => {
    if (hoverTimer.current !== null) window.clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
  }, []);

  useEffect(() => cancelHover, [cancelHover]);

  /** Warm the room's HDRI (and the 3D chunk) the moment the visitor shows intent. */
  const warm = useCallback((room: Exclude<RoomPresetId, "custom">) => {
    if (useUiStore.getState().webglAvailable === false) return;
    const hdri = ROOMS[room].hdri;
    if (warmed.current.has(hdri)) return;
    warmed.current.add(hdri);
    void preloadBoard3D([hdri]).catch(() => undefined);
  }, []);

  const select = useCallback(
    (room: Exclude<RoomPresetId, "custom">) => {
      cancelHover();
      warm(room);
      onSelect(room);
    },
    [cancelHover, onSelect, warm],
  );

  return (
    <ul
      className={cn(
        // Phones: a snap scroller that bleeds to both edges (§3). From `sm` up it
        // is a plain grid, five across at `lg`.
        "-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1",
        "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        "sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-5",
        className,
      )}
    >
      {ROOM_ORDER.map((id) => {
        const room = ROOMS[id];
        return (
          <li key={id} className="w-[62%] min-w-[9.5rem] shrink-0 snap-start sm:w-auto sm:min-w-0">
            <RoomCard
              name={room.label}
              description={room.description}
              lightSquare={room.board.lightSquare}
              darkSquare={room.board.darkSquare}
              hdriName={room.hdri.replace(/^\/+/, "")}
              active={active === id}
              className="h-full"
              onClick={() => select(id)}
              onFocus={() => select(id)}
              onPointerEnter={() => {
                if (!canHover) return;
                warm(id);
                cancelHover();
                hoverTimer.current = window.setTimeout(() => onSelect(id), HOVER_DELAY_MS);
              }}
              onPointerLeave={cancelHover}
            />
          </li>
        );
      })}
    </ul>
  );
}
