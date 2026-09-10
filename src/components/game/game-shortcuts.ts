// src/components/game/game-shortcuts.ts  [U2]
// The keyboard map of UI_REDESIGN §5.1, in the shape `ShortcutsDialog` wants.
// One list, so the dialog and `use-shortcuts.ts` can never drift apart.
import type { Shortcut } from "@/components/ui-kit";

export const GAME_SHORTCUTS: Shortcut[] = [
  { group: "Board", keys: ["T"], label: "Switch between the 2D and 3D board" },
  { group: "Board", keys: ["R"], label: "Turn the board around" },
  { group: "Board", keys: ["F"], label: "Enter or leave fullscreen" },
  { group: "Review", keys: ["←"], label: "Previous move" },
  { group: "Review", keys: ["→"], label: "Next move" },
  { group: "Review", keys: ["Home"], label: "First move" },
  { group: "Review", keys: ["End"], label: "Back to the live position" },
  { group: "Help", keys: ["?"], label: "Show this list" },
  { group: "Help", keys: ["Esc"], label: "Leave fullscreen, or stop reviewing" },
];
