# Clerk setup for 3D Chess (development instance) — research + applied config

Written 2026-09-09 by the docs-research agent. Everything below was verified against the
installed packages, the live Clerk instance via `clerk` CLI **v3.3.0**, or official docs.
Source of each claim is noted inline. Nothing here is from memory.

## 0. Identity of the Clerk app (all non-secret)

| Item | Value | Verified by |
|---|---|---|
| Application | `3D Chess` — `app_3J5VGXoZZaRlVFCeRLGD4tvZ1Li` | `clerk doctor --json` |
| Development instance | `ins_3J5VGTMJ9B0ILvhD1P0P0mDXpHV` (`environment_type: development`) | `clerk api /instance` |
| Production instance | **not created** (`Prod instance: (not set)`) | `clerk doctor --json` |
| Publishable key | `pk_test_Zmxvd2luZy13aWxkY2F0LTE0MDEuY2xlcmsuYWNjb3VudHMuZGV2JA` | `.env.local` |
| Frontend API / JWT issuer domain | `https://flowing-wildcat-1401.clerk.accounts.dev` | base64-decode of pk (`flowing-wildcat-1401.clerk.accounts.dev$`), `GET /.well-known/openid-configuration` → `"issuer":"https://flowing-wildcat-1401.clerk.accounts.dev"`, `GET /.well-known/jwks.json` → HTTP 200 with one RS256 key whose `kid` = `ins_3J5VGTMJ9B0ILvhD1P0P0mDXpHV`, and the `iss` claim of a token minted from the template (section 3) |
| Hosted Account Portal (dev) | `https://flowing-wildcat-1401.accounts.dev/sign-in`, `/sign-up` | FAPI `GET /v1/environment` → `display_config` |
| Convex JWT template | name `convex`, id `jtmp_3J5WhMRDDwh8FuS83KACkOHJV3H` | `clerk api /jwt_templates` |
| Users in dev instance | 0 (a throwaway verification user was created and deleted) | `clerk api /users/count` |

`CLERK_JWT_ISSUER_DOMAIN=https://flowing-wildcat-1401.clerk.accounts.dev` — this is **not a secret** (it is
derivable from the publishable key) and it is the value the Convex deployment needs.

## 1. How the CLI was driven (for reproducibility)

- Binary: `clerk` 3.3.0 at `~/.nvm/versions/node/v24.14.1/bin/clerk`. The skill at
  `~/.claude/skills/clerk-cli/SKILL.md` is pinned to 1.4.0 and is stale in one respect: v3.3.0 has
  extra top-level commands (`enable`, `disable`, `deploy`, `impersonate`, `mcp`, `webhooks`, `telemetry`).
  `clerk enable/disable` only cover `orgs` and `billing` — **not** social providers or usernames; those
  are done via `clerk config patch`.
- Ran with `CLERK_MODE=agent` and explicit `--app app_3J5VGXoZZaRlVFCeRLGD4tvZ1Li --instance ins_3J5VGTMJ9B0ILvhD1P0P0mDXpHV` (or `--instance dev`) on every mutating call.
- `clerk doctor --json`: all checks pass except two `warn`s (no production instance; zsh completion not installed).
- Instance config surface: `clerk config schema` (73 KB JSON Schema; top-level keys include `auth_email`,
  `auth_password`, `auth_username`, `auth_passkey`, `auth_phone`, `auth_multi_factor`, `auth_web3`,
  `connection_oauth_google`, `connection_oauth_github`, `connection_oauth_*` (30+ providers),
  `connections_oauth_custom`, `user_model`, `paths`, `session`, `session_settings`, `organization_settings`,
  `branding`, `billing`, `compliance`, `auth_attack_protection`, `auth_access_control`).
- Backend API discovery: `clerk api ls jwt_templates` → `GET/POST /jwt_templates`, `GET/PATCH/DELETE /jwt_templates/{template_id}`.
  `clerk api ls instance` → `GET /instance`, `PATCH /instance`, `/instance/organization_settings`, `/instance/restrictions`, `/jwks`, `/domains`, etc.
  `clerk api ls sessions` → `POST /sessions` (create active session), `POST /sessions/{id}/tokens/{template_name}` (mint from template).
