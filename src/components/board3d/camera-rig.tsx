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
import { useFrame, useThree } from "@react-three/fiber";
import { Box3, Vector3 } from "three";
import { CAMERA_FLIP_SMOOTH_TIME, CAMERA_SESSION_KEY } from "@/lib/constants";
import {
  CAMERA_LIMITS,
  fitPoseToAspect,
  minFitDistance,
  nearCornerAdvance,
  poseForPreset,
} from "@/lib/camera";
import type { CameraPresetId } from "@/lib/types";
import { BOARD_SIZE, PLINTH_SIZE } from "./layout";

const { ACTION } = CameraControlsImpl;

/** Largest frame delta the idle orbit will act on, in seconds (see useFrame below). */
const MAX_ORBIT_DELTA = 1 / 6;

/** A little air around whatever a fit is asked to keep in frame. */
const FRAMING_MARGIN = 1.04;

/**
 * What a SEATED camera has to keep inside the frame, as a half-extent in world units
 * (see `fitPoseToAspect`), on BOTH axes: the 8x8 playing area and the pieces standing on
 * it. Its near corners are a half-board away in x and in z at the same time, and until
 * this counted the z half as well the corner squares — a1 and h1, pieces and all — were
 * sliced in half by the edge of a square canvas, which is exactly the box the §5.1 game
 * shell hands the board.
 *
 * Deliberately the PLAYING AREA and not the plinth: the plinth's outer rim is furniture,
 * it may bleed off the edge, and insisting on its far bottom corner costs a fifth of the
 * board's size for wood nobody is looking at.
 */
const SEAT_HALF = (BOARD_SIZE / 2) * FRAMING_MARGIN;

/**
 * The cinematic orbit sweeps the azimuth through 45 deg, where the board presents its
 * DIAGONAL to the camera — root 2 wider than a seat sees, measured on the plinth because
 * an idle showcase board should sit in its room whole. That root 2 already IS the near
 * corner's bound, reached from the other side, so this branch passes no depth term: doing
 * both would charge for the same corner twice and shrink the landing hero for nothing.
 */
const ORBIT_HALF_WIDTH = (PLINTH_SIZE / 2) * FRAMING_MARGIN * Math.SQRT2;

const TARGET_BOUNDS = new Box3(
  new Vector3(...CAMERA_LIMITS.boundaryMin),
  new Vector3(...CAMERA_LIMITS.boundaryMax),
);

/**
 * `fromJSON` (FR-25 session restore) assigns EVERY serialised field, including
 * `enabled`, `smoothTime`, the distance range and the polar clamp — so a snapshot taken
 * mid-transition would restore `enabled: false` and permanently kill orbit/pan/zoom, and
 * R3F's prop diffing would not put the JSX values back (they never changed). Re-assert
 * everything the rig owns after every restore.
 */
function applyRigLimits(controls: CameraControlsImpl): void {
  controls.enabled = true;
  controls.smoothTime = CAMERA_LIMITS.smoothTime;
  controls.draggingSmoothTime = CAMERA_LIMITS.draggingSmoothTime;
  controls.minDistance = CAMERA_LIMITS.minDistance;
  controls.maxDistance = CAMERA_LIMITS.maxDistance;
  controls.minPolarAngle = CAMERA_LIMITS.minPolarAngle;
  controls.maxPolarAngle = CAMERA_LIMITS.maxPolarAngle;
  controls.setBoundary(TARGET_BOUNDS);
}

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
  /**
   * FR-25 session restore. Showcase boards pass `false` (§10.4): a landing hero must
   * neither inherit the player's saved seat nor overwrite it with its own orbit.
   */
  persistSession?: boolean;
  /**
   * True while the showcase board's frameloop is "demand" because it is off screen.
   * The orbit MUST stop: camera-controls fires `update` on every rotate and drei's
   * <CameraControls> answers each one with `invalidate()`, so an orbit that keeps
   * running keeps requesting frames and the pause never actually happens.
   */
  paused?: boolean;
}

