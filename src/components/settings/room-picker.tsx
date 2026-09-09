"use client";

import { useRef, useState } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ColourPickers } from "@/components/settings/colour-pickers";
import { useUiStore } from "@/lib/stores/ui-store";
import {
  DEFAULT_ROOM_COLORS,
  ROOMS,
  ROOM_ORDER,
  resolveRoom,
  type RoomPreset,
} from "@/lib/rooms";
import { MAX_ROOM_IMAGE_BYTES } from "@/lib/constants";
import type { PlayerSettings, RoomColors, RoomPresetId } from "@/lib/types";
import { describeConvexError } from "@/components/providers/convex-errors";
import { cn } from "@/lib/utils";

/**
 * FR-21m — switching rooms should be instant. §E.11 suggests drei's
 * `useEnvironment.preload`, but that would pull three.js and the whole R3F loader
 * stack into `/settings`, a page with no canvas on it. Warming the browser's HTTP
 * cache achieves the same thing for free: `next.config.ts` serves `/hdri/*` with
 * `max-age=2592000`, so drei's later fetch inside the scene is a cache hit.
 *
 * Prefetch is intent-based (hover/focus/selection) rather than all five at once:
 * the set totals 6.92 MB and §I-8 is explicit that it must never be downloaded in
 * one go.
 */
const warmed = new Set<string>();

function prefetchHdri(url: string): void {
  if (warmed.has(url) || typeof window === "undefined") return;
  const connection = (
    navigator as Navigator & { connection?: { saveData?: boolean } }
  ).connection;
  if (connection?.saveData === true) return;
  warmed.add(url);
  fetch(url, { cache: "force-cache" })
    .then((response) => response.arrayBuffer())
    .catch(() => {
      warmed.delete(url);
    });
}

