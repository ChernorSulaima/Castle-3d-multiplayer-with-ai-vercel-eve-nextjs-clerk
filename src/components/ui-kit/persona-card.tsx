// src/components/ui-kit/persona-card.tsx  [U0]
import { cn } from "@/lib/ui";

export interface PersonaCardProps extends React.ComponentProps<"div"> {
  name: string;
  /** "Beginner" … "Grandmaster". */
  difficulty: string;
  /** One sentence of character, from DIFFICULTIES[...].persona.blurb. */
  blurb: string;
  /** An in-character line, under 90 characters (§3). */
  sample: string;
  /** Letter for the brass disc; defaults to the name's first letter. */
  initial?: string;
  rating?: number;
}

/** An opponent, with one line of their voice rendered as a chat bubble (§3). */
export function PersonaCard({
  name,
  difficulty,
  blurb,
  sample,
  initial,
  rating,
  className,
  ...props
}: PersonaCardProps) {
  return (
    <div
      className={cn("flex flex-col gap-3 rounded-xl border border-border bg-card p-4", className)}
      {...props}
    >
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden
          className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/20 text-sm font-medium text-primary"
        >
          {initial ?? name[0]?.toUpperCase() ?? "?"}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{name}</p>
          <p className="text-[12px] text-muted-foreground">
            {difficulty}
            {rating != null ? <span className="tabular font-mono"> · {rating}</span> : null}
          </p>
        </div>
      </div>

      <p className="text-[13px] leading-snug text-muted-foreground">{blurb}</p>

      <p className="rounded-xl rounded-tl-sm border border-border bg-bg-sunken px-3 py-2 text-[13px] text-foreground">
        {sample}
      </p>
    </div>
  );
}
