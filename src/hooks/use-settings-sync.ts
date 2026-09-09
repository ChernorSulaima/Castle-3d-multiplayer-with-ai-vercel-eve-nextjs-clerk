"use client";

import { useCallback, useEffect, useRef } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { PlayerSettings } from "@/lib/types";
import { useUiStore } from "@/lib/stores/ui-store";

/** How long a colour drag may pause before the value is written to Convex. */
const WRITE_DEBOUNCE_MS = 400;

/**
 * §E.1 step 7. Reads `players.me` once per session and seeds the ui-store from it
 * (Convex wins over anything rehydrated from localStorage).
 *
 * Deliberately seeds ONCE: `players.me` is a live subscription that also carries
 * ratings and W/L/D, so re-hydrating on every emission would clobber an in-flight
 * local change every time the player's rating moved.
 */
export function useSettingsSync(): void {
  const { isAuthenticated } = useConvexAuth();
  const me = useQuery(api.players.me, isAuthenticated ? {} : "skip");
  const hydrateFromServer = useUiStore((s) => s.hydrateFromServer);
  const seeded = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) {
      seeded.current = false;
      return;
    }
    if (seeded.current || me === undefined || me === null) return;
    seeded.current = true;

    // Not a React setState — zustand's `set` is safe under react-hooks/set-state-in-effect.
    hydrateFromServer({
      boardView: me.boardView,
      roomPreset: me.roomPreset,
      roomColors: me.roomColors ?? null,
      boardFlipEnabled: me.boardFlipEnabled,
      qualityTier: me.qualityTier,
      postFxEnabled: me.postFxEnabled,
    });
  }, [isAuthenticated, me, hydrateFromServer]);
}

/**
 * The write-back half. Returns a debounced patch function for the settings UI:
 * every control updates the ui-store synchronously (live preview) and calls this
 * to persist. Colour drags fire dozens of times a second, so coalesce them —
 * never one mutation per drag tick (FR-21j).
 */
export function useSettingsWriter(): (patch: Partial<PlayerSettings>) => void {
  const updateSettings = useMutation(api.players.updateSettings);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queued = useRef<Partial<PlayerSettings>>({});

  const flush = useCallback(() => {
    timer.current = null;
    const patch = queued.current;
    queued.current = {};
    if (Object.keys(patch).length === 0) return;
    updateSettings(patch).catch((error: unknown) => {
      console.error("[settings-sync] updateSettings failed", error);
    });
  }, [updateSettings]);

  useEffect(() => {
    // Flush anything still pending when the settings UI unmounts.
    return () => {
      if (timer.current !== null) {
        clearTimeout(timer.current);
        flush();
      }
    };
  }, [flush]);

  return useCallback(
    (patch: Partial<PlayerSettings>) => {
      queued.current = { ...queued.current, ...patch };
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = setTimeout(flush, WRITE_DEBOUNCE_MS);
    },
    [flush],
  );
}
