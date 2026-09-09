# Next.js 16.3.4 App Router + shadcn/ui (Base UI) + Tailwind v4 — verified notes for the 3D chess app

Scope: framework/UI-layer facts that every implementation agent needs. Verified against the
installed packages in `node_modules/` (exact versions below), the bundled Next docs at
`node_modules/next/dist/docs/`, the repo scaffold files, context7 (`/vercel/next.js`), and the
official Clerk / shadcn / Tailwind / Base UI docs (WebFetch). Sources are cited per section.
Anything not confirmed is in the last section.

## 0. Repo state as scaffolded (read these before touching config)

| File | What it says | Source |
|---|---|---|
| `package.json` | `next 16.3.4`, `react 19.2.8`, `react-dom 19.2.8`, `typescript ^5`, `eslint ^9`, `eslint-config-next 16.3.4`, `tailwindcss ^4` (installed 4.3.3), `@tailwindcss/postcss ^4` (4.3.3), `babel-plugin-react-compiler 1.0.0`, `shadcn ^4.21.0`, `@base-ui/react ^1.8.0`, `cn ^0.2.6`, `class-variance-authority ^0.7.1`, `lucide-react ^1.42.0`, `tw-animate-css ^1.4.0`, `sonner ^2.0.8`, `next-themes ^0.4.6`, `@clerk/nextjs ^7.9.1`. Scripts: `dev: next dev`, `build: next build`, `start: next start`, `lint: eslint`. `packageManager: pnpm@11.24.0`. | `/package.json` |
| `next.config.ts` | Only `reactCompiler: true`. No `typedRoutes`, no `headers()`, no `images`, no `cacheComponents`. | `/next.config.ts` |
| `tsconfig.json` | `strict: true`, `moduleResolution: bundler`, `jsx: react-jsx`, `paths: {"@/*": ["./src/*"]}`, `plugins: [{name:"next"}]`, `include` has `.next/types/**/*.ts` and `.next/dev/types/**/*.ts`. | `/tsconfig.json` |
| `eslint.config.mjs` | ESLint 9 flat config: `defineConfig([...nextVitals, ...nextTs, globalIgnores([".next/**","out/**","build/**","next-env.d.ts"])])` importing `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`. | `/eslint.config.mjs` |
| `postcss.config.mjs` | `plugins: { "@tailwindcss/postcss": {} }` | `/postcss.config.mjs` |
| `pnpm-workspace.yaml` | `allowBuilds: { esbuild: true, sharp: false, stockfish: true, unrs-resolver: false }` (pnpm 11 build-script allowlist). | `/pnpm-workspace.yaml` |
| `components.json` | `style: "base-nova"`, `rsc: true`, `tsx: true`, `tailwind.css: "src/app/globals.css"`, `baseColor: "neutral"`, `cssVariables: true`, `prefix: ""`, `iconLibrary: "lucide"`, aliases `@/components`, `@/lib/utils`, `@/components/ui`, `@/lib`, `@/hooks`. | `/components.json` |
| `src/lib/utils.ts` | `export { cn } from "cn"` (the `cn` npm package, NOT clsx+tailwind-merge; neither clsx nor tailwind-merge is installed). | `/src/lib/utils.ts` |
| `src/app/layout.tsx` | Uses `Geist`/`Geist_Mono` from `next/font/google` with CSS vars `--font-geist-sans` / `--font-geist-mono`; root layout typed as `RootLayout({ children }: LayoutProps<"/">)` (global helper, no import). | `/src/app/layout.tsx` |
| `src/components/ui/` | 26 shadcn components already present: alert-dialog, avatar, badge, button, card, dialog, drawer, dropdown-menu, input, label, popover, progress, radio-group, scroll-area, select, separator, sheet, skeleton, slider, sonner, switch, table, tabs, toggle-group, toggle, tooltip. | `ls src/components/ui` |
| `AGENTS.md` | Auto-written by `next dev`: "This is NOT the Next.js you know … read `node_modules/next/dist/docs/`". Re-created on every `next dev`; commit it. | `/AGENTS.md` |
| `.gitignore` | ignores `/.next/`, `.env*`, `.vercel`, `next-env.d.ts`, `*.tsbuildinfo`. | `/.gitignore` |
| `src/proxy.ts` / `middleware.ts` | Do not exist yet. | `ls` |

Node/TS minimums for Next 16: Node.js >= 20.9, TypeScript >= 5.1; browsers Chrome/Edge/Firefox 111+, Safari 16.4+ (`02-guides/upgrading/version-16.md`).

---

## 1. `proxy.ts` (was `middleware.ts`) and Clerk

