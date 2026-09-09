import type { Metadata } from "next";
import { ModePicker } from "@/components/play/mode-picker";

export const metadata: Metadata = { title: "Play" };

export default function PlayPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Play</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Four ways in: matchmaking, the computer, a friend beside you, or someone else&rsquo;s game.
        </p>
      </header>
      <ModePicker />
    </div>
  );
}
