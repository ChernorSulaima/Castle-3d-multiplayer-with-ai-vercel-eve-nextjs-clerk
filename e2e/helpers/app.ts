// e2e/helpers/app.ts
// Selectors and small flows shared by the authenticated spec. Everything here is
// pinned to markup that already exists in `src/` — roles, ARIA labels, the board's
// own `data-square` attributes and the `data-slot` hooks the shadcn primitives emit.
import { expect, type Locator, type Page } from "@playwright/test";
import { clerk } from "@clerk/testing/playwright";

export const E2E_EMAIL = process.env.E2E_CLERK_USER_EMAIL;
export const E2E_USERNAME = process.env.E2E_CLERK_USER_USERNAME;
export const E2E_PASSWORD = process.env.E2E_CLERK_USER_PASSWORD;
/** Either a sign-in-token email, or a username + password pair, unlocks the suite. */
export const hasClerkTestUser =
  Boolean(E2E_EMAIL) || (Boolean(E2E_USERNAME) && Boolean(E2E_PASSWORD));

/**
 * Signs the E2E user in. Preferred path: `clerk.signIn({ page, emailAddress })`, which
 * looks the user up on the Backend API, mints a 5-minute sign-in token and signs in with
 * the `ticket` strategy (verified in @clerk/testing 2.2.33 dist/playwright/index.mjs).
 * That bypasses first/second factors — including the instance's device-trust step,
 * which turns a plain password sign-in into `needs_client_trust` on a fresh browser and
 * never creates a session. Password stays as the fallback for instances without it.
 *
 * `clerk.signIn` installs the Testing Token on the context itself and waits for
 * `window.Clerk.loaded`, so the only requirement is that we are already on a page that
 * mounts `<ClerkProvider/>` and is not gated by `src/proxy.ts` — `/` is both.
 */
export async function signIn(page: Page): Promise<void> {
  await page.goto("/");
  if (E2E_EMAIL) {
    await clerk.signIn({ page, emailAddress: E2E_EMAIL });
    return;
  }
  await clerk.signIn({
    page,
    signInParams: {
      strategy: "password",
      identifier: E2E_USERNAME as string,
      password: E2E_PASSWORD as string,
    },
  });
}

/** The Clerk username, which `players.ensurePlayer` uses as the profile handle. */
export async function clerkUsername(page: Page): Promise<string> {
  await clerk.loaded({ page });
  const username = await page.evaluate(() => window.Clerk?.user?.username ?? null);
  expect(
    username,
    "the E2E Clerk user needs a username — the app derives the profile handle from it",
  ).not.toBeNull();
  return username as string;
}

/* ------------------------------------------------------------------ board */

export function moveHistory(page: Page): Locator {
  return page.getByRole("region", { name: "Move history" });
}

/** Every SAN currently in the move list, in play order. */
export async function sanMoves(page: Page): Promise<string[]> {
  return moveHistory(page).locator("ol button").allInnerTexts();
}

/** `<p role="status">{turnLabel} to move</p>` in <GameHeader/>. */
export function turnIndicator(page: Page): Locator {
  return page.getByRole("status").filter({ hasText: /to move|Game over/ });
}

export function square(page: Page, id: string): Locator {
  return page.locator(`[data-square="${id}"]`);
}

/** Click from-square then to-square on the 2D board. */
export async function playMove(page: Page, from: string, to: string): Promise<void> {
  await square(page, from).click();
  await square(page, to).click();
}

/** FR-14's 2D/3D switch; `boardView` defaults to 3D, so tests ask for 2D explicitly. */
export async function setBoardView(page: Page, view: "2D" | "3D"): Promise<void> {
  await page.getByRole("group", { name: "Board view" }).getByRole("button", { name: view }).click();
  if (view === "2D") {
    await expect(square(page, "e1")).toBeVisible();
  } else {
    await expect(page.getByRole("application", { name: /3D chess board/i })).toBeVisible();
    await expect(page.locator("canvas")).toBeVisible({ timeout: 45_000 });
  }
}

/* ------------------------------------------------------------------- game */

export async function gotoPlay(page: Page): Promise<void> {
  await page.goto("/play");
  await expect(page.getByRole("heading", { level: 1, name: "Play" })).toBeVisible();
  // `games.myActiveGame` is a live subscription; the resume banner (and the disabled
  // state of the two "start a game" buttons) only settles once its first value lands.
  await expect(page.getByRole("button", { name: "Choose an opponent" })).toBeVisible();
  await page.waitForFunction(() => document.readyState === "complete");
  await page.waitForTimeout(1_500);
}

/** Ends whatever game the test user is in, so the next `create*Game` is allowed. */
export async function abandonActiveGame(page: Page): Promise<void> {
  await gotoPlay(page);
  const resume = page.getByRole("link", { name: "Resume game" });
  if ((await resume.count()) === 0) return;
  await resume.click();
  await expect(page).toHaveURL(/\/game\//);
  await resign(page);
  await gotoPlay(page);
  await expect(page.getByRole("link", { name: "Resume game" })).toHaveCount(0);
}

export async function resign(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Resign" }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "Resign" }).click();
  // FR-45: the end-of-game card opens as soon as the mutation lands. It is modal, so
  // the rest of the page goes `aria-hidden` — assert on the dialog, not the header.
  await expect(page.getByRole("dialog")).toBeVisible();
}
