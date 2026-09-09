"use client";
// src/components/game/move-history-panel.tsx  [P3]
// FR-41 (SAN paired by move number, current highlighted), FR-42 (click to review)
// and FR-47 (PGN copy + download).
import { useEffect, useRef } from "react";
import { CopyIcon, DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { MoveHistoryRow } from "@/lib/types";

export interface MoveHistoryPanelProps {
  history: MoveHistoryRow[];
  /** null = live; otherwise the ply currently being reviewed. */
  reviewPly: number | null;
  totalPlies: number;
  idPrefix: string;
  className?: string;
  goToPly(ply: number | null): void;
  copyPgn(): Promise<void>;
  downloadPgn(): void;
}

export function MoveHistoryPanel({
  history,
  reviewPly,
  totalPlies,
  idPrefix,
  className,
  goToPly,
  copyPgn,
  downloadPgn,
}: MoveHistoryPanelProps) {
  const currentPly = reviewPly ?? totalPlies;

  // FR-41: highlighting the current move is no use once it has scrolled out of the
  // viewport, which it has by move ~20 in both the side panel and the mobile drawer.
  // Skipped while the focus is inside the panel so it never yanks the list away from
  // someone who is deliberately reading (or tabbing through) an earlier move.
  const sectionRef = useRef<HTMLElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const section = sectionRef.current;
    const active = activeRef.current;
    if (section === null || active === null) return;
    const focused = section.ownerDocument.activeElement;
    if (focused !== null && section.contains(focused)) return;
    active.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [currentPly]);

  return (
    <section
      ref={sectionRef}
      className={cn("flex min-h-0 flex-col", className)}
      aria-label="Move history"
    >
      <ScrollArea className="min-h-0 flex-1">
        {history.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">No moves yet.</p>
        ) : (
          <ol className="divide-y divide-border/60 text-sm">
            {history.map((row) => (
              <li key={row.number} className="grid grid-cols-[2.5rem_1fr_1fr] items-stretch">
                <span className="flex items-center px-2 py-1 text-xs text-muted-foreground tabular-nums">
                  {row.number}.
                </span>
                {(["white", "black"] as const).map((side) => {
                  const cell = row[side];
                  if (!cell) return <span key={side} aria-hidden />;
                  const active = cell.ply === currentPly;
                  return (
                    <button
                      key={side}
                      ref={active ? activeRef : undefined}
                      type="button"
                      id={`${idPrefix}-ply-${cell.ply}`}
                      aria-current={active ? "step" : undefined}
                      onClick={() => goToPly(cell.ply === totalPlies ? null : cell.ply)}
                      className={cn(
                        "px-2 py-1 text-left font-medium tabular-nums transition-colors",
                        "hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                        active && "bg-primary/15 text-foreground",
                      )}
                    >
                      {cell.san}
                    </button>
                  );
                })}
              </li>
            ))}
          </ol>
        )}
      </ScrollArea>

      <div className="flex items-center gap-2 border-t border-border p-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            void copyPgn();
          }}
        >
          <CopyIcon aria-hidden />
          Copy PGN
        </Button>
        <Button size="sm" variant="outline" onClick={downloadPgn}>
          <DownloadIcon aria-hidden />
          Download
        </Button>
      </div>
    </section>
  );
}
