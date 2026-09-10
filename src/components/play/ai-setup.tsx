"use client";
// src/components/play/ai-setup.tsx  [U4]
// The "Play the AI" card's inline setup (UI_REDESIGN §6): the five personas as
// selectable chips with their line of character, and the colour choice. This
// replaces the old modal dialog — nothing about the mutation changed, only where
// the choices are made.
import { useState } from "react";
import { LoaderIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DIFFICULTIES, DIFFICULTY_ORDER } from "@/lib/difficulty";
import { formatRating } from "@/lib/format";
import type { Colour, Difficulty } from "@/lib/types";
import { cn, focusRing } from "@/lib/ui";

export type ColourChoice = Colour | "random";

const COLOUR_OPTIONS: ReadonlyArray<{ value: ColourChoice; label: string; hint: string }> = [
  { value: "w", label: "White", hint: "You move first" },
  { value: "b", label: "Black", hint: "The AI opens" },
  { value: "random", label: "Random", hint: "Coin flip" },
];

function Chip({
  selected,
  className,
  ...props
}: React.ComponentProps<"button"> & { selected: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "rounded-full border px-2.5 py-1 text-[13px] leading-none transition-colors",
        focusRing,
        selected
          ? "border-primary bg-primary/15 text-primary"
          : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export interface AiSetupProps {
  /** Fires with the resolved colour — "random" is decided here, in the handler. */
  onStart(difficulty: Difficulty, playerColor: Colour): void;
  starting?: boolean;
  disabled?: boolean;
  /** Shown above the chips when the player was just taken out of the queue. */
  notice?: string;
}

export function AiSetup({ onStart, starting = false, disabled = false, notice }: AiSetupProps) {
  const [difficulty, setDifficulty] = useState<Difficulty>("casual");
  const [colour, setColour] = useState<ColourChoice>("w");
  const config = DIFFICULTIES[difficulty];

  function start() {
    if (starting || disabled) return;
    // Math.random() in an event handler, never during render (react-hooks/purity).
    const playerColor: Colour = colour === "random" ? (Math.random() < 0.5 ? "w" : "b") : colour;
    onStart(difficulty, playerColor);
  }

  return (
    <div className="flex h-full flex-col gap-3">
      {notice ? (
        <p className="rounded-lg border border-border bg-bg-sunken px-3 py-2 text-[12px] leading-relaxed text-muted-foreground">
          {notice}
        </p>
      ) : null}

      <div role="group" aria-label="Opponent" className="flex flex-wrap gap-1.5">
        {DIFFICULTY_ORDER.map((id) => (
          <Chip
            key={id}
            selected={id === difficulty}
            onClick={() => setDifficulty(id)}
            title={`${DIFFICULTIES[id].label} · ${formatRating(DIFFICULTIES[id].aiRating)}`}
          >
            {DIFFICULTIES[id].persona.name}
          </Chip>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-bg-sunken p-3">
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm font-medium text-foreground">
          {config.persona.name}
          <span className="text-[12px] font-normal text-muted-foreground">
            {config.label}
            <span className="tabular font-mono"> · {formatRating(config.aiRating)}</span>
            {config.hintsAllowed ? " · 3 hints" : null}
          </span>
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
          {config.persona.blurb}
        </p>
      </div>

      <div className="grid gap-1.5">
        <span id="ai-colour-label" className="text-[12px] text-muted-foreground">
          Your colour
        </span>
        <div
          role="group"
          aria-labelledby="ai-colour-label"
          className="flex flex-wrap gap-1.5"
        >
          {COLOUR_OPTIONS.map((option) => (
            <Chip
              key={option.value}
              selected={option.value === colour}
              onClick={() => setColour(option.value)}
              title={option.hint}
            >
              {option.label}
            </Chip>
          ))}
        </div>
      </div>

      <Button onClick={start} disabled={starting || disabled} className="mt-auto w-full">
        {starting ? <LoaderIcon aria-hidden className="motion-safe:animate-spin" /> : null}
        {starting ? "Starting…" : `Play ${config.persona.name}`}
      </Button>
    </div>
  );
}
