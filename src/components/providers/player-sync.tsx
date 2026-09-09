"use client";

import { useEffect } from "react";
import { usePlayerSync } from "@/hooks/use-player-sync";
import { useSettingsSync } from "@/hooks/use-settings-sync";
import { useUiStore } from "@/lib/stores/ui-store";

/**
 * Renders nothing. Mounted once in the root layout, it is the single place that:
 *
 * 1. rehydrates the persisted ui-store from localStorage — the store is created
 *    with `skipHydration: true`, so NOTHING reads storage until this runs, which
 *    is what keeps the server render and the first client render identical
 *    (state-zustand.md §4.2). `onRehydrateStorage` then flips `hydrated`;
 * 2. provisions the Convex `players` row on first sign-in (FR-3);
 * 3. seeds the ui-store from `players.me` so Convex wins over localStorage.
 */
export function PlayerSync() {
  usePlayerSync();
  useSettingsSync();

  useEffect(() => {
    // Returns `Promise<void> | void` — localStorage is synchronous, so this
    // resolves through persist's thenable shim. `onRehydrateStorage` already logs
    // a read failure; catching here stops a rejection escaping unhandled.
    Promise.resolve(useUiStore.persist.rehydrate()).catch(() => {});
  }, []);

  return null;
}
