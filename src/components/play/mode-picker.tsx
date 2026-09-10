"use client";
// src/components/play/mode-picker.tsx  [U4]
// The /play lobby of UI_REDESIGN §6: three mode cards with their setup inline,
// the queue panel replacing the matchmaking card while searching, and the
// "Live now" spectate grid underneath.
//
// The FR-24 auto-redirect is unchanged: `games.myActiveGame` is a live
// subscription, so when `queue.pair` creates the game BOTH clients see the id
// appear and navigate. No polling.
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { BotIcon, UsersIcon } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { buttonVariants } from "@/components/ui/button";
import { ModeCard } from "@/components/ui-kit";
import { AiSetup } from "@/components/play/ai-setup";
import { FindMatchPanel } from "@/components/play/find-match-panel";
import { LocalSetup } from "@/components/play/local-setup";
import { SpectateList } from "@/components/play/spectate-list";
import type { Colour, Difficulty, GameId } from "@/lib/types";
import { describeConvexError } from "@/components/providers/convex-errors";

const QUEUE_NOTICE =
  "Starting an AI game takes you out of the matchmaking queue — a player can only have one game going at a time.";

/** The modes the landing page deep-links to with `/play?mode=…` (§3). */
type Mode = "match" | "ai" | "local";

const MODE_ALIASES: Record<string, Mode> = {
  match: "match",
  online: "match",
  find: "match",
  ai: "ai",
  computer: "ai",
  local: "local",
  pass: "local",
};

function modeFromParam(raw: string | null): Mode | null {
  if (raw === null) return null;
  return MODE_ALIASES[raw.toLowerCase()] ?? null;
}

export function ModePicker() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated } = useConvexAuth();
  const me = useQuery(api.players.me, isAuthenticated ? {} : "skip");
  const activeGameId = useQuery(api.games.myActiveGame, isAuthenticated ? {} : "skip");
  const leaveQueue = useMutation(api.queue.leave);
  const createAiGame = useMutation(api.games.createAiGame);
  const createLocalGame = useMutation(api.games.createLocalGame);

  // §6: "honour ?mode= deep links from the landing by expanding that card". The
  // highlight is the only thing the parameter drives — every card stays usable.
  const deepLinked = modeFromParam(searchParams.get("mode"));

  const [aiNotice, setAiNotice] = useState<string | undefined>(undefined);
  const [starting, setStarting] = useState<Mode | null>(null);

  // FR-26: the server refuses a second game (`already-in-game`), so the controls
  // that would start one are disabled rather than left to fail on submit.
  const hasActiveGame = Boolean(activeGameId);

  // "unset" until the first subscription value lands. A game that already exists
  // when the page opens is offered as "Resume", never force-navigated — only a
  // NEW id (i.e. a pairing that happened while we were watching) redirects.
  const baseline = useRef<"unset" | GameId | null>("unset");

  // An AI or local game created from this page ALSO makes a new id appear in
  // `myActiveGame`, and we are already navigating to it. Set before the create
  // mutation is awaited — Convex resolves that promise having already pushed the
  // new query value, so a flag set afterwards can lose the race. Cleared again if
  // the mutation rejects, so a later real pairing still redirects.
  const selfStarting = useRef(false);
  const noteSelfStart = useCallback((value: boolean) => {
    selfStarting.current = value;
  }, []);

  useEffect(() => {
    if (activeGameId === undefined) return;
    if (baseline.current === "unset") {
      baseline.current = activeGameId;
      return;
    }
    if (activeGameId !== null && activeGameId !== baseline.current) {
      baseline.current = activeGameId;
      if (selfStarting.current) return;
      toast.success("Match found — good luck.");
      router.push(`/game/${activeGameId}`);
    }
  }, [activeGameId, router]);

  async function startAi(difficulty: Difficulty, playerColor: Colour) {
    if (starting !== null) return;
    setStarting("ai");
    noteSelfStart(true);
    try {
      const gameId = await createAiGame({ difficulty, playerColor });
      router.push(`/game/${gameId}`);
    } catch (error) {
      setStarting(null);
      noteSelfStart(false);
      toast.error(describeConvexError(error, "Could not start the game. Try again."));
    }
  }

  async function startLocal(playerTwoName: string) {
    if (starting !== null) return;
    setStarting("local");
    noteSelfStart(true);
    try {
      const gameId = await createLocalGame(
        playerTwoName.length > 0 ? { playerTwoName } : {},
      );
      router.push(`/game/${gameId}`);
    } catch (error) {
      setStarting(null);
      noteSelfStart(false);
      toast.error(describeConvexError(error, "Could not start the game. Try again."));
    }
  }

  async function playAiFromQueue() {
    try {
      await leaveQueue({});
    } catch (error) {
      toast.error(describeConvexError(error, "Could not leave the queue."));
      return;
    }
    setAiNotice(QUEUE_NOTICE);
  }

  /** The brass ring the deep link puts on one card. */
  const ring = (mode: Mode) =>
    deepLinked === mode ? "border-primary ring-2 ring-primary/30" : undefined;

  return (
    <div className="grid gap-10">
      {activeGameId ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/40 bg-primary/8 px-4 py-3">
          <p className="text-sm text-foreground">
            You have a game in progress. Finish or resign it before starting another.
          </p>
          <Link
            prefetch={false}
            href={`/game/${activeGameId}`}
            className={buttonVariants({ size: "sm" })}
          >
            Resume game
          </Link>
        </div>
      ) : null}

      {/* The visible label for this band is the page eyebrow ("Choose a mode"),
          so the heading that keeps the outline intact is screen-reader only —
          without it the ModeCard <h3>s would follow the page <h1> directly. */}
      <section aria-labelledby="ways-to-play" className="grid gap-4">
        <h2 id="ways-to-play" className="sr-only">
          Ways to play
        </h2>
        <div className="grid items-stretch gap-4 lg:grid-cols-3">
          {/* Renders the mode card, or the queue panel in its place while searching. */}
          <FindMatchPanel
            enabled={isAuthenticated}
            myRating={me?.ratingHuman ?? null}
            disabled={hasActiveGame || starting !== null}
            onPlayAi={playAiFromQueue}
            className={ring("match")}
          />

          <ModeCard
            title="Play the AI"
            icon={BotIcon}
            description="Five opponents from Beginner to Grandmaster. Each one explains its moves."
            className={ring("ai")}
          >
            <AiSetup
              onStart={startAi}
              starting={starting === "ai"}
              disabled={hasActiveGame || starting !== null}
              notice={aiNotice}
            />
          </ModeCard>

          <ModeCard
            title="Pass and play"
            icon={UsersIcon}
            description="Two people, one device. The board turns to face whoever is to move."
            className={ring("local")}
          >
            <LocalSetup
              onStart={startLocal}
              starting={starting === "local"}
              disabled={hasActiveGame || starting !== null}
            />
          </ModeCard>
        </div>
      </section>

      <section aria-labelledby="live-now" className="grid gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="live-now" className="eyebrow">
            Live now
          </h2>
          <p className="text-[13px] text-muted-foreground">
            Every online game in progress. Watching is read-only.
          </p>
        </div>
        <SpectateList enabled={isAuthenticated} />
      </section>
    </div>
  );
}
