import type { Metadata } from "next";
import { LeaderboardTable } from "@/components/leaderboard/leaderboard-table";
import { LEADERBOARD_SIZE } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Leaderboard",
  description: `The top ${LEADERBOARD_SIZE} players by rating, updating live.`,
};

/** Public (§G) — `leaderboard.top` needs no identity. */
export default function LeaderboardPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Leaderboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The top {LEADERBOARD_SIZE} players, updating live as games finish.
        </p>
      </header>
      <LeaderboardTable />
    </div>
  );
}
