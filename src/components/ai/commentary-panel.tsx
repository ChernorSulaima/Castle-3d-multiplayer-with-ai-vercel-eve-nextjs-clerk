"use client";
// src/components/ai/commentary-panel.tsx — FR-37
//
// The AI's voice: persona identity, live thinking state, and the persisted
// commentary trail from the `commentary` table (which lives off the game document
// on purpose — §I-3).
//
// FR-37 asks for "streamed if possible" and it is NOT possible under FR-36's
// structured output: a per-turn `outputSchema` routes the answer through a hidden
// `final_output` tool whose deltas eve filters out of the event stream (§I-8,
// eve-agent.md A.1/A.6). The panel therefore renders NDJSON `status` heartbeats as a
// live thinking state and reveals the commentary in one piece when the result lands.
// `streamingCommentary` is still honoured so a future streaming transport needs no
// change here.
//
// Drop-in for P3: `<CommentaryPanel gameId={gameId} onRetryEngine={ai.retryEngine} />`.
import { useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ENGINE_BUILD_LABEL, type EngineBuild } from "@/lib/constants";
import { DIFFICULTIES } from "@/lib/difficulty";
import { useAiStore } from "@/lib/stores/ai-store";
import { useUiStore } from "@/lib/stores/ui-store";
import type { Difficulty, GameId } from "@/lib/types";
import { cn } from "cn";
import { AiThinkingIndicator } from "./ai-thinking-indicator";
import { EngineLoading } from "./engine-loading";

export interface CommentaryPanelProps {
  gameId: GameId;
  /** Wire to `useAiTurn(...).retryEngine` so a failed engine load can be retried. */
  onRetryEngine?: () => void;
  /** Show the eve/fallback provenance badge. Defaults to true. */
  showSource?: boolean;
  className?: string;
}

export function CommentaryPanel({
  gameId,
  onRetryEngine,
  showSource = true,
  className,
}: CommentaryPanelProps) {
  const view = useQuery(api.games.get, { gameId });
  const rows = useQuery(api.commentary.forGame, { gameId });
  const streaming = useAiStore((s) => s.streamingCommentary);
  const lastSource = useAiStore((s) => s.lastSource);
  const lastLatencyMs = useAiStore((s) => s.lastLatencyMs);
  const error = useAiStore((s) => s.error);
  const engineBuild = useUiStore((s) => s.engineBuild);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const count = rows?.length ?? 0;
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [count, streaming]);

  const game = view?.game ?? null;
  if (game === null || game.mode !== "ai") return null;

  const difficulty = (game.difficulty ?? "casual") as Difficulty;
  const config = DIFFICULTIES[difficulty];
  const commentary = rows ?? [];

  return (
    <section
      className={cn("flex min-h-0 flex-col gap-3", className)}
      aria-labelledby="ai-commentary-heading"
      data-slot="commentary-panel"
    >
      <header className="flex flex-wrap items-center gap-2">
        <h2 id="ai-commentary-heading" className="text-sm font-semibold">
          {config.persona.name}
        </h2>
        <Badge variant="secondary">{config.label}</Badge>
        {showSource && lastSource !== null ? (
          <Badge
            variant={lastSource === "eve" ? "outline" : "ghost"}
            title={
              (lastSource === "eve"
                ? `Move chosen by the agent${latencyLabel(lastLatencyMs)}`
                : `Agent unavailable — engine move played${latencyLabel(lastLatencyMs)}`) +
              buildTitle(engineBuild)
            }
            className="ml-auto font-mono text-[12px] uppercase"
          >
            {lastSource}
            {engineBuild !== null ? (
              // Which Stockfish binary produced the candidates: sf18 by default,
              // sf11 on a browser without WASM SIMD (§I-1).
              <span className="ml-1 opacity-60">{ENGINE_BUILD_LABEL[engineBuild]}</span>
            ) : null}
          </Badge>
        ) : null}
      </header>

      <p className="text-xs text-muted-foreground">{config.persona.blurb}</p>

      <EngineLoading onRetry={onRetryEngine} />
      <AiThinkingIndicator name={config.persona.name} />

      {error !== null ? (
        <p role="alert" className="text-xs text-destructive">
          {friendlyError(error)}
        </p>
      ) : null}

      <ScrollArea className="min-h-24 flex-1">
        <ul className="flex flex-col gap-2 pr-3" aria-live="polite" aria-relevant="additions">
          {commentary.length === 0 && streaming.length === 0 ? (
            <li className="text-xs text-muted-foreground">
              {config.persona.name} will comment once the game is under way.
            </li>
          ) : null}
          {commentary.map((row) => (
            <li
              key={row._id}
              className="rounded-lg border border-border bg-card px-2.5 py-2 text-sm"
            >
              <span className="mr-1.5 font-mono text-[12px] text-muted-foreground">
                {plyLabel(row.ply)}
              </span>
              {row.text}
              {showSource && row.source === "fallback" ? (
                <span className="ml-1.5 font-mono text-[12px] text-muted-foreground">
                  (engine)
                </span>
              ) : null}
            </li>
          ))}
          {streaming.length > 0 ? (
            <li className="rounded-lg border border-dashed border-border px-2.5 py-2 text-sm opacity-80">
              {streaming}
            </li>
          ) : null}
          <div ref={bottomRef} />
        </ul>
      </ScrollArea>
    </section>
  );
}

/** `moves.length` after the AI move -> "12." / "12…" in standard notation. */
function plyLabel(ply: number): string {
  const moveNumber = Math.ceil(ply / 2);
  return ply % 2 === 1 ? `${moveNumber}.` : `${moveNumber}…`;
}

function latencyLabel(ms: number | null): string {
  return ms === null ? "" : ` in ${(ms / 1000).toFixed(1)}s`;
}

function buildTitle(build: EngineBuild | null): string {
  if (build === null) return "";
  return build === "sf18"
    ? " · candidates from Stockfish 18 (lite-single)"
    : " · candidates from Stockfish 11 (compatibility engine, no WASM SIMD)";
}

function friendlyError(code: string): string {
  switch (code) {
    case "no-legal-moves":
      return "No legal move is available.";
    case "not-a-participant":
      return "You are watching this game, so the AI turn is driven by the players.";
    default:
      return "The AI had trouble moving. Retrying…";
  }
}