- Gotcha: `clerk api --fapi /environment --app ... --instance dev` **hung indefinitely** in agent mode (had to be killed).
  Use plain `curl https://flowing-wildcat-1401.clerk.accounts.dev/v1/environment` instead — it is a public,
  unauthenticated endpoint and returns the same `user_settings` / `display_config` payload.

## 2. Sign-in methods + username — what was changed

### Schema keys used (from `clerk config schema`)

```jsonc
// auth_email
{ "used_for_sign_in": bool, "used_for_sign_up": bool, "required_for_sign_up": bool,
  "verify_at_sign_up": bool, "sign_in_strategies": ["email_code"|"email_link"],
  "verification_strategies": ["email_code"|"email_link"], "immutable": bool }
// auth_password
{ "enabled": bool, "required": bool, "min_length": int (8-72, default 15), "max_length": int,
  "min_zxcvbn_strength": 0-4, "require_*": bool, "disable_hibp": bool, "enforce_hibp_on_sign_in": bool,
  "device_trust": { "enabled": bool } }
// auth_username
{ "used_for_sign_up": bool, "used_for_sign_in": bool, "required_for_sign_up": bool,
  "min_length": int (1-64, default 4), "max_length": int (1-64, default 64), "immutable": bool,
  "allow_numeric_usernames": bool, "allow_extended_special_characters": bool }
// connection_oauth_google / connection_oauth_github
{ "enabled": bool, "authenticatable": bool, "client_id": string, "client_secret": string,
  "block_email_subaddresses": bool, /* google only: */ "show_account_selector_prompt": bool }
// user_model
{ "first_name": { "enabled": bool, "required": bool }, "last_name": { "enabled": bool, "required": bool } }
// paths  (all strings matching ^(/|\?|#|$))
{ "sign_in", "sign_up", "home", "after_sign_out_all", "unauthorized_sign_in", "waitlist", "oauth_consent" }
```

The schema descriptions for `client_id`/`client_secret` on Google and GitHub say verbatim:
*"not required in development — Clerk provides shared credentials"*. So on the dev instance
`{"enabled": true}` is sufficient; **production will require real OAuth client credentials**.

### State BEFORE (from `clerk config pull --keys ...`)

- `auth_email`: used for sign-in and sign-up, required, `sign_in_strategies: ["email_code"]`, verify at sign-up.
- `auth_password`: `enabled: true`, `required: true`, `min_length: 15`, HIBP on.
- `connection_oauth_google`: `enabled: true` (dev shared creds), `block_email_subaddresses: true`.
- `connection_oauth_github`: `enabled: false`.
- `auth_username`: all `false` (usernames not collected at all).
- `user_model.first_name/last_name`: `enabled: false` (names are NOT collected).

### Patch applied (dry-run first, then `--yes`)

File `patch-auth.json`:

```json
{
  "connection_oauth_google": { "enabled": true, "authenticatable": true },
  "connection_oauth_github": { "enabled": true, "authenticatable": true },
  "auth_username": {
    "used_for_sign_up": true,
    "used_for_sign_in": true,
    "required_for_sign_up": true,
    "min_length": 3,
    "max_length": 20
  }
}
```

```sh
clerk config patch --app app_3J5VGXoZZaRlVFCeRLGD4tvZ1Li --instance ins_3J5VGTMJ9B0ILvhD1P0P0mDXpHV --file patch-auth.json --dry-run
clerk config patch --app app_3J5VGXoZZaRlVFCeRLGD4tvZ1Li --instance ins_3J5VGTMJ9B0ILvhD1P0P0mDXpHV --file patch-auth.json --yes
# -> "Config pushed successfully", config_version v1_694ccca7
```

Diff reported by the CLI: `connection_oauth_github.enabled false→true`; `auth_username.used_for_sign_up/used_for_sign_in/required_for_sign_up false→true`; `min_length 4→3`; `max_length 64→20`. Email + password settings were left untouched (already enabled).

### State AFTER — verified two ways

`clerk config pull` after the patch returns exactly the "after" block above. The public FAPI payload
(`curl https://flowing-wildcat-1401.clerk.accounts.dev/v1/environment`) now reports:

```jsonc
user_settings.attributes (enabled only):
  email_address: { required: true, used_for_first_factor: true, first_factors: ["email_code"] }
  username:      { required: true, used_for_first_factor: true }
  password:      { required: true }
user_settings.social: oauth_google {enabled:true}, oauth_github {enabled:true}
user_settings.username_settings: { min_length: 3, max_length: 20, allow_numeric_usernames: false, allow_extended_special_characters: false }
user_settings.sign_up: { progressive: true, mode: "public", captcha_enabled: true, legal_consent_enabled: false }
```