export function CameraRig({
  preset,
  cinematic,
  reducedMotion,
  controlsRef,
  onUserInteract,
  persistSession = true,
  paused = false,
}: CameraRigProps) {
  const interacting = useRef(false);
  const skipNextPreset = useRef(false);
  // True while a preset transition owns the controls. camera-controls resolves the
  // `setLookAt` promise from a `rest` listener registered AFTER ours, so without this
  // gate the snapshot written at the end of every flip would carry `enabled: false`.
  const locked = useRef(false);
  // Frozen at mount so the setup effect below stays a genuine one-shot.
  const [initialPreset] = useState(preset);

  // Aspect-aware framing. The canvas is square in the §5.1 game shell, 16:9 in the
  // /dev/board3d harness and something in between in the landing hero, and a fixed
  // camera distance cannot serve all three: see `fitPoseToAspect`. This only ever
  // pushes the camera BACK, so the wide framing the presets were tuned for is
  // untouched and only a narrow canvas moves.
  const { width, height } = useThree((state) => state.size);
  const aspect = height > 0 ? width / height : 1;
  const cinematicPreset = preset === "cinematic";
  const halfWidth = cinematicPreset ? ORBIT_HALF_WIDTH : SEAT_HALF;
  const halfDepth = cinematicPreset ? 0 : SEAT_HALF;
  const fitDistance = minFitDistance(
    halfWidth,
    aspect,
    CAMERA_LIMITS.fov,
    nearCornerAdvance(poseForPreset(preset), halfDepth),
  );

  // Read by the effects below, which must not re-run on every resize (a preset effect
  // that did would replay its animated transition, and cancel the player's own orbit,
  // every time the sidebar or the mobile sheet changed the canvas size). Declared
  // FIRST so the refs are current before any of them runs, on mount and after.
  const aspectRef = useRef(aspect);
  const halfWidthRef = useRef(halfWidth);
  const halfDepthRef = useRef(halfDepth);
  useEffect(() => {
    aspectRef.current = aspect;
    halfWidthRef.current = halfWidth;
    halfDepthRef.current = halfDepth;
  }, [aspect, halfWidth, halfDepth]);

  // True once the player has taken the camera over (orbit, dolly, truck). The
  // resize re-fit below leaves them alone from then on: someone who deliberately
  // zoomed in to a few squares (FR-22) must not be yanked back out by a resize.
  const userMoved = useRef(false);

  // One-time setup: pan boundary, the "reset" seat, and the FR-25 session restore.
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    applyRigLimits(controls);
    const pose = fitPoseToAspect(
      poseForPreset(initialPreset),
      SEAT_HALF,
      aspectRef.current,
      SEAT_HALF,
    );
    void controls.setLookAt(...pose.position, ...pose.target, false);
    // FR-23: "Reset" returns to the player's seat, so the saved state is the preset
    // pose — never the restored session pose.
    controls.saveState();

    const saved = persistSession ? readSession() : null;
    if (saved) {
      try {
        void controls.fromJSON(saved, false);
        skipNextPreset.current = true;
      } catch {
        skipNextPreset.current = false;
      } finally {
        applyRigLimits(controls);
      }
    }

    const persist = () => {
      if (locked.current) return;
      writeSession(controls.toJSON());
    };
    if (persistSession) controls.addEventListener("rest", persist);
    return () => {
      controls.removeEventListener("rest", persist);
      locked.current = false;
      controls.enabled = true;
    };
  }, [controlsRef, initialPreset, persistSession]);

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
    // Framed for the canvas as it is right now; read through the refs so a resize
    // does not replay this transition.
    const pose = fitPoseToAspect(
      poseForPreset(preset),
      halfWidthRef.current,
      aspectRef.current,
      halfDepthRef.current,
    );
    // A preset is a request for the canonical view, so it also hands the camera back.
    userMoved.current = false;

    const release = () => {
      controls.smoothTime = previousSmoothTime;
      controls.enabled = true;
      locked.current = false;
    };

    locked.current = true;
    controls.enabled = false;
    controls.smoothTime = CAMERA_FLIP_SMOOTH_TIME;
    void controls
      .normalizeRotations()
      .setLookAt(...pose.position, ...pose.target, !reducedMotion)
      .then(() => {
        if (cancelled) return;
        release();
        // FR-23: Reset follows the ACTIVE preset, not whichever one happened to be
        // selected when the 3D chunk mounted.
        controls.saveState();
        // The `rest` that ended this transition was swallowed by `locked`, so persist
        // the settled pose here or FR-25 would restore the pre-flip seat.
        if (persistSession) writeSession(controls.toJSON());
      })
      .catch(() => {
        if (cancelled) return;
        release();
      });

    return () => {
      cancelled = true;
      release();
    };
  }, [controlsRef, persistSession, preset, reducedMotion]);

  // The canvas changed shape (window resize, the sidebar appearing at 1024, the
  // mobile sheet opening, entering the focus layout) and the pose no longer fits.
  // Distance only: azimuth, polar and target are left exactly where they are, so this
  // re-frames without ever re-seating the camera. Skipped once the player has taken
  // the camera over, and while a preset transition owns it.
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    if (userMoved.current || locked.current) return;
    if (controls.distance >= fitDistance - 0.001) return;
    void controls.dollyTo(fitDistance, false);
  }, [controlsRef, fitDistance]);

  // Cinematic idle orbit. `cinematic` arrives as a prop (never a store hook in the
  // render loop — §D.12 rule 7) and interaction is tracked on a ref.
  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!controls || !cinematic || reducedMotion || paused) return;
    if (interacting.current || !controls.enabled) return;
    // A showcase board pauses its frameloop off screen, and r3f's clock keeps running
    // while it is paused: the first delta after a resume covers the whole pause and
    // would swing the camera through a quarter-turn in one frame. Cap it at one slow
    // frame's worth (~6 fps) — the orbit picks up where the eye left it.
    controls.rotate(CAMERA_LIMITS.cinematicSpeed * Math.min(delta, MAX_ORBIT_DELTA), 0, false);
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
        userMoved.current = true;
        onUserInteract?.();
      }}
      onControlEnd={() => {
        interacting.current = false;
      }}
      // The wheel emits no controlstart/controlend but does emit 'control', so the
      // auto-orbit is cancelled by zooming as well as by dragging.
      onControl={() => {
        userMoved.current = true;
        onUserInteract?.();
      }}
    />
  );
}
