"use client";
// src/components/game/spectator-banner.tsx  [P3]
// FR-8 / §E.7: a spectator sees a read-only board, no controls and this banner.
import { EyeIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { pluralize } from "@/lib/format";

export interface SpectatorBannerProps {
  spectatorCount: number;
}

export function SpectatorBanner({ spectatorCount }: SpectatorBannerProps) {
  return (
    <div
      role="status"
      className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm"
    >
      <EyeIcon className="size-4 text-muted-foreground" aria-hidden />
      <span className="font-medium">Spectating</span>
      <span className="text-muted-foreground">
        This board is read-only. History, review and PGN export still work.
      </span>
      <Badge variant="outline" className="ml-auto">
        {pluralize(Math.max(0, spectatorCount), "watcher")}
      </Badge>
    </div>
  );
}
