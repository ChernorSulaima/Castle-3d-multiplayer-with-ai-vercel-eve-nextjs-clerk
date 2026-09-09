// src/components/board3d/quality.tsx
// The frame-time watchdog and the adaptive-dpr wiring, mounted inside <Canvas>.
"use client";
import { Suspense, useEffect } from "react";
import { AdaptiveDpr, PerformanceMonitor, useDetectGPU } from "@react-three/drei";
import type { QualityWatchdog } from "@/hooks/use-quality-watchdog";
import { useUiStore } from "@/lib/stores/ui-store";

/** FR-31: 10 iterations x 500 ms = a 5 s window under 30 fps before a tier is dropped. */
const BOUNDS = (): [number, number] => [30, 55];

export function QualityWatchdog({ watchdog }: { watchdog: QualityWatchdog }) {
  return (
    <>
      <PerformanceMonitor
        key={watchdog.key}
        ms={500}
        iterations={10}
        threshold={0.75}
        flipflops={3}
        bounds={BOUNDS}
        onDecline={watchdog.onDecline}
        onFallback={watchdog.onFallback}
      />
      <AdaptiveDpr />
    </>
  );
}

/**
 * FR-31 auto-selection (§E.10 step 3). `useDetectGPU` suspends, so it lives behind its
 * own <Suspense> and is mounted OUTSIDE the Canvas — it needs no fiber context, and a
 * slow GPU-benchmark lookup must never hold up the first frame.
 *
 * `autoDetectTier` is a no-op unless the player left the quality setting on "auto".
 */
function AutoTierProbeInner() {
  const gpu = useDetectGPU();

  useEffect(() => {
    useUiStore.getState().autoDetectTier({
      hardwareConcurrency: navigator.hardwareConcurrency || 4,
      devicePixelRatio: window.devicePixelRatio || 1,
      gpuTier: gpu.tier,
      isMobile: gpu.isMobile ?? false,
    });
  }, [gpu]);

  return null;
}

export function AutoTierProbe() {
  return (
    <Suspense fallback={null}>
      <AutoTierProbeInner />
    </Suspense>
  );
}