Source: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`,
`02-guides/upgrading/version-16.md` ("`middleware` to `proxy`"), Clerk docs (WebFetch of
`clerk.com/docs/reference/nextjs/clerk-middleware` and `/docs/nextjs/getting-started/quickstart`),
`node_modules/@clerk/nextjs/dist/types/server/*.d.ts`.

Facts (v16):
- File is `proxy.ts` at project root **or inside `src/`** (same level as `app`). For this repo: **`src/proxy.ts`**. `middleware.ts` / `export function middleware` are deprecated (still work, warn). Codemod: `npx @next/codemod@canary middleware-to-proxy .`
- Export a named `proxy` function **or** a default export (Clerk uses default export). Signature `(request: NextRequest, event?: NextFetchEvent)`. Type shorthand: `import type { NextProxy } from 'next/server'`.
- **Runtime is Node.js and cannot be configured.** `export const runtime = 'edge'` in a proxy file throws. (v16 upgrade guide: "The `edge` runtime is NOT supported in `proxy`".)
- `export const config = { matcher: ... }` — string, array of strings, or objects `{ source, locale?, has?, missing? }`. Values must be constants (statically analysed). Without a matcher, proxy runs on every request including `_next/static`, `_next/image`, `public/` assets. `/_next/data` is always matched even if excluded.
- Config flags renamed: `skipMiddlewareUrlNormalize` -> `skipProxyUrlNormalize`.
- Server Functions are POSTs to the page route they are used on, so a matcher that excludes a path also skips proxy for server actions on that path. **Always re-check auth inside each Server Action / route handler / Convex function**, never rely on proxy alone (proxy.md "Good to know", and Clerk says the same).

Clerk 7.9.1 wiring (peer range `next: ^15.2.8 || … || ^16.0.10 || ^16.1.0-0` covers 16.3.4 — `node_modules/@clerk/nextjs/package.json`):

```ts
// src/proxy.ts  (verbatim from clerk.com/docs/reference/nextjs/clerk-middleware, Next 16+ naming)
import { clerkMiddleware } from '@clerk/nextjs/server'

export default clerkMiddleware()

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
    '/__clerk/(.*)',
  ],
}
```

- `clerkMiddleware` overloads (from `dist/types/server/clerkMiddleware.d.ts`): `clerkMiddleware()`, `clerkMiddleware(options)`, `clerkMiddleware((auth, request, event) => ..., options | (req) => options)`. The handler's `auth` is `AuthFn` with `auth.protect()`; the awaited auth object also has `redirectToSignIn()` / `redirectToSignUp()`. Options include `debug`, `contentSecurityPolicy`, `frontendApiProxy`, plus `AuthenticateRequestOptions` (e.g. `signInUrl`, `publishableKey`).
- Exports from `@clerk/nextjs/server` (`dist/types/server/index.d.ts`): `clerkMiddleware`, `createRouteMatcher`, `auth`, `currentUser`, `getAuth`, `clerkClient`, `createClerkClient`, `verifyToken`, `buildClerkProps`, `clerkFrontendApiProxy`, `createFrontendApiProxyHandlers`, webhook types.
- **`createRouteMatcher` is `@deprecated`** in 7.9.1 ("will be removed in the next major … Use resource-based auth checks instead … Move auth checks into each page, layout, API route, or Server Function") and logs a runtime warning. For FR-4 ("`/play`, `/game/[id]`, `/profile` protected") prefer `await auth.protect()` / `const { userId } = await auth(); if (!userId) redirect(...)` inside a route-group layout (e.g. `src/app/(protected)/layout.tsx`) and in every Server Action. If you still want a proxy-level gate, match manually inside the handler on `request.nextUrl.pathname` (no `createRouteMatcher`).
- `ClerkProvider` goes **inside `<body>`**, not around `<html>` (Clerk quickstart).
- Clerk's own `proxy.js` module (`dist/esm/server/proxy.js`) is the *Frontend-API proxy* (`clerkFrontendApiProxy`, `/__clerk/(.*)` route) — unrelated to the Next `proxy.ts` file name. Do not confuse them.

---

## 2. Async `params` / `searchParams`, typed helpers, route-type generation

Sources: `03-file-conventions/page.md`, `route.md`, `layout.md`, `05-config/02-typescript.md`,
`.next/types/routes.d.ts` (generated in this repo), `next-env.d.ts`,
`node_modules/next/dist/server/lib/router-utils/route-types-utils.js`.

- Since v15 `params` and `searchParams` are **Promises** in pages/layouts and `context.params` is a Promise in route handlers. Always `await`.
- Global helpers generated by `next dev` / `next build` / `next typegen` into `.next/types/routes.d.ts` (imported by `next-env.d.ts`; `.next/types/**/*.ts` and `.next/dev/types/**/*.ts` are in tsconfig `include`): **`PageProps<'/route'>`, `LayoutProps<'/route'>`, `RouteContext<'/route'>`** — available without import. `.next/types/validator.ts` type-checks that each page/layout default export has a compatible signature.
- "Generating route types" at scaffold time = this manifest. It does **not** by itself type `<Link href>`. `route-types-utils.js` line 311: `link.d.ts` is only written when `config.typedRoutes === true`. So: `PageProps/LayoutProps/RouteContext` always exist; **typed `href` requires adding `typedRoutes: true` to `next.config.ts`** (stable option; do not use `experimental.typedRoutes`). With it, literal hrefs in `next/link` and `router.push/replace/prefetch` are validated; non-literal strings need `as Route` (`import type { Route } from 'next'`).
- `next typegen` (CLI) regenerates types without a build: `pnpm next typegen && pnpm tsc --noEmit`. `next dev` writes to `.next/dev` (dev and build can run concurrently; a lockfile prevents two `next dev`s).

```tsx
// src/app/game/[id]/page.tsx
export default async function GamePage({ params }: PageProps<'/game/[id]'>) {
  const { id } = await params
  // searchParams: Promise<Record<string, string | string[] | undefined>>
}