### Resulting sign-in / sign-up experience (UI implications)

- **Sign-up form (`<SignUp/>`)** will render: Google button, GitHub button, **Username (required)**,
  Email (required, verified by 6-digit code), Password (required, min 15 chars, HIBP-checked). First/last name are not collected.
- **Sign-in (`<SignIn/>`)**: identifier field accepts **email or username** (`username.used_for_first_factor: true`), then password; email-code is also an available first factor. Plus Google/GitHub buttons.
- **OAuth sign-ups still get a username**: `sign_up.progressive: true` + `username.required: true` means after a Google/GitHub OAuth round-trip Clerk shows a "continue" step collecting any missing required fields (username). `<SignUp/>` handles this automatically as long as the app routes `/sign-up/[[...sign-up]]` (catch-all) so the `/sign-up/continue` step can render. **Every user will therefore have a non-null `username`**; a derived-username fallback in Convex is only defensive.
- Password policy is the dashboard default (`min_length: 15`). If that is considered too strict for a game, lower via `clerk config patch --json '{"auth_password":{"min_length":8}}'` (schema: valid explicit values 8–72). Not changed.
- Test accounts on dev: emails with `+clerk_test` (e.g. `alice+clerk_test@example.com`) verify with OTP `424242` and do not send real mail (skill `references/recipes.md`). Verified working: the throwaway user in section 3 used such an email and its token showed `email_verified: true`.

## 3. JWT template `convex`

### Why the name must be exactly `convex`

Installed `convex@1.45.0`, file `node_modules/convex/dist/esm/react-clerk/ConvexProviderWithClerk.js` lines 29-35:
`getToken({ template: "convex", skipCache: forceRefreshToken })`. The provider hard-codes the template name.
Convex docs (`docs.convex.dev/auth/debug`): *"For Clerk, specifically verify that the JWT token is named 'convex'."*
Convex `auth.config.ts` matches `applicationID` against the token's `aud` claim and `domain` against `iss`
(`docs.convex.dev/auth/advanced/custom-auth`: *"The `applicationID` property must exactly match the `aud` field of your JWT and the `domain` property must exactly match the `iss` field"*).

### Request body fields for `POST /jwt_templates`

From installed `@clerk/backend@3.17.1` `dist/api/endpoints/JwtTemplatesApi.d.ts` (`CreateJWTTemplateParams`), snake_cased for the raw API:
`name: string` (required), `claims: object` (required), `lifetime?: number` (seconds; docs default 60),
`allowed_clock_skew?: number` (seconds; docs default 5), `custom_signing_key?: boolean`,
`signing_algorithm?: string`, `signing_key?: string`.
Response object (`JwtTemplate`): `id, name, claims, lifetime, allowed_clock_skew, custom_signing_key, signing_algorithm, created_at, updated_at`.
Clerk docs (`clerk.com/docs/guides/sessions/jwt-templates`): default claims `azp, exp, iat, iss, jti, nbf, sub` are always added and cannot be overridden; session-only claims `sid, v, pla, fea` cannot be included in template tokens.

### Claims used

Base = the Convex-recommended claim set (Convex docs / Clerk "Convex" preset:
`aud, email, picture, given_name, updated_at, family_name, email_verified`) **plus** `name: {{user.full_name}}`
and `nickname: {{user.username}}` so the username reaches Convex as `identity.nickname`.

```json
{
  "name": "convex",
  "claims": {
    "aud": "convex",
    "name": "{{user.full_name}}",
    "nickname": "{{user.username}}",
    "given_name": "{{user.first_name}}",
    "family_name": "{{user.last_name}}",
    "email": "{{user.primary_email_address}}",
    "email_verified": "{{user.email_verified}}",
    "picture": "{{user.image_url}}",
    "updated_at": "{{user.updated_at}}"
  },
  "lifetime": 60,
  "allowed_clock_skew": 5
}
```

