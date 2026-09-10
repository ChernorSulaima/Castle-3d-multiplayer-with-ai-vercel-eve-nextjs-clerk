// e2e/auth.spec.ts
// The flows behind `src/proxy.ts`. Skipped in full unless E2E_CLERK_USER_USERNAME and
// E2E_CLERK_USER_PASSWORD are set, so `pnpm e2e` stays runnable with no credentials.
//
// Serial: the app allows one active game per player (`already-in-game`), so these
// tests share a resource and each one hands the account back clean.
import { expect, test } from "@playwright/test";
import {
  abandonActiveGame,
  clerkUsername,
  hasClerkTestUser,
  moveHistory,
  playMove,
  resign,
  sanMoves,
  setBoardView,
  signIn,
  square,
  turnIndicator,
} from "./helpers/app";

const PLAYER_TWO = "E2E Rival";

test.describe.configure({ mode: "serial" });

test.describe("authenticated flows", () => {
  test.skip(
    !hasClerkTestUser,
    "Set E2E_CLERK_USER_USERNAME and E2E_CLERK_USER_PASSWORD (Clerk development instance) to run these.",
  );

  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("a local 2-player game plays, switches view and takes a move back", async ({ page }) => {
    await abandonActiveGame(page);

    // --- create ------------------------------------------------------------
    await page.getByRole("button", { name: "Set up a local game" }).click();
    const setup = page.getByRole("dialog", { name: "Two players, one device" });
    await expect(setup).toBeVisible();
    await setup.getByLabel("Player 2 name (optional)").fill(PLAYER_TWO);
    await setup.getByRole("button", { name: "Start game" }).click();

    await expect(page).toHaveURL(/\/game\/[a-z0-9]+$/i);
    await expect(moveHistory(page)).toBeVisible();

    // --- 1. e4 on the 2D board --------------------------------------------
    await setBoardView(page, "2D");
    const whiteToMove = (await turnIndicator(page).innerText()).trim();
    expect(whiteToMove).toMatch(/to move$/);

    await playMove(page, "e2", "e4");

    await expect(moveHistory(page).getByRole("button", { name: "e4", exact: true })).toBeVisible();
    expect(await sanMoves(page)).toEqual(["e4"]);
    // The board itself moved the piece, not just the list: e4 now announces a pawn.
    await expect(square(page, "e4")).toHaveAttribute("aria-label", /white pawn/i);

    // The turn indicator names whoever is to move; in a local game that is the
    // other seat's name, so it must have changed.
    await expect(turnIndicator(page)).toContainText(`${PLAYER_TWO} to move`);
    expect((await turnIndicator(page).innerText()).trim()).not.toBe(whiteToMove);

    // --- 3D and back, with the game state intact (FR-14) -------------------
    await setBoardView(page, "3D");
    expect(await sanMoves(page)).toEqual(["e4"]);
    await setBoardView(page, "2D");
    expect(await sanMoves(page)).toEqual(["e4"]);
    await expect(turnIndicator(page)).toContainText(`${PLAYER_TWO} to move`);

    // --- take back one half-move (FR-43) -----------------------------------
    await page.getByRole("button", { name: "Undo move" }).click();
    await expect(moveHistory(page).getByText("No moves yet.")).toBeVisible();
    expect(await sanMoves(page)).toEqual([]);
    await expect(turnIndicator(page)).toContainText(whiteToMove);

    await resign(page);
  });

  test("an AI game at Beginner gets a reply and a commentary entry", async ({ page }) => {
    await abandonActiveGame(page);

    // --- create ------------------------------------------------------------
    await page.getByRole("button", { name: "Choose an opponent" }).click();
    const setup = page.getByRole("dialog", { name: "Play against the computer" });
    await expect(setup).toBeVisible();

    // The difficulty <Select/>; its popup is portalled outside the dialog.
    await setup.locator('[data-slot="select-trigger"]').click();
    await page.getByRole("option", { name: /^Beginner/ }).click();
    // Pip is the Beginner persona, so the submit button confirms the selection.
    const start = setup.getByRole("button", { name: "Play Pip" });
    await expect(start).toBeVisible();
    await start.click();

    await expect(page).toHaveURL(/\/game\/[a-z0-9]+$/i);
    await setBoardView(page, "2D");

    // The colour radio defaults to White, so the player opens.
    await expect(turnIndicator(page)).toContainText("You to move");
    // In AI games the board stays locked until the engine worker is ready (Stockfish 18
    // is a 5.6 MB first download), so wait for the squares to enable before moving.
    await expect(square(page, "e2")).toBeEnabled({ timeout: 90_000 });

    await playMove(page, "e2", "e4");
    // `games.makeMove` is a server round trip; wait for the subscription to deliver the
    // move before reading the list synchronously (the local-game test does the same).
    await expect(moveHistory(page).getByRole("button", { name: "e4", exact: true })).toBeVisible();
    expect(await sanMoves(page)).toEqual(["e4"]);

    // --- the AI answers ----------------------------------------------------
    // Stockfish loads in a worker, the agent (or the engine fallback) picks a move,
    // and `games.makeAiMove` writes it plus a commentary row.
    await expect
      .poll(async () => (await sanMoves(page)).length, {
        timeout: 25_000,
        intervals: [500],
        message: "the AI never replied",
      })
      .toBeGreaterThanOrEqual(2);

    const commentary = page.locator('[data-slot="commentary-panel"]');
    await expect(commentary).toBeVisible();
    await expect(commentary.getByText(/will comment once the game is under way/)).toBeHidden({
      timeout: 25_000,
    });
    await expect(commentary.locator("ul > li")).not.toHaveCount(0);

    await resign(page);
  });

  test("settings survive a reload", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();

    const presets = page.getByRole("group", { name: "Room preset" });
    await expect(presets).toBeVisible();
    const presetButtons = presets.getByRole("button");
    const presetCount = await presetButtons.count();
    expect(presetCount).toBeGreaterThan(1);

    // Pick whichever preset is not the current one, so the test is repeatable.
    let targetIndex = -1;
    for (let i = 0; i < presetCount; i += 1) {
      if ((await presetButtons.nth(i).getAttribute("aria-pressed")) !== "true") {
        targetIndex = i;
        break;
      }
    }
    expect(targetIndex, "every room preset reported itself as selected").toBeGreaterThan(-1);
    await presetButtons.nth(targetIndex).click();
    await expect(presetButtons.nth(targetIndex)).toHaveAttribute("aria-pressed", "true");

    const flip = page.getByRole("switch", { name: "Flip the board between turns" });
    const wasChecked = await flip.getAttribute("aria-checked");
    await flip.click();
    const nowChecked = wasChecked === "true" ? "false" : "true";
    await expect(flip).toHaveAttribute("aria-checked", nowChecked);

    // `players.updateSettings` is debounced by 400 ms (use-settings-sync.ts).
    await page.waitForTimeout(2_000);
    await page.reload();

    await expect(presets).toBeVisible();
    await expect(presets.getByRole("button").nth(targetIndex)).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByRole("switch", { name: "Flip the board between turns" })).toHaveAttribute(
      "aria-checked",
      nowChecked,
    );
  });

  test("the profile page renders for the signed-in player", async ({ page }) => {
    const username = await clerkUsername(page);

    await page.goto(`/profile/${encodeURIComponent(username)}`);

    await expect(page.getByRole("heading", { level: 1, name: username })).toBeVisible();
    await expect(page.getByText("Playing since")).toBeVisible();
    // The stat tiles are a <dl>; scope to its <dt>s, because the sparkline's pool
    // buttons carry the same "vs Humans" / "vs AI" text.
    for (const stat of ["Overall", "vs Humans", "vs AI", "Record"]) {
      await expect(page.getByRole("term").filter({ hasText: new RegExp(`^${stat}$`) })).toBeVisible();
    }
  });
});
