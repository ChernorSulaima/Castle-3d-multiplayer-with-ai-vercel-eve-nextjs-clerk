"use client";
// src/components/game/accessibility/san-input.tsx  [P3]
// NFR-7: keyboard move entry. Accepts SAN ("Nf3", "exd5", "O-O") and LAN
// ("e2e4") — the controller parses it with chess.js's permissive parser.
import { useCallback, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface SanInputProps {
  disabled: boolean;
  onSubmitSan(san: string): Promise<void>;
}

export function SanInput({ disabled, onSubmitSan }: SanInputProps) {
  const id = useId();
  const [value, setValue] = useState("");

  const submit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const text = value.trim();
      if (text.length === 0) return;
      setValue("");
      await onSubmitSan(text);
    },
    [value, onSubmitSan],
  );

  return (
    <form
      className="flex items-end gap-2"
      onSubmit={(event) => {
        void submit(event);
      }}
    >
      <div className="flex-1 space-y-1">
        <Label htmlFor={id} className="text-xs text-muted-foreground">
          Move (SAN or e2e4)
        </Label>
        <Input
          id={id}
          name="san"
          value={value}
          disabled={disabled}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Nf3"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          aria-describedby={`${id}-help`}
        />
        <p id={`${id}-help`} className="sr-only">
          Type a move in standard algebraic notation and press Enter to play it.
        </p>
      </div>
      <Button type="submit" size="sm" disabled={disabled || value.trim().length === 0}>
        Play
      </Button>
    </form>
  );
}