```sh
clerk api /jwt_templates --app app_3J5VGXoZZaRlVFCeRLGD4tvZ1Li --instance dev --file jwt-convex.json --dry-run
clerk api /jwt_templates --app app_3J5VGXoZZaRlVFCeRLGD4tvZ1Li --instance dev --file jwt-convex.json --yes
# -> {"object":"jwt_template","id":"jtmp_3J5WhMRDDwh8FuS83KACkOHJV3H","name":"convex", ... "lifetime":60,"allowed_clock_skew":5,"custom_signing_key":false,"signing_algorithm":"RS256"}
clerk api /jwt_templates --app app_3J5VGXoZZaRlVFCeRLGD4tvZ1Li --instance dev
# -> exactly one template: convex / jtmp_3J5WhMRDDwh8FuS83KACkOHJV3H
```

### End-to-end token proof

Created a throwaway dev user (`username: jwtcheck`, `jwtcheck+clerk_test@example.com`), `POST /sessions`,
then `POST /sessions/{sid}/tokens/convex`. Decoded payload (secrets omitted):

```json
{"aud":"convex","iss":"https://flowing-wildcat-1401.clerk.accounts.dev","sub":"user_3J5W…",
 "nickname":"jwtcheck","email":"jwtcheck+clerk_test@example.com","email_verified":true,
 "name":null,"given_name":null,"family_name":null,"picture":"https://img.clerk.com/…",
 "updated_at":1788951567,"iat":…,"nbf":iat-5,"exp":iat+60,"jti":"…"}
```
Header: `{"alg":"RS256","kid":"ins_3J5VGTMJ9B0ILvhD1P0P0mDXpHV","typ":"JWT"}` — the `kid` matches the JWKS key.
Session revoked and user deleted afterwards (`/users/count` → 0).

Consequences for Convex code (installed `convex/dist/cjs-types/server/authentication.d.ts`, `interface UserIdentity`):
- `identity.subject` = Clerk `user_…` id → use as `players.clerkId`.
- `identity.nickname` = Clerk username (always set given `required_for_sign_up: true`).
- `identity.pictureUrl` = avatar (`picture` claim; Clerk always returns an image URL, default avatar if none uploaded).
- `identity.email`, `identity.emailVerified` available.
- `identity.name`, `givenName`, `familyName` will be **null** for email/password users because `user_model.first_name/last_name` are disabled; OAuth users may have them. Do not rely on `name`; use `nickname`.
- `identity.tokenIdentifier` = `"<issuer>|<subject>"` (always present per Convex docs).

## 4. Convex side — exactly what it needs

`convex/auth.config.ts` (verbatim from `docs.convex.dev/auth/clerk`; `AuthConfig` type verified in `convex/dist/cjs-types/server/authentication.d.ts`: `{ applicationID: string; domain: string }`):

```ts
import { AuthConfig } from "convex/server";

export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN!,
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
```

Convex deployment env var (set on the Convex dashboard or `npx convex env set`, per Convex docs "Configuring dev and prod instances"):

```
CLERK_JWT_ISSUER_DOMAIN=https://flowing-wildcat-1401.clerk.accounts.dev
```

Then `npx convex dev` syncs `auth.config.ts`. A production Clerk instance will have a different issuer
(`https://clerk.<your-domain>.com`), set separately on the Convex prod deployment.

Client wiring (Convex docs, Next.js section): `ConvexProviderWithClerk` from `"convex/react-clerk"` with
`client={convex}` and `useAuth={useAuth}` where `useAuth` is imported from `@clerk/nextjs`; the component must
be a client component and must sit **inside** `<ClerkProvider>`.

## 5. Next.js app env vars (`.env.local`)

`.env.local` currently contains (names only, values redacted): `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<set>`,
`CLERK_SECRET_KEY=<set>`, `VERCEL_OIDC_TOKEN=<set>` (Vercel CLI). `clerk doctor` confirms both Clerk keys belong to
the development instance. `.gitignore` line 34 is `.env*` → `git check-ignore -v .env.local` matches; **never committed**.

Env var names recognised by installed `@clerk/nextjs@7.9.1` (grep of `dist/`):

