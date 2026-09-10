// src/components/play/seat-panel.tsx  [U5]
// The chrome the three seats of UI_UPGRADE_2 §3.2 share: an icon, a title, one
// line of host copy, the controls, and an action row at the foot.
//
// Deliberately NOT a card. §3.2: "Three stacked panels separated by seam
// hairlines on the espresso ground (walnut only for the inner controls, never a
// card inside a card)" — the persona bubble and the Player 2 well are already
// surfaces, so a card around them would nest two.
import { useId } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/ui";

export interface SeatPanelProps extends React.ComponentProps<"section"> {
  /** Seat id for the `?mode=` deep link; rendered as `data-seat`. */
  seat?: string;
  title: string;
  /** id of the `h2` the section is labelled by. Generated when omitted, so a
   *  harness that renders two of the same seat cannot duplicate an id. */
  headingId?: string;
  icon: LucideIcon;
  /** One line beneath the title. */
  line?: React.ReactNode;
  /** True for one second after a `?mode=` deep link points at this seat. */
  flash?: boolean;
  /** Buttons, laid out in a row at the foot of the panel. */
  action?: React.ReactNode;
}

export function SeatPanel({
  seat,
  title,
  headingId: headingIdProp,
  icon: Icon,
  line,
  flash = false,
  action,
  className,
  children,
  ...props
}: SeatPanelProps) {
  const generated = useId();
  const headingId = headingIdProp ?? generated;
  return (
    <section
      aria-labelledby={headingId}
      data-seat={seat}
      data-flash={flash ? "true" : undefined}
      // `scroll-mt` clears the 56px sticky header when a deep link scrolls a
      // seat into view, so the title is never parked underneath it.
      className={cn("lobby-seat scroll-mt-24 py-7 first:pt-0 last:pb-0", className)}
      {...props}
    >
      <div className="flex items-start gap-3">
        <Icon
          aria-hidden
          strokeWidth={1.5}
          className="mt-[3px] size-[18px] shrink-0 text-muted-foreground"
        />
        <div className="min-w-0 flex-1">
          <h2 id={headingId} className="lobby-title text-foreground">
            {title}
          </h2>
          {line ? (
            <p className="lobby-body mt-1.5 max-w-[54ch] text-muted-foreground">{line}</p>
          ) : null}
        </div>
      </div>

      {/* The controls hang off the same optical margin as the copy from `sm` up. */}
      {children ? <div className="mt-5 sm:pl-[30px]">{children}</div> : null}
      {action ? (
        <div className="mt-5 flex flex-wrap items-center gap-2 sm:pl-[30px]">{action}</div>
      ) : null}
    </section>
  );
}

/**
 * The reason a control is unavailable, shown beside the disabled action rather
 * than only in a tooltip — a `disabled` button is not focusable, so a tooltip
 * alone reaches nobody on a keyboard (§3.2 "a tooltip that says why").
 */
export function SeatReason({ children }: { children: React.ReactNode }) {
  return <p className="lobby-micro text-muted-foreground">{children}</p>;
}
