# Castle

Online chess with a real 3D board, live matchmaking, an AI opponent that explains itself,
pass-and-play on one device, spectating, replay and a rated leaderboard.

Next.js 16 (App Router, React Compiler) · Convex · Clerk · three.js / react-three-fiber ·
chess.js · Stockfish 18 (WASM) · Eve · Tailwind v4 · shadcn/ui (Base UI "base-nova").

## Setup

Requires **Node >= 24** (Eve 0.52) and **pnpm**.

```bash
pnpm install
```

### 1. Environment variables

Secrets live in Vercel and Clerk, never in the repo. `.env.example` lists every key.

```bash
vercel env pull .env.local          # Convex + Eve keys from the linked Vercel project
npx -y clerk@latest env pull        # NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY + CLERK_SECRET_KEY
```

`.env.local` must also carry the four Clerk URL variables — without
`NEXT_PUBLIC_CLERK_SIGN_IN_URL` the protected-route redirect goes to Clerk's hosted Account
Portal instead of `/sign-in`:

```
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/play
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/play
```

`EVE_SERVER_SECRET` is the last one, and it is the one `vercel env pull` cannot give you on a
fresh clone — nobody has invented it yet. It is the shared secret between `/api/ai/*` and
`agent/channels/eve.ts`, so generate one, put it in `.env.local`, and add it to the Vercel
project:

```bash
openssl rand -hex 32                # paste as EVE_SERVER_SECRET=… in .env.local
vercel env add EVE_SERVER_SECRET    # same value, so deployments match
```

**Without it the AI opponent still plays, and that is exactly the problem.** `eveConfigured()`
is false, so the route never contacts the agent and silently falls back to the direct AI SDK
path: moves and commentary appear, but the Eve agent, its personas and its durable per-game
session are never exercised. The only signal is a `console.warn` from the agent process.
`.env.local` is read once at startup and the agent channel binds the secret at module load, so
adding or rotating it means restarting `pnpm dev`.

### 2. Convex

```bash
npx convex dev                      # pushes the schema + functions, writes NEXT_PUBLIC_CONVEX_URL
```

The deployment needs the Clerk issuer so it can verify tokens (set once, per deployment):

```bash
npx convex env set CLERK_JWT_ISSUER_DOMAIN https://<your-instance>.clerk.accounts.dev
```

Clerk must have a JWT template named exactly **`convex`** (audience `convex`, with a `nickname`
claim carrying the username). Username is required at sign-up, which is why `/sign-in` and
`/sign-up` are optional catch-all routes.

### 3. Run it

```bash
pnpm dev                            # Next.js + the Eve agent, mounted at /eve/v1/*
```

Convex (`npx convex dev`) needs to be running in a second terminal.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Next dev server (Turbopack) with the Eve agent mounted |
| `pnpm build` / `pnpm start` | Production build and server |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint 9 flat config |
| `pnpm test` | Vitest (Convex function tests + shared-library units) |
| `pnpm convex` | `convex dev` |
| `pnpm copy:stockfish` | Refresh `public/stockfish/sf18/` and `sf11/` from the `stockfish` and `stockfish11` dev dependencies. Manual — the engine files are committed, so this is only needed when upgrading. |

## Architecture

`docs/ARCHITECTURE.md` is the authoritative blueprint: the file tree and ownership map (§A), the
Convex schema (§B) and public function surface (§C), every shared TypeScript contract (§D), the
key flows (§E), the AI pipeline (§F), the routes and protection table (§G), and the open
decisions and deviations (§I). `docs/PRD.md` holds the product requirements it implements, and
`docs/research/*.md` are verified, version-specific notes on each library — they override
training-data recollections of these APIs.

The short version:

- **`convex/`** is the only place game state changes. Moves are validated with chess.js
  server-side and written atomically with the rating updates; the client never writes a FEN.
- **`src/lib/`** holds every shared contract — types, constants, room presets, difficulty
  configs, camera/quality tiers, Elo, and the two zustand stores.
- **`src/app/`** is the App Router surface. `/`, `/leaderboard` and the auth routes are public;
  `/play`, `/game/[id]`, `/settings` and `/profile/[username]` are gated three times over —
  `src/proxy.ts`, `(protected)/layout.tsx`, and identity re-derived inside every Convex function.
- **`src/components/board2d/` and `board3d/`** are two implementations of one `BoardViewProps`
  contract, so switching views mid-game keeps selection and review position.
- **`agent/`** is the Eve app: Stockfish generates candidate moves in a worker, the agent picks
  one in persona and writes the commentary, and the client submits it through a mutation that
  re-validates legality.

### The chess engine

The default engine is **Stockfish 18** (`stockfish-18-lite-single`, NNUE): 5.64 MB gzipped, served
from `public/stockfish/sf18/`. It runs in a classic same-origin Web Worker loaded by URL string —
never bundled — and needs no `SharedArrayBuffer`, so the app is not cross-origin isolated. It is
created lazily, only in AI games, terminated on unmount, and cached immutably, so the download
happens once per browser and never at all if you only play humans. While it downloads, the AI panel
shows a real progress bar fed by the engine's own progress channel.

