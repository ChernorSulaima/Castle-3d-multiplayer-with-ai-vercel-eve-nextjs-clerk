/**
 * Convex functions throw stable machine codes, not user copy. A rejected
 * mutation surfaces them wrapped in transport noise, e.g.
 * `[CONVEX M(queue:join)] [Request ID: …] Server Error\nUncaught Error: already-in-game\n  at …`,
 * so the codes are matched as substrings rather than compared for equality.
 *
 * Owned by P2 and shared by every page that calls a mutation. P3/P5 keep their
 * own game-specific mapping for the move-path codes.
 */
const MESSAGES: ReadonlyArray<readonly [code: string, message: string]> = [
  ["already-in-game", "You already have a game in progress. Finish or resign it first."],
  ["invalid-room-image", "That image is not usable — pick a PNG or JPEG under 5 MB."],
  ["upload-not-found", "The upload did not finish. Try picking the file again."],
  ["invalid-colour", "Those colours are not valid hex values."],
  ["hints-unavailable", "Hints are only available at Beginner and Casual."],
  ["hint-limit", "You have used all three hints in this game."],
  ["not-a-participant", "You are watching this game, not playing it."],
  ["game-not-found", "That game no longer exists."],
  ["game-not-active", "That game has already finished."],
  ["Player not provisioned", "Your profile is still being set up. Give it a second and try again."],
  ["Not authenticated", "You have been signed out. Sign in again to continue."],
];

export function describeConvexError(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message : String(error);
  for (const [code, message] of MESSAGES) {
    if (raw.includes(code)) return message;
  }
  return fallback;
}
