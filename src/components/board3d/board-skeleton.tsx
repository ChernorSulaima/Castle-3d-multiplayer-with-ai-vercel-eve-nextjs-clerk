// src/components/board3d/board-skeleton.tsx
// The one loading state the 3D board has, shared by the two places that can be waiting:
// `board-3d-loader.tsx` while the ~1.2 MB chunk downloads, and `board-3d.tsx` from the
// moment the Canvas mounts until the renderer has actually put a frame on screen.
//
// Those two waits are consecutive and the second is the longer one (the piece GLB and
// the room HDRI both suspend inside the Canvas, and a WebGL canvas is transparent until
// something is drawn into it), so a skeleton that only covered the first left a bordered
// empty rectangle sitting in the board's ring for the rest of the wait.
"use client";
import { cn } from "@/lib/ui";

export interface Board3DSkeletonProps {
  className?: string;
}

/**
 * Deliberately tonal rather than decorative: a walnut panel the shape of the board, a
 * slow pulse (killed globally under `prefers-reduced-motion` by globals.css) and one
 * plain line of copy. `role="status"` announces it once; there is no second sr-only
 * string to double it up.
 */
export function Board3DSkeleton({ className }: Board3DSkeletonProps) {
  return (
    <div
      role="status"
      className={cn("grid h-full w-full place-items-center p-2", className)}
    >
      <div
        aria-hidden
        className="col-start-1 row-start-1 h-full w-full max-w-[min(100%,720px)] animate-pulse rounded-xl border border-border/60 bg-card/40"
      />
      <span className="col-start-1 row-start-1 text-sm text-fg-muted">
        Setting the board…
      </span>
    </div>
  );
}

export default Board3DSkeleton;
