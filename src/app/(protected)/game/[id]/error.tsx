"use client";
// src/app/(protected)/game/[id]/error.tsx  [P3]
import { useEffect } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";

export default function GameError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[game] route error", error);
  }, [error]);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-start gap-3 p-6">
      <h1 className="text-xl font-semibold">This game could not be loaded</h1>
      <p className="text-sm text-muted-foreground">
        The connection to the game may have dropped, or you may not have access to it.
      </p>
      <div className="flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <Link prefetch={false} href="/play" className={buttonVariants({ variant: "outline" })}>
          Back to play
        </Link>
      </div>
    </div>
  );
}
