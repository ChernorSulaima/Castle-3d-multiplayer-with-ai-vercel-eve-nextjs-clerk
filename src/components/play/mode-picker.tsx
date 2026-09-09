"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AiSetupDialog } from "@/components/play/ai-setup-dialog";
import { FindMatchPanel } from "@/components/play/find-match-panel";
import { LocalSetupDialog } from "@/components/play/local-setup-dialog";
import { SpectateList } from "@/components/play/spectate-list";
import type { GameId } from "@/lib/types";
import { describeConvexError } from "@/components/providers/convex-errors";

const QUEUE_NOTICE =
  "Starting an AI game takes you out of the matchmaking queue — a player can only have one game going at a time.";

/**
 * The `/play` lobby. Also owns the FR-24 auto-redirect: `games.myActiveGame` is a
 * live subscription, so when `queue.pair` creates the game BOTH clients see the
 * id appear and navigate. No polling.
 */
export function ModePicker() {
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();
  const me = useQuery(api.players.me, isAuthenticated ? {} : "skip");
  const activeGameId = useQuery(api.games.myActiveGame, isAuthenticated ? {} : "skip");
  const leaveQueue = useMutation(api.queue.leave);

  const [aiOpen, setAiOpen] = useState(false);
  const [aiNotice, setAiNotice] = useState<string | undefined>(undefined);
  const [localOpen, setLocalOpen] = useState(false);

  // "unset" until the first subscription value lands. A game that already exists
  // when the page opens is offered as "Resume", never force-navigated — only a
  // NEW id (i.e. a pairing that happened while we were watching) redirects.
  const baseline = useRef<"unset" | GameId | null>("unset");

  useEffect(() => {
    if (activeGameId === undefined) return;
    if (baseline.current === "unset") {
      baseline.current = activeGameId;
      return;
    }
    if (activeGameId !== null && activeGameId !== baseline.current) {
      baseline.current = activeGameId;
      toast.success("Match found — good luck.");
      router.push(`/game/${activeGameId}`);
    }
  }, [activeGameId, router]);

  async function playAiFromQueue() {
    try {
      await leaveQueue({});
    } catch (error) {
      toast.error(describeConvexError(error, "Could not leave the queue."));
      return;
    }
    setAiNotice(QUEUE_NOTICE);
    setAiOpen(true);
  }

  function playAi() {
    setAiNotice(undefined);
    setAiOpen(true);
  }

  return (
    <div className="grid gap-6">
      {activeGameId ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3">
          <p className="text-sm">
            You have a game in progress. Finish or resign it before starting another.
          </p>
          <Link href={`/game/${activeGameId}`} className={buttonVariants({ size: "sm" })}>
            Resume game
          </Link>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Find match</CardTitle>
            <CardDescription>
              Rated game against another player, paired by rating.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FindMatchPanel
              enabled={isAuthenticated}
              myRating={me?.ratingHuman ?? null}
              onPlayAi={playAiFromQueue}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Play vs AI</CardTitle>
            <CardDescription>
              Five difficulties, five personalities. Rated against a fixed AI rating.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={playAi} className="w-full sm:w-fit">
              Choose an opponent
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Local 2 player</CardTitle>
            <CardDescription>
              Pass and play on one device. The board flips between turns.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="secondary"
              onClick={() => setLocalOpen(true)}
              className="w-full sm:w-fit"
            >
              Set up a local game
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Spectate</CardTitle>
          <CardDescription>
            Every online game in progress, live. Watching is read-only.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SpectateList />
        </CardContent>
      </Card>

      <AiSetupDialog open={aiOpen} onOpenChange={setAiOpen} notice={aiNotice} />
      <LocalSetupDialog open={localOpen} onOpenChange={setLocalOpen} />
    </div>
  );
}
