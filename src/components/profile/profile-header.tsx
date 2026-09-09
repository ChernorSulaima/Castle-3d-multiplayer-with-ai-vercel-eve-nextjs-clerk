"use client";

import { usePreloadedQuery, type Preloaded } from "convex/react";
import type { api } from "../../../convex/_generated/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDate, formatRating, formatRecord, formatWinRate } from "@/lib/format";

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border px-3 py-2.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold tabular-nums">{value}</dd>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/**
 * Preloaded on the server so the name and ratings are in the first HTML payload,
 * then kept live by the same subscription (`usePreloadedQuery`).
 */
export function ProfileHeader({
  preloaded,
}: {
  preloaded: Preloaded<typeof api.players.getByUsername>;
}) {
  const profile = usePreloadedQuery(preloaded);
  if (profile === null) return null;

  return (
    <header className="grid gap-5">
      <div className="flex items-center gap-4">
        <Avatar size="lg" className="size-14">
          <AvatarImage src={profile.avatarUrl} alt="" />
          <AvatarFallback>{profile.username.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">
            {profile.username}
          </h1>
          <p className="text-sm text-muted-foreground">
            Playing since {formatDate(profile.createdAt)}
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Overall" value={formatRating(profile.rating)} />
        <Stat label="vs Humans" value={formatRating(profile.ratingHuman)} />
        <Stat label="vs AI" value={formatRating(profile.ratingAi)} />
        <Stat
          label="Record"
          value={formatRecord(profile)}
          hint={`${formatWinRate(profile)} win rate`}
        />
      </dl>
    </header>
  );
}
