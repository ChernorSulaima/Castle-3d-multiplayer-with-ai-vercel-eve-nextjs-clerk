// src/components/board3d/webgl-fallback.tsx
// FR-19 / §E.10 steps 1-2 and 5. three r185 is WebGL2-only and fiber's <Canvas> turns a
// renderer-constructor throw into an unhandled rejection (its `fallback` prop does NOT
// cover it), so the probe has to run BEFORE the Canvas mounts.
"use client";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { probeWebgl, renderFailureMessage } from "@/lib/webgl";
import { useUiStore } from "@/lib/stores/ui-store";
import type { RenderFailureReason } from "@/lib/types";

/** Toast + console line for a 3D failure. Safe to call more than once per reason. */
export function notifyRenderFailure(reason: RenderFailureReason): void {
  toast.warning(renderFailureMessage(reason), { id: `webgl-${reason}` });
}

export interface WebglProbeProps {
  /** Called once when 3D is not usable, with the reason for the toast (FR-19). */
  onUnavailable?(reason: RenderFailureReason): void;
  /** Set false to suppress the toast (e.g. the dev preview page). */
  toastOnFailure?: boolean;
}

/**
 * Renders nothing. Runs the WebGL2 probe exactly once per mount, mirrors the answer into
 * the ui-store (which forces `boardView: "2d"` when it fails) and reports the reason up.
 *
 * `setWebglAvailable` is a zustand action, not a React setState, so calling it from an
 * effect is allowed under `react-hooks/set-state-in-effect` (§D.12 rule 6).
 */
export function WebglProbe({ onUnavailable, toastOnFailure = true }: WebglProbeProps) {
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const probe = probeWebgl();
    useUiStore.getState().setWebglAvailable(probe.ok);
    if (probe.ok || !probe.reason) return;
    if (toastOnFailure) notifyRenderFailure(probe.reason);
    onUnavailable?.(probe.reason);
  }, [onUnavailable, toastOnFailure]);

  return null;
}

export interface WebglFallbackNoticeProps {
  reason: RenderFailureReason;
}

/** In-place message for the board area when 3D cannot be shown at all. */
export function WebglFallbackNotice({ reason }: WebglFallbackNoticeProps) {
  return (
    <div
      role="status"
      className="flex h-full w-full items-center justify-center rounded-xl border border-border bg-muted/40 p-6 text-center text-sm text-muted-foreground"
    >
      {renderFailureMessage(reason)}
    </div>
  );
}
