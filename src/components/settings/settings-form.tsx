"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Attributions } from "@/components/settings/attributions";
import { QualityPicker } from "@/components/settings/quality-picker";
import { RoomPicker } from "@/components/settings/room-picker";
import { useSettingsWriter } from "@/hooks/use-settings-sync";
import { useUiStore } from "@/lib/stores/ui-store";
import type { PlayerSettings } from "@/lib/types";

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function SettingsSkeleton() {
  return (
    <div className="grid gap-4" aria-busy>
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-72 w-full" />
      <Skeleton className="h-56 w-full" />
    </div>
  );
}

export interface SettingsFormProps {
  /** The ONE debounced `players.updateSettings` writer for this tree. The form does
   *  not own it: the game shell persists the 2D/3D toggle through the same writer
   *  (FR-15), and two writers would fire two mutations per change. */
  save(patch: Partial<PlayerSettings>): void;
}

/**
 * Every control writes to the ui-store synchronously (so a 3D scene already on
 * screen updates on the same frame) and then queues a debounced
 * `players.updateSettings`. There is no Save button by design (FR-21l).
 *
 * The whole form gates on `hydrated`: until `<PlayerSync/>` has rehydrated
 * localStorage and merged `players.me`, the store still holds SSR defaults, and
 * rendering those as "selected" would flash the wrong choices.
 */
export function SettingsForm({ save }: SettingsFormProps) {
  const hydrated = useUiStore((s) => s.hydrated);
  const boardFlipEnabled = useUiStore((s) => s.boardFlipEnabled);
  const setBoardFlipEnabled = useUiStore((s) => s.setBoardFlipEnabled);

  if (!hydrated) return <SettingsSkeleton />;

  return (
    <div className="grid gap-4">
      <Section
        title="Board"
        description="How the board behaves. Applies to every game you play or watch."
      >
        <div className="grid gap-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <Label htmlFor="board-flip">Flip the board between turns</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Local two-player games only. The camera swings to the side of whoever is to move so
                the device can be handed over. Turn it off for a fixed view.
              </p>
            </div>
            <Switch
              id="board-flip"
              checked={boardFlipEnabled}
              onCheckedChange={(checked) => {
                setBoardFlipEnabled(checked);
                save({ boardFlipEnabled: checked });
              }}
            />
          </div>
        </div>
      </Section>

      <Section
        title="Room"
        description="Your board, your surroundings. Rooms are per-player — your opponent keeps theirs, and so do spectators."
      >
        <RoomPicker save={save} />
      </Section>

      <Section
        title="Graphics"
        description="Turn things down if frames drop, or up if your machine can take it."
      >
        <QualityPicker save={save} />
      </Section>

      <Section title="Credits" description="The people whose work this game is built on.">
        <Attributions />
      </Section>
    </div>
  );
}

/** The /settings page has no other settings writer to share, so it owns one here. */
export function StandaloneSettingsForm() {
  const save = useSettingsWriter();
  return <SettingsForm save={save} />;
}
