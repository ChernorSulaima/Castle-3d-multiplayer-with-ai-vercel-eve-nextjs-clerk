"use client";
// src/components/game/board-surface.tsx  [P3]
// Picks Board2D or P4's Board3D from the ui-store and hands it `BoardViewProps`.
// It sits BELOW the controller (§D.11.8), so a view swap never unmounts the game
// state: selection and review ply survive (FR-14).
import { useCallback, useEffect } from "react";
import { toast } from "sonner";
import { Board2D } from "@/components/board2d/board-2d";
import { resolveRoom } from "@/lib/rooms";
import { useUiStore } from "@/lib/stores/ui-store";
import { probeWebgl, renderFailureMessage } from "@/lib/webgl";
import type { BoardViewProps, RenderFailureReason } from "@/lib/types";
import { Board3DLoader, preloadBoard3D } from "./board-3d-loader";

export function BoardSurface(props: BoardViewProps) {
  const hydrated = useUiStore((s) => s.hydrated);
  const boardView = useUiStore((s) => s.boardView);
  const webglAvailable = useUiStore((s) => s.webglAvailable);

  // Safety net: <PlayerSync /> (P2) normally rehydrates the persisted settings.
  // `rehydrate()` is idempotent (§D.12.8), so calling it here cannot double-apply,
  // and it stops the board from being stuck behind the `hydrated` gate.
  useEffect(() => {
    if (useUiStore.getState().hydrated) return;
    void useUiStore.persist.rehydrate();
  }, []);

  // §E.10.1: probe BEFORE anything mounts a <Canvas>; three r185 is WebGL2-only
  // and fiber swallows the renderer-constructor throw.
  useEffect(() => {
    if (useUiStore.getState().webglAvailable !== null) return;
    const probe = probeWebgl();
    useUiStore.getState().setWebglAvailable(probe.ok);
    if (!probe.ok && probe.reason !== null) {
      toast.info(renderFailureMessage(probe.reason)); // FR-19
    }
  }, []);

  // NFR-10 / FR-21g: honour the OS reduced-motion preference for both boards.
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => useUiStore.getState().setReducedMotion(query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  // NFR-2a: warm the 3D chunk (and the active room's HDRI) once the page mounts.
  const roomPreset = useUiStore((s) => s.roomPreset);
  const roomColors = useUiStore((s) => s.roomColors);
  useEffect(() => {
    if (useUiStore.getState().webglAvailable === false) return;
    const room = resolveRoom(roomPreset, roomColors);
    const id = setTimeout(() => void preloadBoard3D([room.hdri]).catch(() => undefined), 0);
    return () => clearTimeout(id);
  }, [roomPreset, roomColors]);

  const onRenderFailure = useCallback((reason: RenderFailureReason) => {
    useUiStore.getState().setWebglAvailable(false); // forces boardView back to "2d"
    toast.error(renderFailureMessage(reason));
  }, []);

  if (!hydrated) {
    // Same markup on the server and on the first client render (§D.12.6).
    return (
      <div
        className="aspect-square w-full max-w-[min(100%,80vh)] animate-pulse rounded-xl bg-muted"
        role="status"
        aria-label="Loading the board"
      />
    );
  }

  if (boardView === "3d" && webglAvailable !== false) {
    // Board3D fills its parent (`h-full`), so the box that defines the shared
    // board footprint lives here — both views occupy exactly the same space.
    return (
      <div className="aspect-square w-full max-w-[min(100%,80vh)] overflow-hidden rounded-xl ring-1 ring-border">
        <Board3DLoader {...props} onRenderFailure={onRenderFailure} />
      </div>
    );
  }
  return <Board2D {...props} />;
}
