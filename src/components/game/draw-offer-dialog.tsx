"use client";
// src/components/game/draw-offer-dialog.tsx  [P3]
// FR-31. Rendered as a banner rather than a modal so the offered player can still
// look at the position before answering; the answer goes through the controller.
import { HandshakeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatColour } from "@/lib/format";
import type { Colour } from "@/lib/types";

export interface DrawOfferDialogProps {
  /** The colour that offered, or null when no offer stands. */
  offerFrom: Colour | null;
  /** The viewer's seat: "both" in local games, null for spectators. */
  seat: Colour | "both" | null;
  pending: boolean;
  onRespond(accept: boolean): Promise<void>;
}

export function DrawOfferDialog({ offerFrom, seat, pending, onRespond }: DrawOfferDialogProps) {
  if (offerFrom === null || seat === null) return null;

  const mine = seat !== "both" && seat === offerFrom;

  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm"
    >
      <HandshakeIcon className="size-4 text-muted-foreground" aria-hidden />
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
