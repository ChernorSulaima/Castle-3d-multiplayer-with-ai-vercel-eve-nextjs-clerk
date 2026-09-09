"use client";
// src/components/game/board-view-toggle.tsx  [P3]
// FR-14: the 2D/3D switch. It only swaps the board component *under* the
// controller, so selection and review ply survive the toggle. Disabled with an
// explanation when the WebGL2 probe failed (FR-19).
import { BoxIcon, Grid2x2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { BoardView } from "@/lib/types";

export interface BoardViewToggleProps {
  value: BoardView;
  /** null while the probe has not run yet. */
  webglAvailable: boolean | null;
  onChange(view: BoardView): void;
}

export function BoardViewToggle({ value, webglAvailable, onChange }: BoardViewToggleProps) {
  const blocked = webglAvailable === false;

  return (
    <div
      className="flex items-center gap-1 rounded-lg border border-border p-0.5"
      role="group"
      aria-label="Board view"
    >
      <Button
        size="xs"
        variant={value === "2d" ? "secondary" : "ghost"}
        aria-pressed={value === "2d"}
        onClick={() => onChange("2d")}
      >
        <Grid2x2Icon aria-hidden />
        2D
      </Button>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            render={
              // `aria-disabled` rather than `disabled`: a disabled button swallows
              // hover events, and then the explanation tooltip never appears.
              <Button
                size="xs"
                variant={value === "3d" ? "secondary" : "ghost"}
                aria-pressed={value === "3d"}
                aria-disabled={blocked}
                className={cn(blocked && "opacity-50")}
                onClick={() => {
                  if (!blocked) onChange("3d");
                }}
              />
            }
          >
            <BoxIcon aria-hidden />
            3D
          </TooltipTrigger>
          <TooltipContent>
            {blocked
              ? "3D needs WebGL2, which this browser or GPU does not provide."
              : "Render the board in 3D"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
