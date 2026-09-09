// e2e/public.spec.ts
// The routes a signed-out visitor can reach (ARCHITECTURE.md §G): `/`, `/leaderboard`,
// `/sign-in`, plus the development-only `/dev/board3d` harness. Nothing in this file
// needs Clerk credentials, so `pnpm e2e` runs it anywhere.
import { expect, test } from "@playwright/test";
import { watchConsole } from "./helpers/console";

test.describe("public routes", () => {
  test("the landing page renders the hero and the live ticker", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { level: 1, name: "Chess, in three dimensions." }),
    ).toBeVisible();
    // The CTA is client-rendered from Clerk's `useAuth()`, so it is the real signal
    // that the page hydrated rather than just streamed.
    await expect(page.getByRole("link", { name: "Create an account" })).toBeVisible();

    // The three feature headings from <Hero/>.
    await expect(page.getByText("Real 3D board")).toBeVisible();
    await expect(page.getByText("Rated matchmaking")).toBeVisible();

    // FR-8: `games.listLive` is a public Convex query, so the ticker renders for
    // guests. It shows either chips or the empty-state copy; the region is the
    // stable part, so assert on that and on it having settled out of the skeleton.
    const ticker = page.getByRole("region", { name: "Games in progress" });
    await expect(ticker).toBeVisible();
    await expect(ticker.getByText("Live")).toBeVisible();
    await expect(ticker.locator("ul, p")).not.toHaveCount(0);
  });

  test("the leaderboard renders three rating pools and switches between them", async ({
    page,
  }) => {
    await page.goto("/leaderboard");
    await expect(page.getByRole("heading", { level: 1, name: "Leaderboard" })).toBeVisible();

    const pools = page.getByRole("group", { name: "Leaderboard filter" });
    await expect(pools).toBeVisible();

    const all = pools.getByRole("button", { name: "All", exact: true });
    const humans = pools.getByRole("button", { name: "vs Humans" });
    const ai = pools.getByRole("button", { name: "vs AI" });

    await expect(all).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("Overall rating across every mode")).toBeVisible();

    await humans.click();
    await expect(humans).toHaveAttribute("aria-pressed", "true");
    await expect(all).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByText("Rating from online games only")).toBeVisible();

    await ai.click();
    await expect(ai).toHaveAttribute("aria-pressed", "true");
    await expect(humans).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByText("Rating from games against the computer")).toBeVisible();
  });

  test("the sign-in page renders the Clerk card", async ({ page }) => {
    await page.goto("/sign-in");

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

  test("the public routes log no console errors", async ({ page }) => {
    const consoleWatcher = watchConsole(page);

    for (const route of ["/", "/leaderboard", "/sign-in", "/dev/board3d"]) {
      await page.goto(route);
      // Let hydration, Convex's websocket and Clerk's script settle before moving on.
      await page.waitForLoadState("networkidle");
    }
    // The 3D scene loads its GLB and HDRI after first paint.
    await expect(page.getByRole("application", { name: /3D chess board/i })).toBeVisible();
    await page.waitForTimeout(3_000);

    expect(consoleWatcher.errors()).toEqual([]);
  });
});
