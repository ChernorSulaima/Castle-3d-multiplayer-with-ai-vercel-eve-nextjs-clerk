"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useUiStore } from "@/lib/stores/ui-store";
import { QUALITY_TIERS } from "@/lib/camera";
import type { BoardView, PlayerSettings, QualityTier } from "@/lib/types";

const BOARD_VIEWS: ReadonlyArray<{ value: BoardView; label: string; hint: string }> = [
  { value: "3d", label: "3D", hint: "Full scene with lighting and reflections" },
  { value: "2d", label: "2D", hint: "Flat board — lighter, and always available" },
];

const TIERS: ReadonlyArray<{ value: QualityTier; label: string; hint: string }> = [
  { value: "auto", label: "Auto", hint: "Chosen from your GPU, then lowered if frames drop" },
  { value: "low", label: "Low", hint: "No post-processing, no reflections" },
  { value: "medium", label: "Medium", hint: "Reflections and shadows, no post-processing" },
  { value: "high", label: "High", hint: "Everything, including ambient occlusion and bloom" },
];

function ToggleRow<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: ReadonlyArray<{ value: T; label: string; hint: string }>;
  value: T;
  onChange: (next: T) => void;
}) {
  const active = options.find((option) => option.value === value);
  return (
    <div className="grid gap-2">
      <span className="text-sm font-medium">{label}</span>
      <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <Button
            key={option.value}
            size="sm"
            variant={option.value === value ? "default" : "outline"}
            aria-pressed={option.value === value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>
      {active ? <p className="text-xs text-muted-foreground">{active.hint}</p> : null}
    </div>
  );
}

/** FR-15, FR-29, FR-31. Every change is applied to the store first (so a game
 *  already on screen reacts immediately) and only then debounced to Convex. */
export function QualityPicker({ save }: { save: (patch: Partial<PlayerSettings>) => void }) {
  const boardView = useUiStore((s) => s.boardView);
  const qualityTier = useUiStore((s) => s.qualityTier);
  const postFxEnabled = useUiStore((s) => s.postFxEnabled);
  const resolvedTier = useUiStore((s) => s.resolvedTier);
  const webglAvailable = useUiStore((s) => s.webglAvailable);
  const setBoardView = useUiStore((s) => s.setBoardView);
  const setQualityTier = useUiStore((s) => s.setQualityTier);
  const setPostFxEnabled = useUiStore((s) => s.setPostFxEnabled);

  // `post.composer: false` means the tier unmounts <EffectComposer> entirely, so
  // the switch has nothing to turn on there.
  const postFxSupported = QUALITY_TIERS[resolvedTier].post.composer;

  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <ToggleRow
          label="Default board view"
          options={BOARD_VIEWS}
          value={boardView}
          onChange={(next) => {
            setBoardView(next);
            save({ boardView: next });
          }}
        />
        {webglAvailable === false ? (
          <p className="text-xs text-destructive">
            This browser has no usable WebGL2, so games open in 2D whatever is chosen here.
          </p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <ToggleRow
          label="Graphics quality"
          options={TIERS}
          value={qualityTier}
          onChange={(next) => {
            setQualityTier(next);
            save({ qualityTier: next });
          }}
        />
        {qualityTier === "auto" ? (
          <p className="text-xs text-muted-foreground">
            Currently running at <span className="font-medium">{resolvedTier}</span>.
          </p>
        ) : null}
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Label htmlFor="post-fx">Post-processing</Label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Ambient occlusion, bloom and outlines.{" "}
            {postFxSupported
              ? "Costs frames on weaker hardware."
              : "Not used at the current quality tier."}
          </p>
        </div>
        <Switch
          id="post-fx"
          checked={postFxEnabled}
          onCheckedChange={(checked) => {
            setPostFxEnabled(checked);
            save({ postFxEnabled: checked });
          }}
        />
      </div>
    </div>
  );
}
