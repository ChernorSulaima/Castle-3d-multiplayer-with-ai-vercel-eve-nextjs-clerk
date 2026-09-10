"use client";
// src/components/play/find-match-panel.tsx  [U4]
// The matchmaking card and the queue panel that replaces it while searching
// (UI_REDESIGN §6): elapsed timer, the current rating window drawn as a bar that
// grows every 10 seconds, Cancel, and "Play the AI while you wait".
//
// Every piece of queue behaviour below (the pagehide cleanup, the optimistic
// `queuedRef` claim, the skipped query before Convex has validated the session)
// is unchanged from the pre-redesign panel — only the presentation is new.
import { useEffect, useRef, useState } from "react";
import { LoaderIcon, SwordsIcon } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ModeCard } from "@/components/ui-kit";
import { QUEUE_BASE_RANGE, queueRangeAt } from "@/lib/constants";
import { formatElapsed, formatRating } from "@/lib/format";
import { describeConvexError } from "@/components/providers/convex-errors";
import { cn } from "@/lib/ui";

/** The elapsed readout only needs sub-second accuracy. */
const TICK_MS = 500;

/**
 * The widest window the bar draws as "full". `queueRangeAt` keeps widening past
 * this, so the bar saturates rather than lying about a maximum that does not
 * exist — the number beside it stays authoritative.
 */
const BAR_MAX_RANGE = 1000;

export interface QueuePanelViewProps {
  className?: string;
  elapsedMs: number;
  /** ± rating points currently accepted, or null before the first tick. */
  range: number | null;
  myRating: number | null;
  pending?: boolean;
  onCancel(): void;
  onPlayAi(): void;
}

