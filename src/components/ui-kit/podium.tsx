// src/components/ui-kit/podium.tsx  [U0]
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, initials } from "@/lib/ui";

export interface PodiumEntry {
  /** 1, 2 or 3. */
  rank: number;
  name: string;
  rating: number;
  avatarUrl?: string | null;
  /** "18-4-2" or similar. */
  record?: string;
}

export interface PodiumProps extends React.ComponentProps<"ol"> {
  entries: PodiumEntry[];
  /** Wrap each name in a link to the profile. */
  renderName?(entry: PodiumEntry): React.ReactNode;
}

/** Visual order 2 · 1 · 3 on wide screens; reading order stays 1, 2, 3. */
const ORDER_CLASS: Record<number, string> = {
  1: "sm:order-2",
  2: "sm:order-1",
  3: "sm:order-3",
};

/** The top three of a leaderboard (§6): avatar 56, rating in Fraunces 40. */
export function Podium({ entries, renderName, className, ...props }: PodiumProps) {
  return (
    <ol
      className={cn("grid gap-3 sm:grid-cols-3 sm:items-end", className)}
      aria-label="Top three"
      {...props}
    >
      {entries.slice(0, 3).map((entry) => {
        const first = entry.rank === 1;
        return (
          <li
            key={entry.rank}
            className={cn(
              "flex flex-col items-center gap-2 rounded-xl border bg-card px-4 text-center",
              ORDER_CLASS[entry.rank],
              first
                ? "border-primary/50 py-6 shadow-soft"
                : "border-border py-4 sm:py-5",
            )}
          >
            <span className="eyebrow">
              {entry.rank === 1 ? "1st" : entry.rank === 2 ? "2nd" : "3rd"}
            </span>
            <Avatar className={first ? "size-14" : "size-11"}>
              {entry.avatarUrl ? <AvatarImage src={entry.avatarUrl} alt="" /> : null}
              <AvatarFallback>{initials(entry.name)}</AvatarFallback>
            </Avatar>
            <span className="max-w-full truncate text-sm font-medium text-foreground">
              {renderName ? renderName(entry) : entry.name}
            </span>
            <span
              className={cn(
                "font-display tabular text-primary",
                first ? "text-[2.5rem] leading-none" : "text-[1.75rem] leading-none",
              )}
            >
              {entry.rating}
            </span>
            {entry.record ? (
              <span className="tabular font-mono text-[12px] text-muted-foreground">
                {entry.record}
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
