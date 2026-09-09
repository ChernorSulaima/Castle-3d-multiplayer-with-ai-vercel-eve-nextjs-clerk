"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { queueRangeAt } from "@/lib/constants";
import { formatElapsed, formatRating } from "@/lib/format";
import { describeConvexError } from "@/components/providers/convex-errors";

/** The elapsed readout only needs sub-second accuracy. */
const TICK_MS = 500;

export function FindMatchPanel({
  enabled,
  myRating,
  onPlayAi,
}: {
  /** False until Convex has validated the session — the query is skipped then. */
  enabled: boolean;
  myRating: number | null;
  onPlayAi: () => void;
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

  if (status === undefined) {
    return (
      <div className="grid gap-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-32" />
      </div>
    );
  }

  if (!inQueue) {
    return (
      <div className="grid gap-3">
        <p className="text-sm text-muted-foreground">
          {myRating === null
            ? "You will be paired with someone close to your rating."
            : `You are rated ${formatRating(myRating)}. Pairing starts within ±200 and widens by 100 every 10 seconds.`}
        </p>
        <Button onClick={toggle} disabled={pending} className="w-full sm:w-fit">
          {pending ? "Joining…" : "Find match"}
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <div
        aria-live="polite"
        className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm"
      >
        <span className="flex items-center gap-2 font-medium">
          <span
            aria-hidden
            className="size-2 rounded-full bg-emerald-500 motion-safe:animate-pulse"
          />
          Searching
        </span>
        <span className="tabular-nums text-muted-foreground">{formatElapsed(elapsedMs)}</span>
        {range !== null && myRating !== null ? (
          <span className="text-muted-foreground">
            {formatRating(Math.max(0, myRating - range))}–{formatRating(myRating + range)} rating
          </span>
        ) : range !== null ? (
          <span className="text-muted-foreground">±{range} rating</span>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        You will be taken to the board the moment someone is matched — keep this tab open.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={toggle} disabled={pending}>
          {pending ? "Cancelling…" : "Cancel"}
        </Button>
        <Button variant="ghost" onClick={onPlayAi} disabled={pending}>
          Play the AI while you wait
        </Button>
      </div>
    </div>
  );
}
