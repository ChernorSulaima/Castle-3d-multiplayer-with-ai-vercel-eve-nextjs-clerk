// e2e/public.spec.ts
// The routes a signed-out visitor can reach (ARCHITECTURE.md §G): `/`, `/leaderboard`,
// `/sign-in`, plus the development-only harnesses of UI_REDESIGN §8 — `/dev/board3d`,
// `/dev/game` and `/dev/ui-kit`. Nothing in this file needs Clerk credentials, so
// `pnpm e2e` runs it anywhere.
//
// The `/dev/*` routes are the ONLY way this suite can see the signed-in surfaces: no
// agent and no CI job can sign in, and `notFound()` keeps them out of production.
import { expect, test } from "@playwright/test";
import { watchConsole } from "./helpers/console";

test.describe("public routes", () => {
  test("the landing page renders the hero, the replay and the live section", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { level: 1, name: "Chess you can walk around." }),
    ).toBeVisible();

    // The primary CTA is client-rendered from Clerk's `useAuth()` — a guest is sent
    // to /sign-up — so the href settling is the real signal that the page hydrated
    // rather than just streamed.
    const play = page.getByRole("link", { name: "Play now" });
    await expect(play).toBeVisible();
    await expect(play).toHaveAttribute("href", "/sign-up");

    // UI_REDESIGN §1.4: the hero replays the Opera Game and prints the moves as they
    // land. The strip starts empty, so waiting for the first move proves the replay
    // is running (and, under prefers-reduced-motion, that the final position is up).
    const notation = page.getByRole("list", { name: "Moves played so far" });
    await expect(notation).toContainText("e4");
    await expect(
      page.getByText("Now playing · Morphy vs Duke Karl & Count Isouard · Paris, 1858"),
    ).toBeVisible();

    // "Choose your room": five cards, the hero's own room pressed.
    const rooms = page.locator("#rooms").getByRole("button");
    await expect(rooms).toHaveCount(5);
    await expect(rooms.first()).toHaveAttribute("aria-pressed", "true");

    // "Play your way" deep-links into /play.
    await expect(page.getByRole("link", { name: "Find a match" })).toHaveAttribute(
      "href",
      "/play?mode=online",
    );

    // FR-8: `games.listLive` is a public Convex query, so the live section renders
    // for guests. It shows either game rows or the empty-state copy; the region is
    // the stable part, so assert on that and on it having settled out of the skeleton.
    const live = page.getByRole("region", { name: "Games in progress." });
    await expect(live).toBeVisible();
    await expect(live.getByRole("heading", { name: "Top rated" })).toBeVisible();
    await expect(live.locator("ul, ol, p")).not.toHaveCount(0);

    // The piece models are CC BY 3.0: the credit is a licence obligation.
    await expect(
      page.getByText("Chess pieces by Jarlan Perez via Poly Pizza — CC BY 3.0"),
    ).toBeVisible();
  });

  test("the leaderboard renders three rating pools and switches between them", async ({
    page,
  }) => {
    await page.goto("/leaderboard");
    await expect(page.getByRole("heading", { level: 1, name: "Leaderboard" })).toBeVisible();

    // UI_REDESIGN §6: the pools are tabs now, one panel each, so the state lives in
    // `aria-selected` on a `tab` rather than `aria-pressed` on a toggle button.
    const pools = page.getByRole("tablist", { name: "Rating pool" });
    await expect(pools).toBeVisible();

    const all = pools.getByRole("tab", { name: "All", exact: true });
    const humans = pools.getByRole("tab", { name: "vs Humans" });
    const ai = pools.getByRole("tab", { name: "vs AI" });

    await expect(all).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText("Overall rating across every mode")).toBeVisible();
    // Exactly one pool is subscribed at a time — the other panels are unmounted.
    await expect(page.getByRole("tabpanel")).toHaveCount(1);

    await humans.click();
    await expect(humans).toHaveAttribute("aria-selected", "true");
    await expect(all).toHaveAttribute("aria-selected", "false");
    await expect(page.getByText("Rating from online games only")).toBeVisible();

    await ai.click();
    await expect(ai).toHaveAttribute("aria-selected", "true");
    await expect(humans).toHaveAttribute("aria-selected", "false");
    await expect(page.getByText("Rating from games against the computer")).toBeVisible();
  });

  test("the sign-in page renders the Clerk card", async ({ page }) => {
    await page.goto("/sign-in");

    // The card is themed through Clerk's `appearance.variables` (UI_REDESIGN §1.1),
    // which recolours it without touching its markup — so these selectors are the
    // same ones as before the redesign, deliberately.
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
    // The two social connections configured on the instance.
    await expect(page.getByRole("button", { name: "GitHub" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Google" })).toBeVisible();
    // Clerk names the first-factor field `identifier` regardless of which
    // identifiers the instance accepts.
    await expect(page.locator('input[name="identifier"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
  });

  test("/play bounces a guest to /sign-in", async ({ page }) => {
    await page.goto("/play");

    // `src/proxy.ts` -> `auth.protect()` redirects and keeps the destination.
    await expect(page).toHaveURL(/\/sign-in(\?|$)/);
    await expect(page).toHaveURL(/redirect_url=.*%2Fplay/);
    await expect(page.locator('input[name="identifier"]')).toBeVisible();
  });

  test("the dev 3D harness mounts a canvas with the camera overlay", async ({ page }) => {
    await page.goto("/dev/board3d");

    // Board3D's wrapper. It is only rendered while the WebGL2 probe has not said
    // "no" — reaching it at all proves the probe passed.
    const board = page.getByRole("application", { name: /3D chess board/i });
    await expect(board).toBeVisible();
    await expect(board.locator("canvas")).toBeVisible({ timeout: 45_000 });

    for (const label of ["White", "Black", "Top", "Orbit"]) {
      await expect(board.getByRole("button", { name: label, exact: true })).toBeVisible();
    }
    await expect(board.getByRole("button", { name: "Reset the camera" })).toBeVisible();
    // FR-23: the seat the camera starts from is the selected preset.
    await expect(board.getByRole("button", { name: "White", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // The dev harness's own controls, so the page is genuinely interactive.
    await expect(page.getByRole("button", { name: /^Play next move/ })).toBeVisible();
  });

  test("the dev game harness renders the shell, its action bar and the chat", async ({
    page,
  }) => {
    await page.goto("/dev/game?scenario=ai-midgame");

    // §8: the harness renders the real GameShellView against a mocked controller, so
    // reaching the shell at all proves the pure-view split still holds with no Clerk
    // and no Convex in the tree.
    await expect(page.getByRole("heading", { level: 1 })).toBeAttached();

    // §5.1's action bar: always visible, every action labelled. The labels collapse to
    // `sr-only` below 1280, so these match the accessible name at any width.
    const actions = page.getByRole("toolbar", { name: "Game actions" });
    await expect(actions).toBeVisible();
    // The view toggle names the view it switches TO, so either way round is correct.
    await expect(actions.getByRole("button", { name: /^(2D|3D)$/ })).toBeVisible();
    for (const name of [
      "Flip",
      "Fullscreen",
      "Take back",
      "Room",
      "Shortcuts",
    ]) {
      await expect(actions.getByRole("button", { name, exact: true })).toBeVisible();
    }
    await expect(actions.getByRole("button", { name: /^Hint/ })).toBeVisible();
    await expect(actions.getByRole("button", { name: "Resign the game" })).toBeVisible();
    await expect(actions.getByRole("button", { name: "PGN export" })).toBeVisible();
    // 3D only, and it is why the in-canvas camera overlay is hidden in the shell:
    // the presets live here instead of on top of the board.
    await expect(actions.getByRole("button", { name: "Camera angle" })).toBeVisible();

    // The sidebar's three tabs, Chat first in an AI game (§5.1).
    const tabs = page.getByRole("tab");
    await expect(tabs).toHaveCount(3);
    await expect(page.getByRole("tab", { name: "Chat" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    // The chat itself: a live region named for the persona, carrying the scenario's
    // persisted commentary and the player's own moves in ply order.
    const chat = page.getByRole("list", { name: /Conversation with/i });
    await expect(chat).toBeVisible();
    await expect(chat.getByText("You played e4")).toBeVisible();
    // §5.1's composer is the primary hint button with the remaining count.
    await expect(page.getByRole("button", { name: /Ask for a hint/ })).toBeVisible();

    // The board box is square and the screen never scrolls (§5.1).
    await expect(page.getByRole("application", { name: /3D chess board/i })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight),
    ).toBeLessThanOrEqual(0);
  });

  test("the focus layout hides the header and keeps the essentials", async ({ page }) => {
    await page.goto("/dev/game?scenario=fullscreen");

    // §5.2: the shell sets `data-layout="focus"` on <html> and the header hides
    // itself against exactly that attribute — the only coupling between the two.
    await expect(page.locator("html")).toHaveAttribute("data-layout", "focus");
    await expect(page.locator('header[data-slot="site-header"]')).toBeHidden();
    await expect(page.getByRole("button", { name: "Exit fullscreen" })).toBeVisible();
  });

  test("the ui-kit gallery renders every primitive", async ({ page }) => {
    await page.goto("/dev/ui-kit");

    // §7's shared components, each in its own anchored section. If one of them threw,
    // its section would be missing rather than merely ugly.
    for (const id of [
      "palette",
      "type-scale",
      "player-chips",
      "action-bar",
      "chat",
      "move-list",
      "mini-boards",
      "room-cards",
      "persona-cards",
      "mode-cards",
      "podium",
    ]) {
      await expect(page.locator(`#${id}`)).toBeVisible();
    }

    // MiniBoard is an SVG board built from a FEN — 64 squares, no images.
    await expect(page.locator("#mini-boards svg").first()).toBeVisible();
    // Fraunces is loaded through next/font as --font-display (§1.2).
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("the public routes log no console errors", async ({ page }) => {
    const consoleWatcher = watchConsole(page);

    for (const route of [
      "/",
      "/leaderboard",
      "/sign-in",
      "/dev/board3d",
      "/dev/game?scenario=ai-midgame",
      "/dev/ui-kit",
      "/dev/pages",
    ]) {
      await page.goto(route);
      // Let hydration, Convex's websocket and Clerk's script settle before moving on.
      await page.waitForLoadState("networkidle");
    }
    // The 3D scene loads its GLB and HDRI after first paint. `/dev/pages` is the last
    // route in the sweep and mounts the settings preview, which is a showcase board:
    // with its controls hidden it is a `role="img"` picture, not an application.
    await expect(page.locator("[data-showcase=true], [role=application]").first()).toBeVisible();
    await page.waitForTimeout(3_000);

    expect(consoleWatcher.errors()).toEqual([]);
  });
});