// src/app/profile/[username]/page.tsx
export default async function ProfilePage(props: PageProps<'/profile/[username]'>) {
  const { username } = await props.params
}

// route handler
import type { NextRequest } from 'next/server'
export async function GET(_req: NextRequest, ctx: RouteContext<'/api/games/[id]'>) {
  const { id } = await ctx.params
  return Response.json({ id })
}
```

Client components cannot `await`; read params with `useParams()` / `useSearchParams()` from `next/navigation` (wrap `useSearchParams` users in `<Suspense>` to avoid CSR bail-out).

---

## 3. Route handlers (`route.ts`)

Source: `03-file-conventions/route.md`, `01-getting-started/15-route-handlers.md`,
`02-route-segment-config/runtime.md`, `maxDuration.md`, `index.md`.

- File `route.ts|js`; export `GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS`. A `route.ts` cannot sit in the same segment as a `page.tsx`.
- Not cached by default (since v15 GET is dynamic). Opt in with `export const dynamic = 'force-static'` (only when `cacheComponents` is off).
- Streaming: return `new Response(readableStream)`; the doc's LLM example still shows the long-removed `StreamingTextResponse` from an ancient AI SDK — **ignore it**; with `ai@7` use the AI SDK's own response helpers (see the AI SDK research doc).
- Segment config exports allowed in route.ts: `dynamic`, `dynamicParams`, `revalidate`, `fetchCache`, `runtime`, `preferredRegion` (deprecated), `maxDuration`.
  - `export const runtime = 'nodejs'` is the default; **`'edge'` is deprecated** ("Remove the `runtime` export"). Don't write it.
  - `export const maxDuration = 30` (seconds) — platform (Vercel) reads it from build output. Put it on the Eve/AI route (NFR-5 10 s timeout means ~15–30 s is plenty). For Server Actions, set `maxDuration` on the **page** that uses them.
  - With `cacheComponents: true`, `dynamic`, `dynamicParams`, `revalidate`, `fetchCache` are removed (index.md v16 row).
- `use cache` cannot be used directly in a route handler body; extract to a helper (15-route-handlers.md).

---

## 4. Server Actions / Server Functions

Source: `03-api-reference/01-directives/use-server.md`, `02-guides/server-actions.md`,
`01-getting-started/07-mutating-data.md`, `05-config/01-next-config-js/serverActions.md`,
`maxDuration.md`.

- `'use server'` at top of a file (e.g. `src/app/actions.ts`) makes every export a Server Function; or inline at the top of an `async function` inside a Server Component. Client components must import from a `'use server'` file.
- Invoked via `<form action={fn}>`, `useActionState`, or plain event handlers (`startTransition`). Return only serialisable data.
- Security: authenticate **inside** each action (`const { userId } = await auth()`), never trust client ids (matches FR-5). Proxy coverage can silently vanish (section 1).
- Config: `experimental.serverActions.bodySizeLimit` (default 1mb; accepts `'2mb'`), `allowedOrigins`.
- For this app most mutations go through Convex mutations from the client, so Server Actions are mainly for Eve/AI orchestration if not done as a route handler.

---

## 5. `next/dynamic` and `ssr: false` (R3F Canvas, 2D/3D board, Stockfish UI)

Source: `02-guides/lazy-loading.md`.

- `dynamic(() => import('./X'), { ssr: false, loading: () => <Skeleton/> })`.
- **`ssr: false` only works inside a Client Component.** Using it in a Server Component errors: "`ssr: false` is not allowed with `next/dynamic` in Server Components. Please move it into a Client Component." Pattern:

```tsx
// src/components/board/board-loader.tsx
'use client'
import dynamic from 'next/dynamic'
export const Board3D = dynamic(() => import('./board-3d').then(m => m.Board3D), {
  ssr: false,
  loading: () => <div className="aspect-square animate-pulse rounded-xl bg-muted" />,
})
```
Then render `<Board3D />` from the server page. The `import()` path must be a literal, and `dynamic()` must be called at module top level (not inside render). Named exports: `.then(m => m.Named)`.
- For NFR-2a (preload 3D in the background) call `import('./board-3d')` in a `useEffect` after mount or use the same dynamic module; Turbopack code-splits it.

---

## 6. Metadata API

Source: `01-getting-started/14-metadata-and-og-images.md`, `04-functions/generate-metadata.md`.

- Static: `export const metadata: Metadata = { title: { default: '3D Chess', template: '%s · 3D Chess' }, description }` in layouts/pages (server files only).
- Dynamic: `export async function generateMetadata({ params }: PageProps<'/profile/[username]'>, parent: ResolvingMetadata): Promise<Metadata>` — `await params`. Streams since v15.2.
- `themeColor`, `colorScheme`, `viewport` inside `metadata` are **deprecated since v14** — use `export const viewport: Viewport = { themeColor: [...] }` (`import type { Viewport } from 'next'`).
- File conventions: `app/icon.png|svg`, `app/opengraph-image.tsx` (`ImageResponse` from `next/og`), `app/manifest.ts`, `robots.ts`, `sitemap.ts`. In v16 the `params` of icon/opengraph-image generators and `sitemap` `id` are async (upgrade guide).

---

## 7. `next.config.ts` options this app needs

Source: `05-config/01-next-config-js/{headers,images,reactCompiler,typedRoutes,transpilePackages,cacheComponents,turbopack,turbopackRustReactCompiler}.md`, `02-components/image.md`, `08-turbopack.md`, `config-shared.d.ts`.

```ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactCompiler: true,          // already set; stable in 16; needs babel-plugin-react-compiler (installed 1.0.0)
  typedRoutes: true,            // OPTIONAL: turns on typed <Link href> (writes .next/types/link.d.ts)
  images: {
    remotePatterns: [new URL('https://img.clerk.com/**')],   // Clerk avatars; URL form is documented
    // or: [{ protocol: 'https', hostname: 'img.clerk.com', pathname: '/**' }]
  },
  async headers() {
    return [
      {
        // ONLY if you ship the multi-threaded Stockfish build (needs SharedArrayBuffer)
        source: '/stockfish/:path*',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
        ],
      },
    ]
  },
}
export default nextConfig
```

Notes:
- `headers()` entries: `{ source, headers: [{key,value}], has?, missing?, basePath?, locale? }`; checked before filesystem/`public`; later matches override earlier ones for the same key. **COOP/COEP must be on the HTML document that creates the worker (the `/game/[id]` page), not just the worker script**, for `SharedArrayBuffer` to exist — cross-origin isolation is a document property. That header on the game page will break any non-CORP third-party subresources (Clerk images, HDRIs from other origins) unless they send CORP/CORS headers; so default to the **single-threaded** Stockfish build and skip COOP/COEP (see section 8).
- `images.remotePatterns` accepts `URL` objects or `{protocol, hostname, port, pathname, search}`; omitted fields imply `**`. `images.domains` is deprecated in 16. `<img>` triggers `@next/next/no-img-element` (warn) — use `next/image` for Clerk avatars, or shadcn `AvatarImage` (plain `<img>` under Base UI; add an eslint-disable comment or accept the warning).
- `reactCompiler` accepts `true` or `{ compilationMode: 'annotation' }`; opt a component out with the `'use no memo'` directive (useful for R3F `useFrame` code that mutates refs each frame). Experimental faster path: `experimental.turbopackRustReactCompiler: true`.
- `transpilePackages: ['pkg']` — only for `node_modules` packages shipping raw TS/JSX; not needed for three/drei/fiber (they ship JS). Cannot combine with `serverExternalPackages` for the same package.
- **`webpack()` config is ignored under Turbopack** (default bundler in 16). Use `turbopack: { resolveAlias, resolveExtensions, rules }` if needed. `next dev --webpack` / `next build --webpack` opt out.
- `cacheComponents: true` enables `'use cache'`, `cacheLife`, `cacheTag` and PPR; requires Node runtime and removes `dynamic/revalidate/fetchCache` segment configs. **Not needed for v1** (all live data is Convex subscriptions). Leave it off unless a static landing/leaderboard shell is wanted later.
- `experimental.ppr`, `experimental_ppr`, `experimental.dynamicIO`, `experimental.useCache`, `next lint`, the `eslint` config key, AMP, and runtime config (`publicRuntimeConfig`) are removed in 16.

---

## 8. Web Workers under Turbopack (Stockfish)

Sources: `08-turbopack.md` (Magic Comments: "work with … `new Worker()` expressions"; config table `turbopackWorkerAssetPrefix`: "Custom asset prefix for Web Worker URLs (entrypoint + module chunks)"), context7 `/vercel/next.js` (e2e test `test/e2e/app-dir/worker/app/module/page.js`; runtime helper `turbopack-ecmascript/js/src/worker/browser/createWorker.ts`), `node_modules/stockfish/README.md` and `bin/`.

- Turbopack **does** bundle `new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })` from a `'use client'` component: the worker becomes its own chunk group. Gotcha: the runtime helper **strips `type: 'module'`** and loads worker chunks via `importScripts()`, so the worker entry is a classic script — top-level `import` statements are fine (bundled), but don't rely on ESM-only worker semantics (`import.meta.url` inside the worker, dynamic `import()` of non-bundled URLs).
- Installed `stockfish@18.0.8` ships in `node_modules/stockfish/bin/`:
  - `stockfish-18-lite-single.js` (21 KB) + `stockfish-18-lite-single.wasm` (7.3 MB) — **single-threaded lite, no COOP/COEP needed; the README's recommended default.**
  - `stockfish-18-lite.js` + `.wasm` (7.1 MB) — multi-threaded lite, **needs cross-origin isolation** (COOP/COEP).
  - `stockfish-18-single.*` / `stockfish-18.*` — full NNUE, ~113 MB each; not for the browser.
  - `stockfish-18-asm.js` — 10.5 MB asm.js fallback.
  - `index.js` is a Node loader (`initEngine(enginePath?, cb?)`); `bin/stockfish.js`/`.wasm` are tiny stubs.
- The `bin/*.js` files are already written to run **as the worker script itself** (they set `onmessage`, call `postMessage`, detect `importScripts`), and locate the `.wasm` from `self.location` (script URL) with an override via URL hash (`#<wasmUrl>,worker`). Simplest, Turbopack-proof approach: copy `stockfish-18-lite-single.js` + `.wasm` to `public/stockfish/` (postinstall or checked in) and `new Worker('/stockfish/stockfish-18-lite-single.js')` from a client module — no bundler involvement, satisfies NFR-3 (lazy, AI mode only). Note the 7.3 MB wasm exceeds the "under 2 MB gzipped" wish in NFR-3 — flag to the Stockfish agent.
- Use the multi-threaded build only if you accept COOP/COEP on the game page (section 7). `pnpm-workspace.yaml` already allows the `stockfish` build script.

---

## 9. CLI / dev server

Source: `03-api-reference/06-cli/next.md`, `version-16.md`.

- `next dev` (Turbopack default): `-p/--port`, `-H/--hostname`, `--experimental-https` (self-signed cert; handy for Clerk/webhooks), `--webpack` to opt out, `--turbopack`/`--turbo` (no-op, default). Output dir `.next/dev`.
- `next build`: `--webpack`, `--debug-build-paths="app/game/**/page.tsx"` to build a subset, `--debug-prerender`.
- `next typegen [dir]`, `next upgrade`, `next experimental-analyze` (bundle analyzer, port 4000), `next info`. **`next lint` is removed** — `pnpm lint` runs plain `eslint`.

