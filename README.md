# 3D Chess

Online chess with a real 3D board, live matchmaking, an AI opponent that explains itself,
pass-and-play on one device, spectating, replay and a rated leaderboard.

Next.js 16 (App Router, React Compiler) · Convex · Clerk · three.js / react-three-fiber ·
chess.js · Stockfish 11 (WASM) · Eve · Tailwind v4 · shadcn/ui (Base UI "base-nova").

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
| `pnpm copy:stockfish` | Refresh `public/stockfish/sf11/` from `node_modules/stockfish`. Manual — the engine files are committed, so this is only needed when upgrading. |

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

## Licences and attribution

- **Chess piece models** — `public/models/chess-pieces.glb` is derived from six models by
  **Jarlan Perez** via [Poly Pizza](https://poly.pizza), licensed
  [**CC BY 3.0**](https://creativecommons.org/licenses/by/3.0/). Attribution is a licence
  obligation, not a courtesy: the credit is rendered in the app under Settings → Credits, and
  the full text with per-piece sources is in `public/models/ATTRIBUTION.md`.
- **HDRI environments** — the five 1k `.hdr` files in `public/hdri/` are CC0 from
  [Poly Haven](https://polyhaven.com). No attribution required; the photographers are credited
  in Settings → Credits anyway.
- **Stockfish 11** — GPL v3. The engine is served from `public/stockfish/sf11/` with its
  licence alongside it at `LICENSE-GPL-3.0.txt`, banners intact.
- Everything else in this repository is the project's own code.
