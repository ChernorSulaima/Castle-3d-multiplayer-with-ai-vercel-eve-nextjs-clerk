"use client";
// src/components/ui-kit/action-bar.tsx  [U0]
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/ui";
import { Kbd } from "./kbd";

export interface ActionBarProps extends React.ComponentProps<"div"> {
  /** Accessible name for the toolbar, e.g. "Game actions". */
  label: string;
}

/** The always-visible row of labelled game actions (§5.1). */
export function ActionBar({ label, className, ...props }: ActionBarProps) {
  return (
    <div
      role="toolbar"
      aria-label={label}
      className={cn(
        "no-scrollbar flex w-full items-center gap-1 overflow-x-auto rounded-xl border border-border",
        "bg-card p-1.5 shadow-soft",
        className,
      )}
      {...props}
    />
  );
}

/** A related run of actions inside an ActionBar (View / Game / More). */
export function ActionGroup({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex items-center gap-1", className)} {...props} />;
}

/** Hairline between two ActionGroups. */
export function ActionSeparator({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span aria-hidden className={cn("mx-1 h-5 w-px shrink-0 bg-border", className)} {...props} />
  );
}

const BUTTON_VARIANT = {
  default: "ghost",
  primary: "default",
  danger: "destructive",
} as const;

/** From which breakpoint the text label is *visible*; it stays in the a11y tree always. */
const LABEL_CLASS = {
  always: "",
  lg: "sr-only lg:not-sr-only",
  xl: "sr-only xl:not-sr-only",
} as const;

export interface ActionButtonProps
  extends Omit<React.ComponentProps<typeof Button>, "variant" | "children"> {
  icon: LucideIcon;
  label: string;
  /** Key that triggers the same action, shown in the tooltip. */
  shortcut?: string;
  /** Longer description for the tooltip; defaults to the label. */
  tooltip?: string;
  /**
   * Set to explain why the action cannot be used. The button becomes
   * `aria-disabled` (not `disabled`, which would swallow hover and hide the
   * explanation) and the tooltip states the reason.
   */
  disabledReason?: string;
  variant?: keyof typeof BUTTON_VARIANT;
  labelFrom?: keyof typeof LABEL_CLASS;
  /** Trailing counter, e.g. "2 left". */
  badge?: React.ReactNode;
}

/** One action: icon + label + shortcut tooltip, never a bare icon (§5.1). */
export function ActionButton({
  icon: Icon,
  label,
  shortcut,
  tooltip,
  disabledReason,
  variant = "default",
  labelFrom = "lg",
  badge,
  className,
  onClick,
  ...props
}: ActionButtonProps) {
  const blocked = Boolean(disabledReason);
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            size="sm"
            variant={BUTTON_VARIANT[variant]}
            aria-disabled={blocked || undefined}
            className={cn("shrink-0", blocked && "opacity-50", className)}
            onClick={(event) => {
              if (blocked) {
                event.preventDefault();
                return;
              }
              onClick?.(event);
            }}
            {...props}
          />
        }
      >
        <Icon aria-hidden />
        <span className={LABEL_CLASS[labelFrom]}>{label}</span>
        {/* The leading space is load-bearing: an accessible name is the concatenated
            text of the inline children with no separator inserted, so without it the
            Hint button announced as "Hint2 left". */}
        {badge ? (
          <span className="tabular text-[11px] opacity-70">
            {" "}
            {badge}
          </span>
        ) : null}
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {disabledReason ?? tooltip ?? label}
        {shortcut && !blocked ? <Kbd>{shortcut}</Kbd> : null}
      </TooltipContent>
    </Tooltip>
  );
}
