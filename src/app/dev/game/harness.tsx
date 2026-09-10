"use client";
// src/app/dev/game/harness.tsx  [U2]
// The client half of the §8 harness: it seeds the two client stores from the
// chosen scenario and renders the real `GameShellView` with a mock controller.
// No Clerk, no Convex, no network.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { GameShellView, type GameShellMeta } from "@/components/game/game-shell-view";
import type { ChatCommentaryRow } from "@/components/ai/chat-model";
import { MAX_HINTS_PER_GAME } from "@/lib/constants";
import { errorCopyFor } from "@/lib/errors";
import {
  MOCK_SCENARIOS,
  MOCK_SCENARIO_IDS,
  isMockScenarioId,
  useMockGameController,
} from "@/lib/mock/game-controller";
import { useAiStore } from "@/lib/stores/ai-store";
import { useUiStore } from "@/lib/stores/ui-store";
import { cn, focusRing } from "@/lib/ui";

const DEFAULT_SCENARIO = "ai-midgame";

/** A collapsed pill in the corner so it never covers the layout being reviewed.
 *  Rendered open/closed from state rather than with <details>: a closed
 *  <details> keeps its contents laid out, and a dev control must not be part of
 *  what an audit of this screen measures. */
function ScenarioSwitcher({ current }: { current: string }) {
  const [open, setOpen] = useState(false);
  return (
    // Top-centre, not top-left: the §5.2 focus HUD puts its player chip in the
    // top-left corner and a dev control must never sit on top of the thing under
    // review. It stays in the header's row even at 390, where it overlaps the site
    // nav: the alternative — dropping below the 56px header — lands it on the game's
    // own nameplate and status pill, and covering the chrome is better than
    // covering the subject.
    <div className="fixed top-1.5 left-1/2 z-60 -translate-x-1/2 text-[12px]">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "flex min-h-7 cursor-pointer items-center rounded-full bg-card px-2.5 py-1",
          "font-mono text-foreground shadow-soft pointer-coarse:min-h-9",
          focusRing,
        )}
      >
        ◆ {current}
      </button>
      {open ? (
        <ul className="mt-1 flex w-56 flex-col gap-0.5 rounded-xl bg-card p-1.5 shadow-soft">
          {MOCK_SCENARIO_IDS.map((id) => (
            <li key={id}>
              <Link
                prefetch={false}
                href={`/dev/game?scenario=${id}`}
                aria-current={id === current ? "page" : undefined}
                className={cn(
                  "block rounded-lg px-2 py-1.5",
                  focusRing,
                  id === current
                    ? "font-semibold text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span className="block font-medium">{MOCK_SCENARIOS[id].label}</span>
                <span className="block text-[12px] opacity-80">{MOCK_SCENARIOS[id].summary}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function GameHarness({ scenario: requested }: { scenario: string | null }) {
  const id = isMockScenarioId(requested) ? requested : DEFAULT_SCENARIO;
  const scenario = MOCK_SCENARIOS[id];
  const controller = useMockGameController(scenario);

  // Seed the client stores. These are plain zustand writes, not React state, so
  // they are legal inside an effect (§D.12 rule 6).
  useEffect(() => {
    const ai = useAiStore.getState();
    ai.resetTurn();
    ai.setPhase(scenario.ai.phase);
    ai.setEngineStatus(scenario.ai.engineStatus);
    ai.setDownloadPercent(scenario.ai.downloadPercent);
    ai.setHint(scenario.ai.hint);
    ai.setHintPending(false);
    useUiStore.getState().setLayoutMode(scenario.layoutMode);
  }, [scenario]);

  const requestHint = useCallback(() => {
    useAiStore.getState().setHintPending(true);
    window.setTimeout(() => {
      const ai = useAiStore.getState();
      ai.setHintPending(false);
      ai.setHint({
        san: "O-O",
        text: "Castle. Your king is still in the middle and the d-file is about to open.",
        source: "fallback",
      });
    }, 1200);
  }, []);

  const commentary: ChatCommentaryRow[] = scenario.commentary.map((row, index) => ({
    id: `mock-commentary-${index}`,
    ply: row.ply,
    text: row.text,
    source: row.source,
    persona: row.persona,
  }));

  const remaining = Math.max(0, MAX_HINTS_PER_GAME - scenario.hintsUsed);
  const humanToMove =
    scenario.aiColor !== undefined &&
    controller.view !== null &&
    controller.view.game.turn !== scenario.aiColor;

  const meta: GameShellMeta = {
    commentary,
    opponentStale: false,
    opponentOnline: scenario.mode === "online" ? true : null,
    spectatorCount: scenario.spectatorCount,
    hint: {
      available: scenario.mode === "ai" && scenario.viewerRole !== "spectator",
      remaining,
      max: MAX_HINTS_PER_GAME,
      pending: false,
      disabledReason:
        remaining === 0
          ? errorCopyFor("hint-limit", "game")
          : humanToMove
            ? null
            : "Wait for your turn to ask for a hint.",
      request: requestHint,
    },
    rating: scenario.rating,
    playAgainPending: false,
    onPlayAgain: () => {
      window.location.reload();
    },
    onRetryEngine: () => {
      useAiStore.getState().setEngineStatus("ready");
    },
    roomSettings: (
      <p className="text-[13px] text-muted-foreground">
        The room picker needs a signed-in player, so it is stubbed out in this harness.
        Its drawer, header and scroll behaviour are the real ones.
      </p>
    ),
  };

  return (
    <>
      <ScenarioSwitcher current={id} />
      <GameShellView
        controller={controller}
        viewerRole={scenario.viewerRole}
        meta={meta}
      />
    </>
  );
}
