"use client";
// src/hooks/use-shortcuts.ts  [U2]
// UI_REDESIGN §5.1 keyboard map: F fullscreen, T 2D/3D, R flip, ←/→ review,
// Home/End first/last, ? shortcuts, Esc exits fullscreen or review.
//
// One document-level listener, installed once. It is deliberately conservative:
// a key is only claimed when the user is demonstrably NOT typing and no dialog
// is on screen, because silently stealing "r" from a text box is far worse than
// missing a shortcut.
import { useEffect, useRef } from "react";

export interface ShortcutHandlers {
  /** F */
  onFullscreen?(): void;
  /** T */
  onToggleView?(): void;
  /** R */
  onFlip?(): void;
  /** ← / → — delta is -1 or +1. */
  onStep?(delta: number): void;
  /** Home */
  onFirst?(): void;
  /** End */
  onLast?(): void;
  /** ? (shift + /) */
  onHelp?(): void;
  /** Escape */
  onEscape?(): void;
}

export interface UseShortcutsOptions {
  /** Set false to unhook entirely (spectator-free screens, tests). Default true. */
  enabled?: boolean;
}

/** True when the event started inside something the user types into. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

/**
 * True while a modal is on screen. Base UI mounts dialog popups into a portal
 * only while they are open, so their presence in the DOM *is* the open state —
 * and a dialog owns Escape, Home/End and the arrows for as long as it is up.
 */
function isDialogOpen(): boolean {
  return document.querySelector('[role="dialog"], [role="alertdialog"]') !== null;
}

export function useShortcuts(
  handlers: ShortcutHandlers,
  { enabled = true }: UseShortcutsOptions = {},
): void {
  // The handler object is rebuilt on every render of the caller; keeping it in a
  // ref means the listener is attached exactly once instead of on every keystroke
  // that changed a closure upstream. The write happens in an effect, never during
  // render — mutating a ref while rendering is a React Compiler error.
  const ref = useRef(handlers);
  useEffect(() => {
    ref.current = handlers;
  }, [handlers]);

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      // Ctrl/Cmd/Alt combinations belong to the browser and the OS.
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      if (isDialogOpen()) return;

      const h = ref.current;
      const run = (fn: (() => void) | undefined) => {
        if (fn === undefined) return;
        event.preventDefault();
        fn();
      };

      switch (event.key) {
        case "f":
        case "F":
          run(h.onFullscreen);
          return;
        case "t":
        case "T":
          run(h.onToggleView);
          return;
        case "r":
        case "R":
          run(h.onFlip);
          return;
        case "ArrowLeft":
          run(h.onStep === undefined ? undefined : () => h.onStep?.(-1));
          return;
        case "ArrowRight":
          run(h.onStep === undefined ? undefined : () => h.onStep?.(1));
          return;
        case "Home":
          run(h.onFirst);
          return;
        case "End":
          run(h.onLast);
          return;
        case "?":
          run(h.onHelp);
          return;
        case "Escape":
          run(h.onEscape);
          return;
        default:
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}