Stockfish 18 requires WebAssembly SIMD. On a browser without it the app silently falls back to
**Stockfish 11** (`public/stockfish/sf11/`, 669 KB gzipped, no SIMD) and says so once in a toast.
This is automatic, not a setting; the active build is shown in the AI-move badge as `SF18`/`SF11`.
Both binaries are committed and refreshed with `pnpm copy:stockfish`; the `stockfish` and
`stockfish11` packages are dev dependencies only.

## Licences and attribution

- **Chess piece models** — `public/models/chess-pieces.glb` is derived from six models by
  **Jarlan Perez** via [Poly Pizza](https://poly.pizza), licensed
  [**CC BY 3.0**](https://creativecommons.org/licenses/by/3.0/). Attribution is a licence
  obligation, not a courtesy: the credit is rendered in the app under Settings → Credits, and
  the full text with per-piece sources is in `public/models/ATTRIBUTION.md`.
- **HDRI environments** — the five 1k `.hdr` files in `public/hdri/` are CC0 from
  [Poly Haven](https://polyhaven.com). No attribution required; the photographers are credited
  in Settings → Credits anyway.
- **Stockfish 18 and Stockfish 11** — GPL v3. The engines are served from
  `public/stockfish/sf18/` and `public/stockfish/sf11/`, each with its licence alongside it at
  `LICENSE-GPL-3.0.txt`, file banners intact. Upstream source:
  [nmrugg/stockfish.js](https://github.com/nmrugg/stockfish.js) (npm `stockfish@18.0.8` and
  `stockfish@11.0.0`).
- Everything else in this repository is the project's own code.

## Known issues

Five platform-level problems shape how this app is built and deployed. Each is written up in
**[`docs/KNOWN_ISSUES.md`](docs/KNOWN_ISSUES.md)** with a reproduction, the mitigation in the repo,
and what would have to change to drop the workaround.

- **`withEve` breaks Next 16.3 segment prefetch on Vercel** (§1). Segment-tree prefetch requests
  404 on static routes, and the optional catch-all auth routes come back with a corrupted tree that
  the router re-requests ~4×/second per visible link. **Every `next/link` in `src/` therefore
  carries `prefetch={false}` on purpose — do not remove it.** The regression is invisible in
  `next dev`; it only appears once deployed. Still broken on eve 0.52.4.
- **Clerk still runs its development instance in production** (§2) — dev email/SMS limits and
  Clerk's shared demo OAuth apps. Migration steps are in §2 and must be done before real users.
- **AI commentary is not token-streamed** (§3). eve's per-turn `outputSchema` filters the deltas
  out of the event stream, so the commentary lands whole after 2–4 s behind live status
  heartbeats. The alternative, and what it costs, is documented there.
- **Piece models are CC BY 3.0** (§4) — attribution is a licence obligation, not a courtesy. See
  "Licences and attribution" above for where the credit is rendered.
- **Stockfish 18 is a 5.6 MB first download** (§5). NFR-3's 2 MB budget was waived deliberately;
  the engine is lazy, immutably cached, shown with a progress bar, and falls back to the 669 KB
  Stockfish 11 build on browsers without WASM SIMD.

## Production checklist

Run through this before the first real deploy, in order.

**1. Clerk production instance.** The app currently ships against Clerk's *development* instance.
Create the production instance, add the `clerk.<domain>` CNAME, re-apply the instance config with
real Google/GitHub OAuth credentials, and **re-create the `convex` JWT template on the production
instance** (templates are per-instance and are not copied by `clerk deploy`). Full steps:
[`docs/KNOWN_ISSUES.md` §2](docs/KNOWN_ISSUES.md).

**2. Vercel environment variables** (Production scope; names only — values come from Clerk, Convex
and `openssl`):

| Variable | Source |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk prod instance (`pk_live_…`) |
| `CLERK_SECRET_KEY` | Clerk prod instance (`sk_live_…`) |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` — omit it and the protected-route redirect goes to Clerk's hosted Account Portal |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | `/play` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | `/play` |
| `NEXT_PUBLIC_CONVEX_URL` | Convex prod deployment |
| `NEXT_PUBLIC_CONVEX_SITE_URL` | Convex prod deployment |
| `CONVEX_DEPLOY_KEY` | Convex dashboard → prod deployment → Deploy key |
| `EVE_SERVER_SECRET` | `openssl rand -hex 32`, identical in every environment that runs `/api/ai/*` |
| `AI_GATEWAY_API_KEY` | optional — only when OIDC is unavailable; on Vercel the OIDC token is used |

Set separately, on the **Convex** production deployment (not in Vercel):

```bash
npx convex env set CLERK_JWT_ISSUER_DOMAIN https://clerk.<domain> --prod
```

**3. Convex production deploy.** Convex is deployed by the Vercel build, so the schema and
functions can never be older than the frontend that calls them. Set the Vercel **Build Command**
to:

```bash
npx convex deploy --cmd 'pnpm build'
```

with `CONVEX_DEPLOY_KEY` present in Production. Do not run `convex deploy` by hand from a laptop.

**4. Fluid compute, for the eve service.** `withEve` writes the agent into the Build Output as its
own service; an AI turn holds the connection open for seconds while it streams. Enable **Fluid
compute** on the Vercel project — dashboard, or `{"fluid": true}` in `vercel.json` — so those
invocations share an instance instead of each paying a cold start. `AI_ROUTE_MAX_DURATION` is 30 s
and the agent budget is 10 s, so the function must be allowed to run that long.

**5. Smoke test the deployment.** Run the end-to-end pass in
[`docs/ARCHITECTURE.md` §H.2](docs/ARCHITECTURE.md) (step 6 is the full manual script: sign-up →
AI game → online match in two browsers → spectator → abandonment → rooms → 2D fallback) against
the production URL, not just locally. `pnpm typecheck`, `pnpm lint` and `pnpm test` are steps 3–5
of that same checklist and should be green before deploying.

**6. Confirm the workarounds survived the build.** After deploying, check that
`prefetch={false}` is still on every `next/link` (see "Known issues") by loading the landing page
and watching the Network panel filtered on `_tree` for 15 s — a stable request count means the
mitigation is in place.

## End-to-end tests

Playwright drives a real Chromium against a real server; Clerk's own
[`@clerk/testing`](https://clerk.com/docs/guides/development/testing/playwright/overview) helpers
supply the Testing Token that gets the suite past bot protection.

| Command | What it runs |
| --- | --- |
| `pnpm e2e` | `e2e/public.spec.ts` only — the guest routes. No Clerk credentials needed. |
| `pnpm e2e:auth` | Everything, including `e2e/auth.spec.ts` (local game, 2D/3D swap, take-back, an AI game, settings persistence, the profile page). |

Both start `pnpm dev` themselves and reuse a dev server that is already listening. Set
`E2E_BASE_URL` to point at something else (a preview deployment, or a server you started by hand)
and no server is spawned. First run only: `pnpm exec playwright install chromium`.

### The environment variables

| Variable | Purpose |
| --- | --- |
| `E2E_BASE_URL` | Optional. Where to point the browser; defaults to `http://localhost:3000` and, when unset **or left empty** (as in `.env.example`), the config also starts the dev server. |
| `E2E_CLERK_USER_EMAIL` | Preferred. The test user's email; the suite mints a Clerk sign-in token for it and signs in with the `ticket` strategy, which bypasses device trust and second factors. |
| `E2E_CLERK_USER_USERNAME` | Fallback identifier for the password strategy (only works when the instance's device trust is off; otherwise the sign-in stops at `needs_client_trust`). |
| `E2E_CLERK_USER_PASSWORD` | That user's password. |

`playwright.config.ts` reads `.env.local` (then `.env`) through Node's own
`process.loadEnvFile`, so putting the three beside the Clerk keys is enough; real shell
variables still win. `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` are already
there and are what `clerkSetup()` uses.

`e2e/auth.spec.ts` **skips itself** unless both `E2E_CLERK_USER_*` values are set, and
`playwright.config.ts` only wires up `e2e/global-setup.ts` (the `clerkSetup()` call) in that
case — so a bare checkout runs `pnpm e2e` with no Clerk configuration at all.

### Development instance only

Testing Tokens are minted by `POST /v1/testing_tokens` on the Clerk Backend API, and that
endpoint **refuses production instances**. Point the run at a development instance (`pk_test_…`
/ `sk_test_…`, which is what `.env.local` holds locally) or `clerkSetup()` throws before the
first test. Never put `sk_live_…` in an E2E environment.

### Creating the test user

Use a throwaway account that exists only for the suite — the authenticated spec creates and
resigns games as that user, so do not point it at your own profile.

```sh
clerk users create --help    # check the current flags for username / password / email
clerk users create ...       # then create the user on the DEVELOPMENT instance
```

Two things the suite assumes about that user:

- It has a **username** — `convex/players.ts` derives the profile handle from Clerk's `nickname`
  claim, and the profile test navigates to `/profile/<username>`.
- Its password sign-in is enabled, because `clerk.signIn` is called with
  `{ strategy: "password", identifier, password }`. Clerk's `+clerk_test` email addresses and
  `+1XXX55501XX` phone numbers work too, via the `email_code` / `phone_code` strategies, if the
  instance is configured that way.

Put the credentials in `.env.local` (git-ignored) and run `pnpm e2e:auth`.

### Layout

```
e2e/
  global-setup.ts     clerkSetup() — fetches the Testing Token once per run
  public.spec.ts      guest routes: landing, leaderboard, sign-in card, /play redirect, /dev/board3d
  auth.spec.ts        signed-in flows (serial: the app allows one active game per player)
  helpers/
    app.ts            sign-in, board and move-list selectors, "end whatever game is running"
    console.ts        console-error collection with the dev-server noise filtered out
```

Reports land in `playwright-report/` and failure artefacts in `test-results/`; both are
git-ignored. `pnpm exec playwright show-report` opens the last run.
