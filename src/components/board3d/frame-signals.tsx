"use client";
// src/components/board3d/frame-signals.tsx  [U3]
// Three tiny in-Canvas components. They render nothing; they exist because the only
// place that can observe r3f's render loop is inside it.
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";

/** A frame this long or longer is a resume after a pause, not a slow frame. */
const MAX_SAMPLE_DELTA = 0.5;
/** How often the sampler reports, in seconds of *rendered* time. */
const SAMPLE_WINDOW = 0.5;

export interface FirstFrameProps {
  onFirstFrame?(): void;
}

/**
 * Calls back once, after the first frame is actually on screen (§10.4: the landing
 * fades its canvas in on this). `useFrame` runs BEFORE `gl.render()`, so the callback
 * is deferred by one animation frame — by then the pixels exist.
 *
 * Mount it inside the same <Suspense> as the scene: while the GLB or the HDRI is still
 * loading nothing has been drawn, and a "first frame" on an empty scene would fade in
 * a blank canvas.
 */
export function FirstFrame({ onFirstFrame }: FirstFrameProps) {
  const callback = useRef(onFirstFrame);
  useEffect(() => {
    callback.current = onFirstFrame;
  }, [onFirstFrame]);

  const fired = useRef(false);
  const raf = useRef(0);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  useFrame(() => {
    if (fired.current) return;
    fired.current = true;
    raf.current = requestAnimationFrame(() => callback.current?.());
  });

  return null;
}

export interface FrameRateSamplerProps {
  /** Reported roughly twice a rendered second. Silent while the loop is paused. */
  onFrameRate(fps: number): void;
}

/**
 * Instrumentation for /dev/board3d: it measures frames the renderer actually drew, so
 * the counter genuinely stops when `frameloop` drops to "demand" (a plain
 * requestAnimationFrame counter in the page would keep ticking and prove nothing).
 */
export function FrameRateSampler({ onFrameRate }: FrameRateSamplerProps) {
  const callback = useRef(onFrameRate);
  useEffect(() => {
    callback.current = onFrameRate;
  }, [onFrameRate]);

  const frames = useRef(0);
  const elapsed = useRef(0);

  useFrame((_, delta) => {
    // The first delta after a resume covers the whole pause (r3f reads one clock for
    // the loop), so cap it or a five-second pause would report 0 fps for ever.
    frames.current += 1;
    elapsed.current += Math.min(delta, MAX_SAMPLE_DELTA);
    if (elapsed.current < SAMPLE_WINDOW) return;
    callback.current(Math.round(frames.current / elapsed.current));
    frames.current = 0;
    elapsed.current = 0;
  });

  return null;
}

export interface FrameloopGateProps {
  /** True while the wrapper is off screen and `frameloop` is "demand". */
  paused: boolean;
}

/**
 * Wakes the render loop up again when the board comes back on screen.
 *
 * r3f stops its requestAnimationFrame entirely once a "demand" root has no invalidated
 * frames left (`loop()` cancels itself when `repeat === 0`), and switching the
 * `frameloop` prop back to "always" only writes state — nothing restarts the rAF. One
 * `invalidate()` does, and it has to come from inside the Canvas so it runs *after*
 * `configure()` has applied the new frameloop.
 */
export function FrameloopGate({ paused }: FrameloopGateProps) {
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    if (paused) return;
    invalidate();
  }, [invalidate, paused]);

  return null;
}