| Var | Purpose |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | required |
| `CLERK_SECRET_KEY` | required (server) |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` / `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | set to `/sign-in` and `/sign-up` for embedded `<SignIn/>`/`<SignUp/>` pages |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` / `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | e.g. `/play` — where to land when there is no `redirect_url` |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FORCE_REDIRECT_URL` / `NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL` | optional, overrides `redirect_url` |
| `NEXT_PUBLIC_CLERK_TELEMETRY_DISABLED` | optional |
| `NEXT_PUBLIC_CLERK_PROXY_URL`, `NEXT_PUBLIC_CLERK_DOMAIN`, `NEXT_PUBLIC_CLERK_IS_SATELLITE`, `CLERK_API_URL`, `CLERK_JS_URL`, `CLERK_UI_URL` | advanced — not needed |

Plus for Convex on the client: `NEXT_PUBLIC_CONVEX_URL` (Convex docs) — written by `npx convex dev`.

Recommended additions to `.env.local` (not applied by this agent):
```
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/play
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/play
```

`@clerk/nextjs/server` exports `clerkMiddleware` and `createRouteMatcher` (`dist/types/server/index.d.ts` lines 4, 18) for protecting `/play`, `/game/:id`, `/profile` (FR-4). In Next.js 16 the middleware file is `proxy.ts` (see the nextjs skill's file-conventions); Clerk's function is still `clerkMiddleware`.

## 6. Redirect / paths / allowed origins (instance side)

- `paths.*` on the instance config are all `null` (dashboard "Paths" for the hosted Account Portal). The FAPI
  `display_config` therefore points at the hosted `https://flowing-wildcat-1401.accounts.dev/sign-in|sign-up`
  and `/default-redirect`. For embedded components in the Next app these are overridden by the
  `NEXT_PUBLIC_CLERK_SIGN_IN_URL` / `_SIGN_UP_URL` / `_FALLBACK_REDIRECT_URL` env vars above, so **nothing needs to be set on the instance for dev**. If the team prefers instance-level defaults instead, they can be set with `clerk config patch --json '{"paths":{"sign_in":"/sign-in","sign_up":"/sign-up","home":"/"}}'` (verify semantics first — these are Account Portal paths, see open questions).
- `GET /instance` → `allowed_origins: null`, `allowed_subdomains: []`, `subdomain_allowlist_enabled: false`. Development instances accept `http://localhost:*`; nothing to configure. Allowed origins matter only for a production instance / non-standard hosts (`PATCH /instance` has an `allowed_origins` field per `clerk api ls instance`).
- Development instance limits (skill recipes): 100 emails/month, 20 SMS/month for non-test addresses; `+clerk_test` addresses are exempt.

## 7. Still to do when going to production (not done — no prod instance exists)

1. `clerk deploy` / dashboard → create the production instance and a `clerk.<domain>` CNAME.
2. Re-apply section 2's patch with `--instance prod`, **plus real** `client_id`/`client_secret` for Google and GitHub (`connection_oauth_google.client_id` must match `^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$`).
3. Re-create the `convex` JWT template on prod (templates are per-instance) with the same body.
4. Set `CLERK_JWT_ISSUER_DOMAIN=https://clerk.<domain>` on the Convex **prod** deployment and `pk_live_`/`sk_live_` keys in Vercel prod env.

## Unverified / open questions

- The exact claim set of Clerk's dashboard "Convex" preset template could not be fetched from a first-party page (Clerk's BAPI reference URLs returned 404 and the Convex/Clerk guides now describe a dashboard "Convex integration" toggle instead of showing claims). The claim set used is the one quoted in Convex's documentation via web search (`aud, email, picture, given_name, updated_at, family_name, email_verified`) plus `name`/`nickname`. The minted token proves all nine shortcodes resolve, so the template is functionally correct regardless.
- Whether the newer Clerk dashboard "Convex integration" auto-creates a template named `convex` was not checked; the template now exists either way, so re-running that dashboard flow could fail with a duplicate-name error — do not run it.
- `progressive: true` sign-up collecting the username after OAuth was inferred from the FAPI flags (`sign_up.progressive`, `username.required`) and Clerk's documented progressive sign-up behaviour; it was not exercised in a browser. Test once the `/sign-up/[[...sign-up]]` route exists.
- `paths.*` in the instance config are documented in the schema only as "Display config paths"; whether they also feed `<ClerkProvider>` defaults (in addition to Account Portal) was not confirmed. Prefer the `NEXT_PUBLIC_CLERK_*_URL` env vars, which are verified in the installed SDK.
- The `clerk api --fapi` hang may be an agent-mode bug in CLI 3.3.0; not investigated further.
- Password `min_length: 15` was left as-is; product owner may want to relax it.
