"use client";
// src/components/game/draw-offer-dialog.tsx  [P3 → restyled U2]
// FR-31 / UI_REDESIGN §5.4: "a system chip in chat plus an inline bar above the
// action bar with Accept / Decline". A banner rather than a modal, so the offered
// player can still look at the position before answering.
import { HandshakeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatColour } from "@/lib/format";
import { cn } from "@/lib/ui";
import type { Colour } from "@/lib/types";

export interface DrawOfferDialogProps {
  /** The colour that offered, or null when no offer stands. */
  offerFrom: Colour | null;
  /** The viewer's seat: "both" in local games, null for spectators. */
  seat: Colour | "both" | null;
  pending: boolean;
  onRespond(accept: boolean): Promise<void>;
  className?: string;
}

export function DrawOfferDialog({
  offerFrom,
  seat,
  pending,
  onRespond,
  className,
}: DrawOfferDialogProps) {
  if (offerFrom === null || seat === null) return null;

  const mine = seat !== "both" && seat === offerFrom;

  return (
    <div
      role="status"
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-xl border border-primary/40 bg-primary/10",
        "px-3 py-2 text-[13px] text-foreground",
        className,
      )}
    >
      <HandshakeIcon className="size-4 shrink-0 text-primary" aria-hidden />
      <span>
        {mine
          ? "Draw offered — waiting for a reply."
          : `${formatColour(offerFrom)} offers a draw.`}
      </span>
      {mine ? null : (
        <div className="ml-auto flex gap-2">
          <Button
            size="sm"
            disabled={pending}
            onClick={() => {
              void onRespond(true);
            }}
          >
            Accept
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => {
              void onRespond(false);
            }}
          >
            Decline
          </Button>
        </div>
      )}
    </div>
  );
}
