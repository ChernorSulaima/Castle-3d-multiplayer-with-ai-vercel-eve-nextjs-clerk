"use client";
// src/components/ai/game-chat.tsx  [U2]
// The Chat tab of UI_REDESIGN §5.1 — the rebuild of the old `commentary-panel`.
//
// It is a PURE view: persisted commentary arrives as plain rows (the container
// runs `api.commentary.forGame`), and the only live source it reads is the
// ai-store, which is client state, not Convex. That is what lets /dev/game
// render the real chat with no backend at all.
import { useEffect, useRef } from "react";
import { LightbulbIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatList, ChatMessage } from "@/components/ui-kit";
import { useAiStore } from "@/lib/stores/ai-store";
import { cn } from "@/lib/ui";
import type { Colour, GameMode } from "@/lib/types";
import { buildChatItems, type ChatCommentaryRow } from "./chat-model";
import { EngineLoading } from "./engine-loading";

/** One centred chip in the transcript: draw offers, presence, the result line. */
export interface ChatSystemChip {
  id: string;
  text: string;
  /** Where it belongs in ply order; system chips without a ply land at the end. */
  ply?: number;
}

export interface ChatHintState {
  /** False hides the composer entirely (not an AI game, no hints at this level, spectator). */
  available: boolean;
  remaining: number;
  max: number;
  pending: boolean;
  /** Non-null disables the button and explains why. */
  disabledReason: string | null;
  request(): void;
}

export interface GameChatProps {
  mode: GameMode;
  /** SAN list, oldest first. */
  moves: string[];
  commentary: ChatCommentaryRow[];
  aiColor?: Colour;
  personaName: string;
  /** How the human's own moves read: "You" for a player, their name for a spectator. */
  moverLabel: string;
  systemChips: ChatSystemChip[];
  hint: ChatHintState;
  onRetryEngine?(): void;
  className?: string;
}

