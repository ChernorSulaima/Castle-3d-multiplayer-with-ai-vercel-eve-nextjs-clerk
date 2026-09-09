// src/components/board3d/board-3d-loader.tsx
// `next/dynamic({ ssr: false })` is only legal inside a Client Component (Next 16 errors
// in a Server Component), which is why this wrapper exists at all. It also keeps three,
// drei and postprocessing (~1.2 MB) out of the game-page chunk.
"use client";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import type { BoardViewProps } from "@/lib/types";

function Board3DSkeleton() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <Skeleton className="aspect-square w-full max-w-[min(100%,720px)] rounded-xl" />
      <span className="sr-only">Loading the 3D board…</span>
    </div>
  );
}

/** Drop-in replacement for Board2D: both are `(props: BoardViewProps) => JSX.Element`. */
export const Board3DLoader = dynamic<BoardViewProps>(
  () => import("./board-3d").then((mod) => mod.default),
  { ssr: false, loading: () => <Board3DSkeleton /> },
);

/**
 * Warms the 3D chunk and its assets without rendering it (NFR-2a, FR-21m).
 * Pass the HDRI paths to preload — `HDRI_FILES` for the settings drawer, or just the
 * active room's `hdri` when the game page mounts.
 */
export async function preloadBoard3D(hdriFiles?: string[]): Promise<void> {
  const mod = await import("./board-3d");
  mod.preloadAssets(hdriFiles);
}

export default Board3DLoader;
