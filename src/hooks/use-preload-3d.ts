// src/hooks/use-preload-3d.ts
// NFR-2a: the 2D -> 3D toggle must be under 500 ms after first load. The game page calls
// this on mount so the 3D chunk, the piece GLB and the active room's HDRI are already in
// cache by the time the player flips the switch.
//
// FR-21m: pass `HDRI_FILES` when the settings drawer opens so switching rooms is instant.
"use client";
import { useEffect } from "react";
import { preloadBoard3D } from "@/components/board3d/board-3d-loader";
import { resolveRoom } from "@/lib/rooms";
import { useUiStore } from "@/lib/stores/ui-store";

export interface PreloadOptions {
  /** Skip entirely (WebGL unavailable, or the player is on a metered connection). */
  enabled?: boolean;
  /** Wait this long after mount so the first paint is never competing for bandwidth. */
  delayMs?: number;
  /** Defaults to just the active room's HDRI. */
  hdriFiles?: string[];
}

export function usePreload3d({ enabled = true, delayMs = 1_200, hdriFiles }: PreloadOptions = {}) {
  const roomPreset = useUiStore((state) => state.roomPreset);
  const roomColors = useUiStore((state) => state.roomColors);
  const webglAvailable = useUiStore((state) => state.webglAvailable);

  // Depend on the joined paths, not the array identity: callers pass inline arrays
  // (`HDRI_FILES`, `[room.hdri]`) and an identity dep would re-arm the timer every render.
  const filesKey = (hdriFiles ?? [resolveRoom(roomPreset, roomColors).hdri]).join("|");

  useEffect(() => {
    if (!enabled || webglAvailable === false) return;
    const files = filesKey.split("|").filter(Boolean);
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      void preloadBoard3D(files).catch(() => {
        // A warm-up failure must never surface to the player; the real load retries.
      });
    }, delayMs);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [enabled, delayMs, filesKey, webglAvailable]);
}
