"use client";
// src/components/game/use-viewport.ts  [U2]
// One media query, read the hydration-safe way: the server snapshot is `false`
// (desktop) and the first client snapshot is taken in the same commit, so the
// game screen never flashes the wrong layout (UI_REDESIGN quality floor).
import { useCallback, useSyncExternalStore } from "react";

/** Tailwind's `lg`. Below it §5.3's column layout applies. */
const COMPACT_QUERY = "(max-width: 1023.98px)";

/**
 * Below this the 42dvh bottom sheet would squeeze the board under ~150px, which
 * is not a board anyone can play on. Short phones start with the sheet closed
 * and open it from the "Panel" button instead (§5.3's peek is a default, not a
 * rule that outranks the board).
 */
const SHEET_ROOM_QUERY = "(min-height: 720px)";

function subscribeTo(query: string) {
  return (onChange: () => void): (() => void) => {
    if (typeof window === "undefined" || !window.matchMedia) return () => {};
    const mql = window.matchMedia(query);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  };
}

/** Hoisted so `useSyncExternalStore` sees a stable subscribe and never re-subscribes. */
const subscribeCompact = subscribeTo(COMPACT_QUERY);

const subscribeSheetRoom = subscribeTo(SHEET_ROOM_QUERY);

function matches(query: string): boolean {
  return typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia(query).matches
    : false;
}

/** True on phones and small tablets — the §5.3 layout. */
export function useIsCompact(): boolean {
  const getSnapshot = useCallback(() => matches(COMPACT_QUERY), []);
  return useSyncExternalStore(subscribeCompact, getSnapshot, () => false);
}

/** True when the viewport is tall enough to peek the bottom sheet by default. */
export function useHasRoomForSheet(): boolean {
  const getSnapshot = useCallback(() => matches(SHEET_ROOM_QUERY), []);
  return useSyncExternalStore(subscribeSheetRoom, getSnapshot, () => false);
}
