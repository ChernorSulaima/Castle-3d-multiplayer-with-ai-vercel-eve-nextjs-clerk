"use client";
// src/components/ui-kit/move-list.tsx  [U0]
import { cn, focusRingInset } from "@/lib/ui";
import type { MoveHistoryRow } from "@/lib/types";

export interface MoveListProps extends Omit<React.ComponentProps<"div">, "onSelect"> {
  rows: MoveHistoryRow[];
  /** 1-based ply being reviewed; null while live. */
  currentPly?: number | null;
  onSelect?(ply: number): void;
  /**
   * Per-cell slot revealed on hover/focus, e.g. a "Rewind to here" button (§5.1).
   * It is rendered as a SIBLING of the cell button, overlaid on its right edge —
   * a button inside a button is invalid HTML and breaks hydration.
   */
  renderAction?(ply: number): React.ReactNode;
  emptyMessage?: string;
}

function MoveCell({
  move,
  current,
  onSelect,
  renderAction,
}: {
  move: { ply: number; san: string } | undefined;
  current: boolean;
  onSelect?(ply: number): void;
  renderAction?(ply: number): React.ReactNode;
}) {
  if (!move) return <span aria-hidden className="px-2 py-1" />;

  const cellClass = cn(
    "flex min-w-0 flex-1 items-center border-l-2 px-2 py-1 text-left text-[13px]",
    focusRingInset,
    current
      ? "border-primary bg-primary/10 font-medium text-foreground"
      : "border-transparent text-muted-foreground",
    onSelect && "hover:bg-muted hover:text-foreground",
  );

  const san = <span className="tabular truncate font-mono">{move.san}</span>;

  return (
    <div className="group/cell relative flex min-w-0 items-stretch">
      {onSelect ? (
        <button
          type="button"
          aria-current={current ? "true" : undefined}
          aria-label={`Move ${move.ply}, ${move.san}`}
          className={cellClass}
          onClick={() => onSelect(move.ply)}
        >
          {san}
        </button>
      ) : (
        <span className={cellClass}>{san}</span>
      )}
      {renderAction ? (
        <span
          className={cn(
            "absolute inset-y-0 right-1 flex items-center opacity-0 transition-opacity",
            "group-hover/cell:opacity-100 group-focus-within/cell:opacity-100",
          )}
        >
          {renderAction(move.ply)}
        </span>
      ) : null}
    </div>
  );
}

/** Paired move list in mono, brass left rule on the current ply (§5.1). */
export function MoveList({
  rows,
  currentPly = null,
  onSelect,
  renderAction,
  emptyMessage = "No moves yet.",
  className,
  ...props
}: MoveListProps) {
  if (rows.length === 0) {
    return (
      <div className={cn("p-3 text-[13px] text-muted-foreground", className)} {...props}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div
      role="list"
      aria-label="Moves"
      className={cn("divide-y divide-border/60 bg-bg-sunken", className)}
      {...props}
    >
      {rows.map((row) => (
        <div
          key={row.number}
          role="listitem"
          className="grid grid-cols-[2.5rem_1fr_1fr] items-stretch"
        >
          <span className="tabular flex items-center px-2 py-1 font-mono text-[13px] text-muted-foreground/70">
            {row.number}.
          </span>
          <MoveCell
            move={row.white}
            current={currentPly != null && row.white?.ply === currentPly}
            onSelect={onSelect}
            renderAction={renderAction}
          />
          <MoveCell
            move={row.black}
            current={currentPly != null && row.black?.ply === currentPly}
            onSelect={onSelect}
            renderAction={renderAction}
          />
        </div>
      ))}
    </div>
  );
}
