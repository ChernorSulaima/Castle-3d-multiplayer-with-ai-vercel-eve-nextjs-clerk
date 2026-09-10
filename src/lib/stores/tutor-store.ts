// src/lib/stores/tutor-store.ts
// What the tutor is currently drawing on the board, and whether its panel is open.
// The panel writes; `useGameController` (and the mock controller) read `annotations`
// into `BoardViewProps`, so both boards stay pure functions of their props.
import { create } from "zustand";
import type { BoardAnnotations } from "../tutor/annotations";

export interface TutorState {
  /** The drawing on the board right now, or null for a clean board. */
  annotations: BoardAnnotations | null;
  /** Which message / chip put it there, so the panel can show the active toggle. */
  sourceId: string | null;
  /** Desktop column open (≥1280) or the overlay/sheet open below that. */
  panelOpen: boolean;
  setAnnotations(annotations: BoardAnnotations | null, sourceId?: string | null): void;
  clearAnnotations(): void;
  setPanelOpen(open: boolean): void;
}

export const useTutorStore = create<TutorState>()((set) => ({
  annotations: null,
  sourceId: null,
  panelOpen: true,
  setAnnotations: (annotations, sourceId = null) => set({ annotations, sourceId }),
  clearAnnotations: () => set({ annotations: null, sourceId: null }),
  setPanelOpen: (panelOpen) => set({ panelOpen }),
}));
