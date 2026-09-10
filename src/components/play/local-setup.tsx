"use client";
// src/components/play/local-setup.tsx  [U4]
// "Pass and play" with the Player 2 field inline on the card (UI_REDESIGN §6).
import { useId, useState } from "react";
import { LoaderIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MAX_LOCAL_NAME_LENGTH } from "@/lib/constants";

export interface LocalSetupProps {
  /** Empty string means "use the default Player 2 name". */
  onStart(playerTwoName: string): void;
  starting?: boolean;
  disabled?: boolean;
}

export function LocalSetup({ onStart, starting = false, disabled = false }: LocalSetupProps) {
  const id = useId();
  const [playerTwoName, setPlayerTwoName] = useState("");

  return (
    <form
      className="flex h-full flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (starting || disabled) return;
        onStart(playerTwoName.trim());
      }}
    >
      <div className="grid gap-1.5">
        <Label htmlFor={id} className="text-[12px] font-normal text-muted-foreground">
          Player 2 name
        </Label>
        <Input
          id={id}
          value={playerTwoName}
          maxLength={MAX_LOCAL_NAME_LENGTH}
          placeholder="Player 2"
          autoComplete="off"
          disabled={disabled}
          onChange={(event) => setPlayerTwoName(event.target.value)}
        />
        <p className="text-[12px] text-muted-foreground">
          Optional, up to {MAX_LOCAL_NAME_LENGTH} characters. You play White, and the game is
          never rated.
        </p>
      </div>

      <Button
        type="submit"
        variant="secondary"
        disabled={starting || disabled}
        className="mt-auto w-full"
      >
        {starting ? <LoaderIcon aria-hidden className="motion-safe:animate-spin" /> : null}
        {starting ? "Starting…" : "Start the game"}
      </Button>
    </form>
  );
}
