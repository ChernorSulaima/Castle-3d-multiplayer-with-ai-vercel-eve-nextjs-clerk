// src/components/ui-kit/mode-card.tsx  [U0]
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/ui";

export interface ModeCardProps extends React.ComponentProps<"div"> {
  title: string;
  /** The real behaviour, in one sentence (§3). */
  description: string;
  icon?: LucideIcon;
  /** Extra facts, one short line each. */
  details?: string[];
  /** The single primary control — a Button or a Link rendered as one. */
  action?: React.ReactNode;
}

/** "Find a match" / "Play the AI" / "Pass and play" (§3, §6). */
export function ModeCard({
  title,
  description,
  icon: Icon,
  details,
  action,
  className,
  children,
  ...props
}: ModeCardProps) {
  return (
    <div
      className={cn(
        "flex h-full flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-soft",
        className,
      )}
      {...props}
    >
      {Icon ? <Icon aria-hidden className="size-5 text-primary" /> : null}
      <h3 className="text-base font-medium text-foreground">{title}</h3>
      <p className="text-[13px] leading-relaxed text-muted-foreground">{description}</p>
      {details?.length ? (
        <ul className="flex flex-col gap-1 text-[13px] text-muted-foreground">
          {details.map((detail) => (
            <li key={detail} className="flex gap-2">
              <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-primary" />
              <span>{detail}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {children}
      {action ? <div className="mt-auto pt-1">{action}</div> : null}
    </div>
  );
}
