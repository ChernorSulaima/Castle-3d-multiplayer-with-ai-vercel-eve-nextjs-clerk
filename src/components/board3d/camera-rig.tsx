// src/components/board3d/camera-rig.tsx
// FR-20..FR-25 + FR-21c. drei <CameraControls> (camera-controls 3.1.2) because it is the
// only option with a target boundary box, promise-based animated transitions,
// saveState()/reset(true) and toJSON()/fromJSON() session persistence (§I-9).
//
// camera-controls v3 gotcha: setLookAt/reset no longer normalise the azimuth, so
// `normalizeRotations()` must precede every one of them or the seat flip takes the long
// way round after the player has orbited (§E.6 step 4).
"use client";
import { useEffect, useRef, useState } from "react";
import { CameraControls, CameraControlsImpl } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Box3, Vector3 } from "three";
import { CAMERA_FLIP_SMOOTH_TIME, CAMERA_SESSION_KEY } from "@/lib/constants";
import { CAMERA_LIMITS, poseForPreset } from "@/lib/camera";
import type { CameraPresetId } from "@/lib/types";

const { ACTION } = CameraControlsImpl;

const TARGET_BOUNDS = new Box3(
  new Vector3(...CAMERA_LIMITS.boundaryMin),
  new Vector3(...CAMERA_LIMITS.boundaryMax),
);

function readSession(): string | null {
  try {
    return window.sessionStorage.getItem(CAMERA_SESSION_KEY);
  } catch {
    // Private mode / blocked storage: persistence is a nicety, never a hard failure.
    return null;
  }
}

function writeSession(json: string): void {
  try {
    window.sessionStorage.setItem(CAMERA_SESSION_KEY, json);
  } catch {
    /* ignore */
  }
}

export interface CameraRigProps {
  preset: CameraPresetId;
  /** Idle auto-orbit; stops the moment the player touches the camera (FR-24). */
  cinematic: boolean;
  /** prefers-reduced-motion: preset changes snap instead of flying (FR-21g). */
  reducedMotion: boolean;
  /** Shared handle so the DOM overlay's Reset button can drive the controls. */
  controlsRef: React.RefObject<CameraControlsImpl | null>;
  onUserInteract?(): void;
}

export function CameraRig({
  preset,
  cinematic,
  reducedMotion,
  controlsRef,
  onUserInteract,
}: CameraRigProps) {
  const interacting = useRef(false);
  const skipNextPreset = useRef(false);
  // Frozen at mount so the setup effect below stays a genuine one-shot.
  const [initialPreset] = useState(preset);

  // One-time setup: pan boundary, the "reset" seat, and the FR-25 session restore.
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    controls.setBoundary(TARGET_BOUNDS);
    const pose = poseForPreset(initialPreset);
    void controls.setLookAt(...pose.position, ...pose.target, false);
    controls.saveState();

    const saved = readSession();
    if (saved) {
      try {
        void controls.fromJSON(saved, false);
        skipNextPreset.current = true;
      } catch {
        skipNextPreset.current = false;
      }
    }

    const persist = () => writeSession(controls.toJSON());
    controls.addEventListener("rest", persist);
    return () => {
      controls.removeEventListener("rest", persist);
      controls.enabled = true;
    };
  }, [controlsRef, initialPreset]);

  // Animated preset / seat-flip transition (FR-23, FR-24, FR-21c).
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    if (skipNextPreset.current) {
      skipNextPreset.current = false;
      return;
    }

    let cancelled = false;
    const previousSmoothTime = controls.smoothTime;
    const pose = poseForPreset(preset);

    controls.enabled = false;
    controls.smoothTime = CAMERA_FLIP_SMOOTH_TIME;
    void controls
      .normalizeRotations()
      .setLookAt(...pose.position, ...pose.target, !reducedMotion)
      .then(() => {
        if (cancelled) return;
        controls.smoothTime = previousSmoothTime;
        controls.enabled = true;
      })
      .catch(() => {
        if (cancelled) return;
        controls.smoothTime = previousSmoothTime;
        controls.enabled = true;
      });

    return () => {
      cancelled = true;
      controls.smoothTime = previousSmoothTime;
      controls.enabled = true;
    };
  }, [controlsRef, preset, reducedMotion]);

  // Cinematic idle orbit. `cinematic` arrives as a prop (never a store hook in the
  // render loop — §D.12 rule 7) and interaction is tracked on a ref.
  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!controls || !cinematic || reducedMotion) return;
    if (interacting.current || !controls.enabled) return;
    controls.rotate(CAMERA_LIMITS.cinematicSpeed * delta, 0, false);
  });

  return (
    <CameraControls
      ref={controlsRef}
      makeDefault
      minPolarAngle={CAMERA_LIMITS.minPolarAngle}
      maxPolarAngle={CAMERA_LIMITS.maxPolarAngle}
      minDistance={CAMERA_LIMITS.minDistance}
      maxDistance={CAMERA_LIMITS.maxDistance}
      smoothTime={CAMERA_LIMITS.smoothTime}
      draggingSmoothTime={CAMERA_LIMITS.draggingSmoothTime}
      dollySpeed={CAMERA_LIMITS.dollySpeed}
      truckSpeed={CAMERA_LIMITS.truckSpeed}
      dollyToCursor={false}
      boundaryFriction={CAMERA_LIMITS.boundaryFriction}
      mouseButtons={{
        left: ACTION.ROTATE,
        middle: ACTION.DOLLY,
        right: ACTION.TRUCK,
        wheel: ACTION.DOLLY,
      }}
      touches={{
        one: ACTION.TOUCH_ROTATE,
        two: ACTION.TOUCH_DOLLY_TRUCK,
        three: ACTION.TOUCH_TRUCK,
      }}
      onControlStart={() => {
        interacting.current = true;
        onUserInteract?.();
      }}
      onControlEnd={() => {
        interacting.current = false;
      }}
      // The wheel emits no controlstart/controlend but does emit 'control', so the
      // auto-orbit is cancelled by zooming as well as by dragging.
      onControl={() => onUserInteract?.()}
    />
  );
}
