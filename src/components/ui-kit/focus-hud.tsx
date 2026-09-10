"use client";
// src/components/ui-kit/focus-hud.tsx  [U0]
import { useEffect, useRef, useState } from "react";
import { HUD_IDLE_MS, cn } from "@/lib/ui";

export interface FocusHudProps extends React.ComponentProps<"div"> {
  topLeft?: React.ReactNode;
  topRight?: React.ReactNode;
  bottom?: React.ReactNode;
  /**
   * Fade out after 3s without pointer movement and return on the next move
   * (§5.2 — true for the 3D board, false for 2D where the HUD stays put).
   */
  autoHide?: boolean;
  idleMs?: number;
}

/**
 * Floating controls over a full-viewport board (§5.2 focus layout).
 *
 * Visibility is written straight to `data-visible` rather than held in state:
 * showing and hiding a HUD is a DOM effect, and re-rendering the whole toolbar
 * on every pointer move to flip one class would be wasteful.
 */
export function FocusHud({
  topLeft,
  topRight,
  bottom,
  autoHide = false,
  idleMs = HUD_IDLE_MS,
  className,
  children,
  ...props
}: FocusHudProps) {
  const hudRef = useRef<HTMLDivElement | null>(null);
  /** Keyboard users must never lose the HUD they are tabbing through. */
  const [focusWithin, setFocusWithin] = useState(false);

  useEffect(() => {
    const el = hudRef.current;
    if (!el) return;

    if (!autoHide || focusWithin) {
      el.dataset.visible = "true";
      return;
    }

    let timer = 0;
    const arm = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        el.dataset.visible = "false";
      }, idleMs);
    };
    const wake = () => {
      el.dataset.visible = "true";
      arm();
    };

    window.addEventListener("pointermove", wake, { passive: true });
    window.addEventListener("keydown", wake);
    arm();

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointermove", wake);
      window.removeEventListener("keydown", wake);
    };
  }, [autoHide, focusWithin, idleMs]);

  return (
    <div
      ref={hudRef}
      data-visible="true"
      onFocusCapture={() => setFocusWithin(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setFocusWithin(false);
        }
      }}
      className={cn(
        "pointer-events-none absolute inset-0 z-30 transition-opacity duration-300",
        "data-[visible=false]:opacity-0",
        className,
      )}
      {...props}
    >
      {topLeft ? <div className="pointer-events-auto absolute top-3 left-3">{topLeft}</div> : null}
      {topRight ? (
        <div className="pointer-events-auto absolute top-3 right-3">{topRight}</div>
      ) : null}
      {bottom ? (
        <div className="pointer-events-auto absolute inset-x-3 bottom-3 mx-auto w-fit max-w-full">
          {bottom}
        </div>
      ) : null}
      {children}
    </div>
  );
}