export function GameChat({
  mode,
  moves,
  commentary,
  aiColor,
  personaName,
  moverLabel,
  systemChips,
  hint,
  onRetryEngine,
  className,
}: GameChatProps) {
  const phase = useAiStore((s) => s.phase);
  const engineStatus = useAiStore((s) => s.engineStatus);
  const streaming = useAiStore((s) => s.streamingCommentary);
  const hintResult = useAiStore((s) => s.hint);
  const hintPending = useAiStore((s) => s.hintPending);

  // ChatList only follows the conversation once it GROWS, so a chat that is
  // already long on first paint would open at the oldest message — and §5.3's
  // 40% sheet peek exists precisely so the newest bubble is the one you see.
  // One anchor, scrolled into view after the first layout pass.
  const bottomRef = useRef<HTMLLIElement | null>(null);
  useEffect(() => {
    const pin = () => bottomRef.current?.scrollIntoView({ block: "nearest" });
    // Three passes: the current commit, the next frame (images/glyphs laid out)
    // and once more after the web fonts have swapped, which changes every
    // bubble's height and would otherwise leave the list a message short.
    pin();
    const frame = requestAnimationFrame(pin);
    const timer = window.setTimeout(pin, 250);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, []);

  const isAi = mode === "ai";
  const items = buildChatItems({
    mode,
    moves,
    commentary,
    aiColor,
    personaName,
    moverLabel,
  });

  // System chips interleave by ply; anything without one is "now".
  const merged = [
    ...items.map((item, index) => ({ item, ply: item.ply, order: index })),
    ...systemChips.map((chip, index) => ({
      item: { kind: "system" as const, id: chip.id, ply: chip.ply ?? Number.MAX_SAFE_INTEGER, text: chip.text },
      ply: chip.ply ?? Number.MAX_SAFE_INTEGER,
      order: items.length + index,
    })),
  ].sort((a, b) => a.ply - b.ply || a.order - b.order);

  const thinking = isAi && phase !== "idle";
  const askedForHint = isAi && (hintPending || hintResult !== null);
  const engineBusy = isAi && engineStatus !== "idle" && engineStatus !== "ready";

  // Everything that can appear after the last persisted line, so ChatList knows
  // when to follow the scroll.
  const liveCount =
    (engineBusy ? 1 : 0) +
    (askedForHint ? 1 : 0) +
    (hintResult !== null ? 1 : 0) +
    (thinking ? 1 : 0) +
    (streaming.length > 0 ? 1 : 0);

  return (
    <ChatList
      className={className}
      label={isAi ? `Conversation with ${personaName}` : "Game events"}
      messageCount={merged.length + liveCount}
      empty={
        isAi
          ? `${personaName} will say something once the game is under way.`
          : "Commentary is available in games against the AI."
      }
      footer={
        hint.available ? (
          <div className="flex flex-col gap-1.5">
            <Button
              // `aria-disabled`, not `disabled`, so the button keeps its tooltip and
              // stays in the tab order to explain itself — but it has to LOOK
              // unavailable too, the same 50% the action bar's blocked buttons use.
              className="w-full aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
              aria-disabled={hint.disabledReason !== null || undefined}
              aria-label={`Ask for a hint. ${hint.remaining} of ${hint.max} left.`}
              title={hint.disabledReason ?? undefined}
              onClick={() => {
                if (hint.disabledReason === null) hint.request();
              }}
            >
              <LightbulbIcon aria-hidden />
              {hint.pending ? "Thinking…" : "Ask for a hint"}
              <span className="tabular text-[12px] opacity-80">{hint.remaining} left</span>
            </Button>
            {hint.disabledReason !== null ? (
              <p className="text-center text-[12px] text-muted-foreground">
                {hint.disabledReason}
              </p>
            ) : null}
          </div>
        ) : isAi ? null : (
          <p className="text-center text-[12px] text-muted-foreground">
            Commentary is available in games against the AI.
          </p>
        )
      }
    >
      {merged.map(({ item }) => {
        if (item.kind === "system") {
          return (
            <ChatMessage key={item.id} variant="system">
              {item.text}
            </ChatMessage>
          );
        }
        if (item.kind === "you") {
          return (
            <ChatMessage key={item.id} variant="you">
              {item.text}
            </ChatMessage>
          );
        }
        return (
          <ChatMessage
            key={item.id}
            variant="ai"
            personaName={item.personaName}
            moveLabel={item.moveLabel}
            tag={item.tag}
          >
            {item.text}
          </ChatMessage>
        );
      })}

      {engineBusy ? (
        <ChatMessage
          key="engine"
          variant="system"
          className={cn("[&>span]:w-full [&>span]:max-w-[16rem]")}
        >
          <EngineLoading onRetry={onRetryEngine} />
        </ChatMessage>
      ) : null}

      {askedForHint ? (
        <ChatMessage key="hint-request" variant="you">
          Hint requested
        </ChatMessage>
      ) : null}

      {hintPending ? (
        <ChatMessage key="hint-thinking" variant="thinking" personaName={personaName} />
      ) : null}

      {hintResult !== null ? (
        <ChatMessage key="hint-result" variant="ai" personaName={personaName} tag="Hint">
          <strong className="tabular font-mono font-medium">{hintResult.san}</strong>{" "}
          {hintResult.text.length > 0 ? <span>{hintResult.text}</span> : null}
        </ChatMessage>
      ) : null}

      {streaming.length > 0 ? (
        <ChatMessage key="streaming" variant="ai" personaName={personaName}>
          {streaming}
        </ChatMessage>
      ) : null}

      {thinking && streaming.length === 0 ? (
        <ChatMessage key="thinking" variant="thinking" personaName={personaName} />
      ) : null}

      <li key="bottom" ref={bottomRef} aria-hidden className="h-px shrink-0" />
    </ChatList>
  );
}