/** A square-count-agnostic mini board painted with the room's own materials. */
function RoomSwatch({
  room,
  columns = 4,
  className,
}: {
  room: RoomPreset;
  columns?: number;
  className?: string;
}) {
  const backdrop = room.background === "colour" ? room.backgroundColor : room.board.frameColor;
  return (
    <div
      aria-hidden
      className={cn("overflow-hidden rounded-md p-1.5", className)}
      style={{ backgroundColor: backdrop }}
    >
      <div
        className="grid gap-0"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: columns * columns }, (_, i) => {
          const row = Math.floor(i / columns);
          const col = i % columns;
          const light = (row + col) % 2 === 0;
          return (
            <span
              key={i}
              className="aspect-square"
              style={{
                backgroundColor: light ? room.board.lightSquare : room.board.darkSquare,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

export function RoomPicker({ save }: { save: (patch: Partial<PlayerSettings>) => void }) {
  const { isAuthenticated } = useConvexAuth();
  const me = useQuery(api.players.me, isAuthenticated ? {} : "skip");
  const generateUploadUrl = useMutation(api.players.generateUploadUrl);
  const setRoomImage = useMutation(api.players.setRoomImage);
  const clearRoomImage = useMutation(api.players.clearRoomImage);

  const roomPreset = useUiStore((s) => s.roomPreset);
  const roomColors = useUiStore((s) => s.roomColors);
  const setRoomPreset = useUiStore((s) => s.setRoomPreset);
  const setRoomColors = useUiStore((s) => s.setRoomColors);

  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const colours = roomColors ?? DEFAULT_ROOM_COLORS;

  function choose(preset: RoomPresetId) {
    setRoomPreset(preset);
    if (preset === "custom") {
      // Make sure the server has something to store the first time custom is picked.
      const next = roomColors ?? DEFAULT_ROOM_COLORS;
      setRoomColors(next);
      save({ roomPreset: preset, roomColors: next });
      return;
    }
    prefetchHdri(ROOMS[preset].hdri);
    save({ roomPreset: preset });
  }

  function previewColours(next: RoomColors) {
    setRoomColors(next);
    save({ roomColors: next });
  }

  async function upload(file: File) {
    if (uploading) return;
    if (!file.type.startsWith("image/")) {
      toast.error("That file is not an image.");
      return;
    }
    if (file.size > MAX_ROOM_IMAGE_BYTES) {
      toast.error(
        `That image is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is ${
          MAX_ROOM_IMAGE_BYTES / 1024 / 1024
        } MB.`,
      );
      return;
    }

    setUploading(true);
    try {
      const uploadUrl = await generateUploadUrl({});
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!response.ok) throw new Error(`upload failed with ${response.status}`);
      const { storageId } = (await response.json()) as { storageId: string };
      await setRoomImage({ storageId: storageId as Id<"_storage"> });
      // The mutation forces `roomPreset: "custom"` server-side; mirror it locally.
      setRoomPreset("custom");
      toast.success("Background image saved.");
    } catch (error) {
      toast.error(describeConvexError(error, "Could not save that image."));
    } finally {
      setUploading(false);
      if (fileInput.current !== null) fileInput.current.value = "";
    }
  }

  async function clearImage() {
    try {
      await clearRoomImage({});
      toast.success("Background image removed.");
    } catch (error) {
      toast.error(describeConvexError(error, "Could not remove that image."));
    }
  }

  const preview = resolveRoom(roomPreset, roomColors);

  return (
    <div className="grid gap-5">
      <div className="grid gap-2">
        <span className="text-sm font-medium">Preview</span>
        <RoomSwatch room={preview} columns={8} className="mx-auto w-full max-w-64 p-4" />
      </div>

      <div
        role="group"
        aria-label="Room preset"
        className="grid grid-cols-2 gap-2 sm:grid-cols-3"
      >
        {ROOM_ORDER.map((id) => {
          const room = ROOMS[id];
          const selected = roomPreset === id;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={selected}
              onClick={() => choose(id)}
              onPointerEnter={() => prefetchHdri(room.hdri)}
              onFocus={() => prefetchHdri(room.hdri)}
              className={cn(
                "grid gap-2 rounded-lg border p-2 text-left transition-colors",
                "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                selected ? "border-primary bg-muted/60" : "border-border hover:bg-muted/40",
              )}
            >
              <RoomSwatch room={room} className="w-full" />
              <span className="block text-sm font-medium">{room.label}</span>
              <span className="block text-xs text-muted-foreground">{room.description}</span>
            </button>
          );
        })}

        <button
          type="button"
          aria-pressed={roomPreset === "custom"}
          onClick={() => choose("custom")}
          className={cn(
            "grid gap-2 rounded-lg border p-2 text-left transition-colors",
            "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
            roomPreset === "custom"
              ? "border-primary bg-muted/60"
              : "border-border hover:bg-muted/40",
          )}
        >
          <RoomSwatch room={resolveRoom("custom", colours)} className="w-full" />
          <span className="block text-sm font-medium">Custom</span>
          <span className="block text-xs text-muted-foreground">Your own colours.</span>
        </button>
      </div>

      {roomPreset === "custom" ? (
        <div className="grid gap-5 rounded-lg border border-border p-3">
          <ColourPickers
            value={colours}
            onPreview={previewColours}
            onCommit={previewColours}
          />

          <div className="grid gap-2">
            <Label htmlFor="room-image">Background image (optional)</Label>
            <p className="text-xs text-muted-foreground">
              Used as a blurred backdrop behind the board, not as an environment map. PNG or JPEG,
              up to {MAX_ROOM_IMAGE_BYTES / 1024 / 1024} MB.
            </p>
            <input
              ref={fileInput}
              id="room-image"
              type="file"
              accept="image/*"
              disabled={uploading}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file !== undefined) void upload(file);
              }}
              className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-muted disabled:opacity-50"
            />
            {me?.roomImageUrl ? (
              <div className="flex items-center gap-3">
                {/* Convex storage URLs are not a configured next/image remote pattern,
                    and this is a user-supplied blob, so a plain img is correct here. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={me.roomImageUrl}
                  alt="Your custom board background"
                  className="h-16 w-24 rounded-md border border-border object-cover"
                />
                <Button variant="outline" size="sm" onClick={clearImage} disabled={uploading}>
                  Remove image
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
