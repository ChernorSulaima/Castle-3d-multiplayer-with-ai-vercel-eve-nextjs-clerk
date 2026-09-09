"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DIFFICULTIES, DIFFICULTY_ORDER } from "@/lib/difficulty";
import { formatRating } from "@/lib/format";
import type { Colour, Difficulty } from "@/lib/types";
import { describeConvexError } from "@/components/providers/convex-errors";
import { cn } from "@/lib/utils";

type ColourChoice = Colour | "random";

const COLOUR_OPTIONS: ReadonlyArray<{ value: ColourChoice; label: string; hint: string }> = [
  { value: "w", label: "White", hint: "You move first" },
  { value: "b", label: "Black", hint: "The AI opens" },
  { value: "random", label: "Random", hint: "Coin flip" },
];

export function AiSetupDialog({
  open,
  onOpenChange,
  /** Rendered above the form when the caller is leaving the matchmaking queue. */
  notice,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notice?: string;
}) {
  const router = useRouter();
  const createAiGame = useMutation(api.games.createAiGame);
  const [difficulty, setDifficulty] = useState<Difficulty>("casual");
  const [colour, setColour] = useState<ColourChoice>("w");
  const [starting, setStarting] = useState(false);

  const config = DIFFICULTIES[difficulty];

  async function start() {
    if (starting) return;
    setStarting(true);
    // Math.random() in an event handler, never during render (react-hooks/purity).
    const playerColor: Colour = colour === "random" ? (Math.random() < 0.5 ? "w" : "b") : colour;
    try {
      const gameId = await createAiGame({ difficulty, playerColor });
      router.push(`/game/${gameId}`);
    } catch (error) {
      setStarting(false);
      toast.error(describeConvexError(error, "Could not start the game. Try again."));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Play against the computer</DialogTitle>
          <DialogDescription>
            Stockfish generates the candidate moves; the persona chooses between them and tells you
            why. Difficulty cannot be changed once the game starts.
          </DialogDescription>
        </DialogHeader>

        {notice ? (
          <p className="rounded-md border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            {notice}
          </p>
        ) : null}

        <div className="grid gap-2">
          <Label htmlFor="ai-difficulty">Difficulty</Label>
          <Select
            value={difficulty}
            onValueChange={(value) => setDifficulty(value as Difficulty)}
          >
            <SelectTrigger id="ai-difficulty" className="w-full">
              {/* Format the label explicitly rather than relying on Base UI
                  inferring it from the item's rendered text. */}
              <SelectValue>
                {(value: unknown) => {
                  const id = value as Difficulty | null;
                  if (id === null || !(id in DIFFICULTIES)) return "Choose a difficulty";
                  return `${DIFFICULTIES[id].label} · ${formatRating(DIFFICULTIES[id].aiRating)}`;
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {DIFFICULTY_ORDER.map((id) => (
                <SelectItem key={id} value={id}>
                  {DIFFICULTIES[id].label} · {formatRating(DIFFICULTIES[id].aiRating)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* The persona table — every opponent, with the chosen one highlighted. */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <caption className="sr-only">Opponent personas by difficulty</caption>
            <thead>
              <tr className="text-muted-foreground">
                <th scope="col" className="py-1.5 pr-3 font-medium">
                  Level
                </th>
                <th scope="col" className="py-1.5 pr-3 font-medium">
                  Opponent
                </th>
                <th scope="col" className="py-1.5 pr-3 font-medium">
                  Style
                </th>
                <th scope="col" className="py-1.5 text-right font-medium">
                  Rating
                </th>
              </tr>
            </thead>
            <tbody>
              {DIFFICULTY_ORDER.map((id) => {
                const row = DIFFICULTIES[id];
                const selected = id === difficulty;
                return (
                  <tr
                    key={id}
                    aria-selected={selected}
                    className={cn(
                      "border-t border-border/60",
                      selected ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    <td className="py-1.5 pr-3 font-medium whitespace-nowrap">{row.label}</td>
                    <td className="py-1.5 pr-3 whitespace-nowrap">{row.persona.name}</td>
                    <td className="py-1.5 pr-3">{row.persona.blurb}</td>
                    <td className="py-1.5 text-right tabular-nums">
                      {formatRating(row.aiRating)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="rounded-lg border border-border bg-muted/40 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">{config.persona.name}</span>
            <Badge variant="secondary">{config.label}</Badge>
            <Badge variant="outline">{formatRating(config.aiRating)}</Badge>
            {config.hintsAllowed ? <Badge variant="outline">3 hints</Badge> : null}
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">{config.description}</p>
        </div>

        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-medium">Your colour</legend>
          <RadioGroup
            value={colour}
            onValueChange={(value) => setColour(value as ColourChoice)}
            className="grid-cols-3 gap-2"
          >
            {COLOUR_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={cn(
                  "flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 transition-colors",
                  colour === option.value
                    ? "border-primary bg-muted/60"
                    : "border-border hover:bg-muted/40",
                )}
              >
                <RadioGroupItem value={option.value} className="mt-0.5" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{option.label}</span>
                  <span className="block text-xs text-muted-foreground">{option.hint}</span>
                </span>
              </label>
            ))}
          </RadioGroup>
        </fieldset>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={starting}>
            Cancel
          </Button>
          <Button onClick={start} disabled={starting}>
            {starting ? "Starting…" : `Play ${config.persona.name}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