---

## 10. ESLint 9 flat config — rules that will bite

Source: `05-config/03-eslint.md`, installed `eslint-config-next@16.3.4` (`dist/index.js` merges `eslint-plugin-react` recommended + `eslint-plugin-react-hooks@7.1.1` **`configs.recommended`** + `@next/eslint-plugin-next` recommended; `core-web-vitals.js` appends the plugin's `core-web-vitals` overrides), `typescript-eslint ^8.46`.

`react-hooks` 7.1.1 recommended (verified via `require('eslint-plugin-react-hooks').configs.recommended.rules`) enables the React-Compiler lint rules, all **error** unless noted:
`rules-of-hooks`, `exhaustive-deps` (warn), `static-components`, `use-memo`, `preserve-manual-memoization`, `incompatible-library` (warn), `immutability`, `globals`, `refs`, `set-state-in-effect`, `error-boundaries`, `purity`, `set-state-in-render`, `unsupported-syntax` (warn), `config`, `gating`.

Practical consequences for R3F/three/zustand code:
- `react-hooks/refs`: reading/writing `ref.current` during render is an error — do it in `useFrame`/effects/handlers.
- `react-hooks/immutability`: mutating props/state objects (e.g. `mesh.position.set` on an object from state during render) errors; mutate inside `useFrame`/effects.
- `react-hooks/set-state-in-effect`: calling `setState` synchronously in `useEffect` body errors — derive state or use event handlers / `useSyncExternalStore` / zustand selectors.
- `react-hooks/purity`: `Math.random()`/`Date.now()` during render errors.
- `@next/next/no-img-element` is **warn** (core-web-vitals list), `no-html-link-for-pages` and `no-sync-scripts` are **error**; `no-async-client-component` warn.
- `react-hooks/exhaustive-deps` is warn. Disable per line with `// eslint-disable-next-line react-hooks/<rule>`; per component opt out of the compiler with `'use no memo'`.

---

## 11. Tailwind v4 conventions in this scaffold

Source: `src/app/globals.css`, `01-getting-started/11-css.md`, tailwindcss docs (WebFetch `tailwindcss.com/docs/dark-mode`), `node_modules/shadcn/dist/tailwind.css`.

- Installed Tailwind **4.3.3** via `@tailwindcss/postcss` (no `tailwind.config.*`; `components.json` has `tailwind.config: ""`). CSS-first config.
- `globals.css` top: `@import "tailwindcss"; @import "tw-animate-css"; @import "shadcn/tailwind.css";`
  - `shadcn/tailwind.css` (package export `./tailwind.css` -> `dist/tailwind.css`) defines Base-UI-aware variants used by the generated components: `data-open`, `data-closed`, `data-checked`, `data-unchecked`, `data-selected`, `data-disabled`, `data-active`, `data-horizontal`, `data-vertical`, plus `accordion-down/up` keyframes, `no-scrollbar` utility, scroll-fade properties. Keep this import.
  - `tw-animate-css` provides `animate-in/out`, `fade-in-0`, `zoom-in-95`, etc. used by dialog/sheet.
- Dark mode: `@custom-variant dark (&:is(.dark *));` — **class strategy** (Tailwind docs show `&:where(.dark, .dark *)`; the scaffold's `&:is(.dark *)` is equivalent for descendants). Toggle by putting `class="dark"` on `<html>`. `next-themes@0.4.6` is installed (pulled in by the sonner component): wrap the app in `<ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>` from `next-themes` (props verified in `dist/index.d.ts`) and add `suppressHydrationWarning` to `<html>`. `useTheme()` is exported (used by `sonner.tsx`).
- Tokens: `@theme inline { --color-background: var(--background); … --radius-sm…4xl derived from --radius; --font-sans: var(--font-sans); --font-mono: var(--font-geist-mono); --font-heading: var(--font-sans) }`; `:root` and `.dark` define the oklch palette (`--background`, `--foreground`, `--card`, `--popover`, `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--border`, `--input`, `--ring`, `--chart-1..5`, `--sidebar*`, `--radius: 0.625rem`). Utilities: `bg-background`, `text-muted-foreground`, `border-border`, `rounded-lg` (= `--radius`), etc. Add app tokens (e.g. `--board-light`, `--board-dark`) the same way: define in `:root`/`.dark`, expose via `@theme inline { --color-board-light: var(--board-light) }`.
- `@layer base { * { @apply border-border outline-ring/50 } body { @apply bg-background text-foreground } html { @apply font-sans } }`.
- **Font wiring gotcha (observed, not yet fixed):** `layout.tsx` exposes `--font-geist-sans`, but `@theme inline` maps `--font-sans: var(--font-sans)` (self-reference) and `--font-heading: var(--font-sans)`; only `--font-mono` points at `--font-geist-mono`. Geist Sans is therefore probably not applied. Fix: change to `--font-sans: var(--font-geist-sans);` (or rename the font variable to `--font-sans` in `layout.tsx`).
- `cn()` comes from the `cn` package (`import { cn } from "cn"` inside ui files; `@/lib/utils` re-exports it). API: `cn(...inputs: ClassValue[])` = clsx-style args + tailwind-merge conflict resolution; also exports `twMerge`, `clsx`, `twJoin`, `createEngine` (`node_modules/cn/dist/index.d.ts`).

---

## 12. shadcn/ui as initialised here (Base UI, "base-nova")

Source: `components.json`, `node_modules/shadcn` (4.21.0, `dist/index.js add --help`, dry-run), `src/components/ui/*.tsx`, `node_modules/@base-ui/react` d.ts, shadcn docs (WebFetch `ui.shadcn.com/docs/components/base/button`, `/base/dialog`), Base UI handbook (WebFetch `base-ui.com/react/handbook/composition`).

- Preset: `style: "base-nova"` = **Base UI primitives (`@base-ui/react` 1.8.0), not Radix**. Every component imports `@base-ui/react/<part>` (e.g. `@base-ui/react/dialog`, `/menu`, `/select`, `/tabs`, `/tooltip`, `/slider`, `/switch`, `/toggle-group`, `/radio-group`, `/scroll-area`, `/progress`, `/avatar`, `/popover`, `/alert-dialog`, `/drawer`, `/input`, `/separator`, `/button`, `/merge-props`, `/use-render`). Sheet is built on `@base-ui/react/dialog`; Drawer on `@base-ui/react/drawer` (no `vaul`). No Radix packages are installed — do not paste Radix-era shadcn snippets.
- Add command (CLI 4.21.0): `pnpm dlx shadcn@latest add <items...>`; flags `-y/--yes`, `-o/--overwrite`, `-c/--cwd`, `-a/--all`, `-p/--path`, `-s/--silent`, `--dry-run`, `--diff [path]`, `--view [path]`. Dry-run of the full list `button card dialog alert-dialog drawer sheet tabs table badge avatar select slider switch toggle toggle-group tooltip dropdown-menu input label separator scroll-area skeleton sonner progress popover radio-group` resolved to 26 files (all already present, "skip (identical)") and 4 npm deps: `cn`, `@base-ui/react`, `sonner`, `next-themes` — **all four are already in `package.json`**. Nothing else to install for these components. Other candidates if needed later: `command`, `accordion`, `checkbox`, `textarea`, `form`/`field`, `sidebar`, `chart` (chart pulls `recharts`).
- Exports available (verified from the files):
  - `button`: `Button`, `buttonVariants`; variants `default | outline | secondary | ghost | destructive | link`; sizes `default | xs | sm | lg | icon | icon-xs | icon-sm | icon-lg`. Props = `ButtonPrimitive.Props & VariantProps`.
  - `dialog`: `Dialog, DialogTrigger, DialogPortal, DialogClose, DialogOverlay, DialogContent (prop showCloseButton?: boolean, default true), DialogHeader, DialogFooter, DialogTitle, DialogDescription`.
  - `alert-dialog`: `AlertDialog, AlertDialogTrigger, AlertDialogPortal, AlertDialogOverlay, AlertDialogContent, AlertDialogHeader, AlertDialogFooter, AlertDialogTitle, AlertDialogDescription, AlertDialogMedia, AlertDialogAction, AlertDialogCancel`.
  - `sheet`: `Sheet, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription`.
  - `drawer`: `Drawer, DrawerPortal, DrawerOverlay, DrawerSwipeHandle, DrawerTrigger, DrawerClose, DrawerContent, DrawerHeader, DrawerFooter, DrawerTitle, DrawerDescription` (use for NFR-6 mobile history panel).
  - `dropdown-menu`: `DropdownMenu, DropdownMenuPortal, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuItem, DropdownMenuCheckboxItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent`.
  - `select`: `Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectLabel, SelectItem, SelectSeparator, SelectScrollUpButton, SelectScrollDownButton`.
  - `tabs`: `Tabs, TabsList (variant default|line), TabsTrigger, TabsContent, tabsListVariants`. `tooltip`: `TooltipProvider, Tooltip, TooltipTrigger, TooltipContent (side, sideOffset, align, alignOffset)`. `popover`: `Popover, PopoverTrigger, PopoverContent, PopoverHeader, PopoverTitle, PopoverDescription`.
  - `card`: `Card, CardHeader, CardTitle, CardDescription, CardAction, CardContent, CardFooter`. `table`: `Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption`. `avatar`: `Avatar, AvatarImage, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarBadge`. `progress`: `Progress, ProgressTrack, ProgressIndicator, ProgressLabel, ProgressValue`.
  - Singles: `Badge, badgeVariants`, `Input`, `Label`, `Separator`, `Skeleton`, `Slider`, `Switch`, `Toggle, toggleVariants`, `ToggleGroup, ToggleGroupItem`, `RadioGroup, RadioGroupItem`, `ScrollArea, ScrollBar`, `Toaster` (sonner).
- **Base UI API differences vs Radix (verified in `@base-ui/react` d.ts):**
  - No `asChild`. Composition uses the **`render` prop**: `render={<Link href="/play" />}` or `render={(props, state) => <span {...props}/>}`; the custom component must forward `ref` and spread props. For a trigger that should look like a button: `<DialogTrigger render={<Button variant="outline" />}>Open</DialogTrigger>`. shadcn's Button page explicitly says **do not** do `<Button render={<a />} nativeButton={false} />` for links — use `<Link className={buttonVariants({ variant })} href="…">` instead.
  - Change handlers receive `(value, eventDetails)`: `Dialog onOpenChange(open: boolean, details)`, `Select onValueChange(value, details)` (plus `items`, `multiple`), `Tabs onValueChange(value, details)`, `Slider onValueChange(value | number[], details)` and `onValueCommitted`, `Switch onCheckedChange(checked, details)`, `ToggleGroup value: readonly Value[]`, `onValueChange(groupValue: Value[], details)`, `multiple?: boolean`. Radix names like `onCheckedChange` match; `Select`'s `SelectValue` renders the selected item; `Slider` `value` may be a number or array (shadcn wrapper renders one thumb per value).
  - State attributes are `data-open`/`data-closed`/`data-checked`/… (hence `shadcn/tailwind.css` variants), not only `data-state="open"`.
  - `TooltipProvider` accepts `delay` (default 0 in the wrapper).
- Sonner: put `<Toaster />` (from `@/components/ui/sonner`, a `'use client'` file that reads `useTheme()` from `next-themes`) once in `src/app/layout.tsx` inside `<body>`; fire toasts anywhere with `import { toast } from 'sonner'` — `toast('msg')`, `toast.success/error/info/warning/loading/promise(...)` (sonner 2.0.8 exports `Toaster, toast, useSonner`). Because `sonner.tsx` calls `useTheme()`, wrap with next-themes' `ThemeProvider` or the theme will just be `"system"`.
- `"use client"` is already at the top of the interactive ui files; server pages can import and render them directly.

---

## 13. Suggested routing skeleton (from requirements §6, all App Router)

```
src/app/layout.tsx                 ClerkProvider inside <body>, ThemeProvider, <Toaster/>
src/app/page.tsx                   / landing (public)
src/app/leaderboard/page.tsx       public
src/app/sign-in/[[...sign-in]]/page.tsx, src/app/sign-up/[[...sign-up]]/page.tsx  (Clerk catch-all convention — verify in Clerk doc)
src/app/(protected)/layout.tsx     await auth.protect()  -> covers /play, /settings, /game/[id], /profile/[username]
src/app/(protected)/play/page.tsx
src/app/(protected)/settings/page.tsx
src/app/(protected)/game/[id]/page.tsx        PageProps<'/game/[id]'>
src/app/(protected)/profile/[username]/page.tsx
src/app/api/ai/move/route.ts       Eve route handler, export const maxDuration = 30
src/proxy.ts                       clerkMiddleware() + matcher (section 1)
public/stockfish/…                 worker + wasm (section 8)
```
Route groups `(protected)` don't affect URLs. Parallel-route slots (`@modal`) now **require `default.tsx`** or the build fails (v16 upgrade guide).

---

## Unverified / open questions

1. Whether cross-origin isolation (COOP/COEP) breaks Clerk's hosted assets/iframes on the game page was not tested — reason to stay on the single-threaded Stockfish build. The COOP/COEP-on-document requirement is standard web-platform behaviour, not from the Next docs.
2. Turbopack worker bundling was verified via context7 (Next.js e2e test + runtime helper source), not by running a build in this repo. If you choose the bundled-worker path, smoke-test `new Worker(new URL('./stockfish.worker.ts', import.meta.url))` in `next dev` and `next build` before relying on it; the `public/` path needs no such test.
3. The `--font-sans: var(--font-sans)` self-reference in `globals.css` looks like a shadcn-init artefact; I did not render the page to confirm Geist is missing. Fix is one line either way.
4. Clerk sign-in/sign-up catch-all folder naming (`[[...sign-in]]`) and `auth.protect()` in a layout are Clerk-doc conventions to be confirmed by the Clerk research doc; only `clerkMiddleware`, `auth`, `createRouteMatcher` deprecation and the proxy matcher were verified here.
5. `typedRoutes: true` was not enabled/run in this repo; the behaviour (writes `.next/types/link.d.ts`) is from Next source `route-types-utils.js`, the `as Route` cast requirement from `02-typescript.md`.
6. The exact `@next/eslint-plugin-next` rule `no-location-assign-relative-destination` (present in the installed core-web-vitals set) is not in the bundled docs table; treat as a warn-level rule.
7. `next-themes` `ThemeProvider` export name was inferred from its d.ts props block (`attribute`, `defaultTheme`, `enableSystem`, `disableTransitionOnChange`) and sonner's `useTheme` import; the component name itself was not grepped.