/** Pure: the harness at /dev/pages renders this with a frozen timer. */
export function QueuePanelView({
  className,
  elapsedMs,
  range,
  myRating,
  pending = false,
  onCancel,
  onPlayAi,
}: QueuePanelViewProps) {
  const shown = range ?? QUEUE_BASE_RANGE;
  const progress = Math.min(
    1,
    (shown - QUEUE_BASE_RANGE) / (BAR_MAX_RANGE - QUEUE_BASE_RANGE),
  );

  return (
    <div
      className={cn(
        "flex h-full flex-col gap-4 rounded-xl border border-primary/40 bg-card p-5 shadow-soft",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          <span
            aria-hidden
            className="size-2 rounded-full bg-live motion-safe:animate-pulse"
          />
          Searching for an opponent
        </span>
        <span aria-live="polite" className="tabular font-mono text-sm text-muted-foreground">
          {formatElapsed(elapsedMs)}
        </span>
      </div>

      <div className="grid gap-2">
        <div className="flex items-baseline justify-between gap-3 text-[13px]">
          <span className="text-muted-foreground">Rating window</span>
          <span className="tabular font-mono text-foreground">
            {myRating === null
              ? `±${shown}`
              : `${formatRating(Math.max(0, myRating - shown))}–${formatRating(myRating + shown)}`}
          </span>
        </div>
        <div
          role="progressbar"
          aria-label="Rating window"
          aria-valuemin={QUEUE_BASE_RANGE}
          aria-valuemax={BAR_MAX_RANGE}
          aria-valuenow={Math.min(BAR_MAX_RANGE, shown)}
          aria-valuetext={`plus or minus ${shown} rating points`}
          className="h-1.5 w-full overflow-hidden rounded-full bg-bg-sunken"
        >
          <span
            className={cn(
              "block h-full rounded-full bg-primary",
              "motion-safe:transition-[width] motion-safe:duration-500 motion-safe:ease-out",
            )}
            style={{ width: `${Math.max(6, progress * 100)}%` }}
          />
        </div>
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          It widens by 100 points every 10 seconds. You will be taken to the board the moment
          someone is matched — keep this tab open.
        </p>
      </div>

      <div className="mt-auto flex flex-wrap gap-2">
        <Button variant="outline" onClick={onCancel} disabled={pending}>
          {pending ? "Cancelling…" : "Cancel"}
        </Button>
        <Button variant="ghost" onClick={onPlayAi} disabled={pending}>
          Play the AI while you wait
        </Button>
      </div>
    </div>
  );
}

/**
 * The whole "Find a match" card: the mode card while idle, and the queue panel
 * *in place of it* while searching (§6). Owning both states here is what lets the
 * swap happen at all — the queue state lives in `queue.myStatus`, not in the page.
 */
export function FindMatchPanel({
  enabled,
  myRating,
  onPlayAi,
  /** True while another game is already in progress (FR-26). */
  disabled = false,
  /** Ring class from the `?mode=` deep link. */
  className,
}: {
  /** False until Convex has validated the session — the query is skipped then. */
  enabled: boolean;
  myRating: number | null;
  onPlayAi: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const status = useQuery(api.queue.myStatus, enabled ? {} : "skip");
  const join = useMutation(api.queue.join);
  const leave = useMutation(api.queue.leave);
  const [pending, setPending] = useState(false);
  const [nowMs, setNowMs] = useState(0);

  const inQueue = status?.inQueue ?? false;
  const joinedAt = status?.joinedAt ?? null;

  // No wall clock during render (react-hooks/purity) and no synchronous setState
  // inside the effect body (react-hooks/set-state-in-effect) — the interval owns both.
  useEffect(() => {
    if (joinedAt === null) return;
    const id = setInterval(() => setNowMs(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [joinedAt]);

  // Mirror the live values into refs so the unmount cleanup can read them
  // without re-registering (and therefore firing) on every change.
  const queuedRef = useRef(false);
  const leaveRef = useRef(leave);
  useEffect(() => {
    queuedRef.current = inQueue;
  }, [inQueue]);
  useEffect(() => {
    leaveRef.current = leave;
  }, [leave]);

  // FR-25: leaving the page gives up the slot. `pagehide` fires on bfcache
  // navigations where `beforeunload` does not; neither is guaranteed to land, so
  // `queue.pair` also drops rows older than 15 minutes.
  useEffect(() => {
    const abandon = () => {
      if (!queuedRef.current) return;
      // The row is deleted by `queue.pair` on a match, so this is usually a no-op;
      // swallow the rejection either way so an unmount cannot log an unhandled one.
      leaveRef.current({}).catch(() => {});
    };
    window.addEventListener("pagehide", abandon);
    return () => {
      window.removeEventListener("pagehide", abandon);
      abandon();
    };
  }, []);

  const elapsedMs = joinedAt === null || nowMs === 0 ? 0 : Math.max(0, nowMs - joinedAt);
  const range = joinedAt === null || nowMs === 0 ? null : queueRangeAt(joinedAt, nowMs);

  async function toggle() {
    if (pending) return;
    setPending(true);
    try {
      if (inQueue) {
        await leave({});
        queuedRef.current = false;
      } else {
        // Claim the slot BEFORE the round trip. `queuedRef` otherwise mirrors
        // `queue.myStatus`, which lands a round trip later, so navigating away in
        // that window skipped the FR-25 cleanup entirely: the row survived, got
        // paired within 5 s, and the abandon sweep forfeited the game for someone
        // who never saw a board. `queue.leave` is idempotent, so an unmount that
        // beats the join costs nothing.
        queuedRef.current = true;
        await join({});
      }
    } catch (error) {
      // Nothing changed server-side — fall back to the last value the
      // subscription gave us so the cleanup does not act on a phantom row.
      queuedRef.current = inQueue;
      toast.error(describeConvexError(error, "Matchmaking is unavailable right now."));
    } finally {
      setPending(false);
    }
  }

  if (inQueue) {
    return (
      <QueuePanelView
        className={className}
        elapsedMs={elapsedMs}
        range={range}
        myRating={myRating}
        pending={pending}
        onCancel={toggle}
        onPlayAi={onPlayAi}
      />
    );
  }

  return (
    <ModeCard
      title="Find a match"
      icon={SwordsIcon}
      description="Rated games against people within ±200 of your rating; the window widens every 10 seconds."
      className={className}
      action={
        <Button onClick={toggle} disabled={pending || disabled} className="w-full">
          {pending ? <LoaderIcon aria-hidden className="motion-safe:animate-spin" /> : null}
          {pending ? "Joining…" : "Find a match"}
        </Button>
      }
    >
      {status === undefined ? (
        <Skeleton className="h-4 w-44" aria-hidden />
      ) : (
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          {myRating === null
            ? "You will be paired with someone close to your rating."
            : `You are rated ${formatRating(myRating)}. Pairing starts within ±${QUEUE_BASE_RANGE}.`}
        </p>
      )}
    </ModeCard>
  );
}
