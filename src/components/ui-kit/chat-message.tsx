"use client";
// src/components/ui-kit/chat-message.tsx  [U0]
import { useEffect, useState } from "react";
import { cn } from "@/lib/ui";

export type ChatMessageVariant = "ai" | "you" | "system" | "thinking";

export interface ChatMessageProps extends Omit<React.ComponentProps<"li">, "children"> {
  variant: ChatMessageVariant;
  children?: React.ReactNode;
  /** ai / thinking: the opponent's name, e.g. "Pip". */
  personaName?: string;
  /** ai / thinking: letter for the brass disc. Defaults to the name's first letter. */
  personaInitial?: string;
  /** ai: the move the line is about, e.g. "12. Nf3". */
  moveLabel?: string;
  /** Small brass tag inside the bubble, e.g. "Hint". */
  tag?: string;
  /** thinking: delay before "still thinking…" appears (§5.1). */
  stillThinkingAfterMs?: number;
}

function PersonaDisc({ initial }: { initial: string }) {
  return (
    <span
      aria-hidden
      className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/20 text-[12px] font-medium text-primary"
    >
      {initial}
    </span>
  );
}

/**
 * Three pulsing dots that grow a "still thinking…" tail (§5.1). Its own component
 * so mounting and unmounting resets the timer — a `thinking` bubble that turns
 * into a real message and back must start counting from zero again.
 */
function ThinkingDots({ personaName, afterMs }: { personaName?: string; afterMs: number }) {
  const [still, setStill] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setStill(true), afterMs);
    return () => window.clearTimeout(id);
  }, [afterMs]);

  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden className="inline-flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-1.5 rounded-full bg-muted-foreground motion-safe:animate-pulse"
            style={{ animationDelay: `${i * 300}ms`, animationDuration: "900ms" }}
          />
        ))}
      </span>
      <span className="sr-only">{personaName ? `${personaName} is thinking` : "Thinking"}</span>
      {still ? <span className="text-muted-foreground">still thinking…</span> : null}
    </span>
  );
}

/** One row of the chat. Four layouts, one component (§5.1). */
export function ChatMessage({
  variant,
  children,
  personaName,
  personaInitial,
  moveLabel,
  tag,
  stillThinkingAfterMs = 3000,
  className,
  ...props
}: ChatMessageProps) {
  if (variant === "system") {
    return (
      <li className={cn("flex justify-center py-1", className)} {...props}>
        <span className="rounded-full bg-bg-sunken px-2.5 py-1 text-[12px] text-muted-foreground">
          {children}
        </span>
      </li>
    );
  }

  if (variant === "you") {
    return (
      <li className={cn("flex justify-end", className)} {...props}>
        {/* DESIGN.md `chat-bubble-you` and The One Metal Rule: the player's own
            bubbles are SEAM, never a brass wash — a brass fill read as a pressable
            surface, and brass is reserved for things you can press.
            The TEXT, though, can only be brass where brass is readable: light brass
            (--accent #806018) on light seam (--line #d9cdb7) is 3.71:1, under the
            4.5:1 floor, so light mode sets the label in ink (--fg on --line, 11.70:1)
            and dark keeps the brass it earns (#c9a24a on #2d241b, 6.34:1). Both
            pairs are asserted against globals.css in src/lib/ui/__tests__/contrast.test.ts. */}
        <div className="max-w-[88%] rounded-xl rounded-tr-sm bg-line px-3 py-2 text-[13px] text-foreground motion-safe:animate-in motion-safe:zoom-in-98 motion-safe:duration-150 dark:text-primary">
          {children}
        </div>
      </li>
    );
  }

  const initial = personaInitial ?? personaName?.[0]?.toUpperCase() ?? "AI";

  return (
    <li className={cn("flex gap-2", className)} {...props}>
      <PersonaDisc initial={initial} />
      <div className="min-w-0 max-w-[88%]">
        {personaName || moveLabel ? (
          <p className="mb-1 flex items-baseline gap-1.5 text-[12px] text-muted-foreground">
            {personaName ? <span className="font-medium text-foreground">{personaName}</span> : null}
            {moveLabel ? <span className="tabular font-mono">{moveLabel}</span> : null}
          </p>
        ) : null}
        <div className="rounded-xl rounded-tl-sm border border-border bg-card px-3 py-2 text-[13px] text-foreground motion-safe:animate-in motion-safe:zoom-in-98 motion-safe:duration-150">
          {tag ? (
            <>
              <span className="mr-1.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-[12px] font-medium tracking-wide text-primary uppercase">
                {tag}
              </span>
              {/* Inline children concatenate with no separator, so the hint bubble
                  announced as "HintNf3 …". A real one, for readers only. */}
              <span className="sr-only">: </span>
            </>
          ) : null}
          {variant === "thinking" ? (
            <ThinkingDots personaName={personaName} afterMs={stillThinkingAfterMs} />
          ) : (
            children
          )}
        </div>
      </div>
    </li>
  );
}
