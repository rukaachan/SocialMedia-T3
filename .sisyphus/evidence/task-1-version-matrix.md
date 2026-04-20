# Task 1 — Cloudflare + Turso + Drizzle migration version matrix

Date: 2026-03-23

## Current baseline observed in repo

- `next`: `^13.5.11`
- `next-auth`: `^4.24.13`
- `@trpc/*`: `^11.14.1`
- `@tanstack/react-query`: `^5.95.0`
- `prisma` / `@prisma/client`: `^5.22.0`
- `typescript`: `^5.9.3`

## Locked execution targets

| Surface                  | Current baseline    | Locked target                                                               | Why this target is locked                                                                                                                                                                                                                                              | Official source URLs                                                                                                                                                                    |
| ------------------------ | ------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Next.js App Router       | `next@13.5.11`      | `next@16.2.1`                                                               | Next.js `16.x` is the only Active LTS line in current official support policy, and OpenNext Cloudflare officially supports all minor/patch versions of Next.js 16. This removes the unsupported `13.x` baseline and aligns with the Cloudflare adapter support window. | https://nextjs.org/support-policy ; https://nextjs.org/docs/app/api-reference/file-conventions/route ; https://opennext.js.org/cloudflare                                               |
| `@opennextjs/cloudflare` | not installed       | `@opennextjs/cloudflare@1.17.1`                                             | Official Cloudflare docs for OpenNext say the adapter supports Next.js 16, uses the Next.js Node.js runtime on Workers, and requires explicit Wrangler/compatibility configuration. Lock to current published stable package.                                          | https://opennext.js.org/cloudflare ; https://opennext.js.org/cloudflare/get-started ; https://www.npmjs.com/package/@opennextjs/cloudflare                                              |
| Auth.js v5               | `next-auth@4.24.13` | `next-auth@5.0.0-beta.30`                                                   | Official v5 migration guide still instructs installing `next-auth@beta`. Lock to the current beta train instead of staying on v4. This is the App Router-first line and the only documented v5 path.                                                                   | https://authjs.dev/getting-started/migrating-to-v5 ; https://authjs.dev/guides/environment-variables ; https://www.npmjs.com/package/next-auth                                          |
| Drizzle ORM              | not installed       | `drizzle-orm@0.45.1` + `drizzle-kit@0.31.10`                                | Official Drizzle docs document Turso/libSQL as a first-class path and require Drizzle Kit for schema/migration flow. Lock to current stable packages that match the published docs.                                                                                    | https://orm.drizzle.team/docs/connect-turso ; https://orm.drizzle.team/docs/drizzle-config-file ; https://www.npmjs.com/package/drizzle-orm ; https://www.npmjs.com/package/drizzle-kit |
| Turso / libSQL SDK       | not installed       | `@libsql/client@0.17.2`                                                     | Official Turso and Drizzle docs use `@libsql/client` as the JavaScript/TypeScript client for Turso/libSQL and require URL + auth token configuration. Lock to current stable client.                                                                                   | https://docs.turso.tech/sdk/ts/quickstart ; https://orm.drizzle.team/docs/connect-turso ; https://www.npmjs.com/package/@libsql/client                                                  |
| tRPC fetch adapter       | `@trpc/*@11.14.1`   | stay on `@trpc/*@11.14.1`; switch server transport to `fetchRequestHandler` | Current repo already matches latest published tRPC 11. Official docs for App Router / edge-style runtimes require the fetch adapter and Web `Request`/`Response`, not Next API handlers. No version bump needed now; transport shape must change later.                | https://trpc.io/docs/server/adapters/fetch ; https://trpc.io/docs/server/adapters/nextjs ; https://trpc.io/docs/client/nextjs ; https://www.npmjs.com/package/@trpc/server              |

## Compatibility gate decisions

### 1) Next.js

- `next@13.x` is not acceptable for the target migration because official Next.js support policy lists `13.x` as unsupported.
- Route handlers in App Router use Web `Request` / `Response`, which is the transport shape needed for both Auth.js v5 route handlers and tRPC fetch adapter migration.
- Route handler segment config shows `runtime = 'nodejs'` as the relevant setting; this aligns with OpenNext Cloudflare's Node.js-runtime-on-Workers model.

### 2) OpenNext Cloudflare

- OpenNext Cloudflare officially supports:
  - all minor and patch versions of Next.js 16
  - latest minors of Next.js 15
  - latest minors of Next.js 14, but its own docs say Next 14 support will be dropped and Next.js itself no longer supports 14
- Therefore the safe locked target is **Next 16 + current stable `@opennextjs/cloudflare`**.
- Required Cloudflare/OpenNext settings from official docs:
  - `compatibility_flags`: must include `nodejs_compat`
  - `compatibility_date`: must be `2024-09-23` or later; current example docs use `2024-12-30`
  - `main`: `.open-next/worker.js`
  - `assets.directory`: `.open-next/assets`
  - local `.dev.vars`: `NEXTJS_ENV=development`
  - `WORKER_SELF_REFERENCE` service binding is part of the standard config example
- Required migration caveats:
  - remove any `export const runtime = "edge"` because OpenNext Cloudflare docs state Edge runtime is not supported yet
  - Next.js 15.2+ Node middleware is not yet supported by OpenNext Cloudflare
  - Windows support is explicitly not guaranteed; WSL/Linux CI is the safer path

### 3) Auth.js v5

- Official migration guide says v5 is App Router-first and install command is `next-auth@beta`.
- Official minimum Next.js version for Auth.js v5 is `14.0`; Next 16 satisfies this.
- Route setup changes required by docs:
  - root-level `auth.ts`
  - `app/api/auth/[...nextauth]/route.ts` exports `{ GET, POST } = handlers`
  - use `auth()` rather than old `getServerSession` / `getToken` patterns where migrated
- Env changes required by docs:
  - prefer `AUTH_*` instead of `NEXTAUTH_*`
  - `AUTH_SECRET` is mandatory
  - provider credentials can be inferred from `AUTH_DISCORD_ID`, `AUTH_DISCORD_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`
  - `AUTH_URL` / `NEXTAUTH_URL` is usually not required anymore
  - `AUTH_TRUST_HOST=true` is the documented proxy-trust equivalent when deployed behind a proxy; Cloudflare deployment should assume this is required unless later runtime testing disproves it
- Session/runtime caveat from official docs:
  - when using an adapter, Auth.js defaults to `database` sessions
  - if edge/runtime compatibility is a concern, official docs recommend forcing `session: { strategy: "jwt" }`
  - For this migration plan, JWT remains the safer default until Drizzle/libSQL runtime behavior is proven in Cloudflare

### 4) Drizzle ORM

- Official Drizzle docs support Turso via libSQL directly.
- Required package/tooling shape from docs:
  - runtime package: `drizzle-orm`
  - migration/config package: `drizzle-kit`
  - Turso driver: `@libsql/client`
- Required config notes from official docs:
  - use `drizzle-orm/libsql` (or an explicitly chosen libsql variant)
  - `drizzle.config.ts` must declare the libSQL/Turso dialect path documented by current Drizzle docs
  - migration flow is `generate` + `migrate` (or `push` only for rapid iteration)

### 5) Turso / libSQL

- Official Turso docs require two env values for the JS client:
  - `TURSO_DATABASE_URL`
  - `TURSO_AUTH_TOKEN`
- Official Drizzle docs show the same pair when integrating with Drizzle.
- Driver/runtime caveat:
  - Drizzle documents multiple libSQL client entrypoints; for framework/serverless environments it documents web-compatible variants as available
  - final import path should be validated in implementation against Cloudflare bundling/runtime behavior, but the official integration surface is still `@libsql/client`

### 6) tRPC

- Official tRPC docs for App Router and fetch/edge runtimes require `fetchRequestHandler` and Web `Request`/`Response` APIs.
- Official Next.js adapter docs explicitly say App Router should use the fetch adapter.
- Current repo is already on latest published tRPC 11, so the lock is **version stability + transport migration**, not a package upgrade.
- Migration implication:
  - `createNextApiHandler` / Next API request-response assumptions are forbidden in the target architecture
  - route handlers should export `GET` / `POST` wrappers around `fetchRequestHandler`

## Required Cloudflare flags, env names, and runtime caveats

### Cloudflare / Wrangler

- `compatibility_flags = ["nodejs_compat"]`
- `compatibility_date >= 2024-09-23`
- recommended current OpenNext example date: `2024-12-30`
- `NEXTJS_ENV=development` in `.dev.vars` for local OpenNext/Workers dev integration
- worker bundle limit to watch during deployment:
  - Free plan: `3 MB` gzip
  - Paid plan: `10 MB` gzip
- general worker memory limit: `128 MB`

### OpenNext bindings/built-ins called out by docs

- `ASSETS`
- `WORKER_SELF_REFERENCE`
- optional cache bindings depending on cache strategy:
  - `NEXT_INC_CACHE_R2_BUCKET`
  - `NEXT_INC_CACHE_KV`
  - `NEXT_TAG_CACHE_KV`
  - `NEXT_TAG_CACHE_D1`

### Auth env names to adopt

- `AUTH_SECRET`
- `AUTH_DISCORD_ID`
- `AUTH_DISCORD_SECRET`
- `AUTH_GOOGLE_ID`
- `AUTH_GOOGLE_SECRET`
- likely deployment flag/value: `AUTH_TRUST_HOST=true`
- optional only if host inference fails: `AUTH_URL`

### Database env names to adopt

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`

## Incompatibilities and migration notes

1. **Next 13.5.11 must be replaced before Cloudflare target work continues.** It is unsupported by Next.js policy and outside the intended OpenNext 16-first target.
2. **OpenNext Cloudflare does not support `runtime = "edge"` for this target.** Route handlers should stay on the Node.js runtime model.
3. **Next API handler assumptions are incompatible with the target tRPC transport.** Use fetch adapter route handlers.
4. **Auth.js v5 is still distributed on the beta tag.** Lock to the current beta version deliberately; do not silently drift back to v4 stable because npm `latest` still points to v4.
5. **`NEXTAUTH_URL` is no longer a required assumption.** Host detection is automatic in Auth.js v5 unless deployment specifics force an explicit `AUTH_URL`.
6. **`NEXTAUTH_*` naming is stale for the target architecture.** Target env naming should move to `AUTH_*`.
7. **OpenNext Cloudflare relies on Node compatibility, not raw edge-only execution.** Packages must be reviewed against Cloudflare's Node compatibility table instead of assuming full Node parity.
8. **Worker size/startup limits are a real deployment gate.** Large server bundles or top-level initialization can fail Cloudflare deploys even when local Next builds pass.

## Forbidden stale assumptions

- “We can keep Next 13 because the app already works locally.” → Forbidden; official Next support policy rejects 13.x.
- “Pages Router API handlers can stay until the end.” → Forbidden for target transport; App Router route handlers are the doc-backed path for Auth.js v5 and tRPC fetch.
- “OpenNext Cloudflare runs Next edge runtime.” → Forbidden; current docs say remove `runtime = \"edge\"` and use the Node.js runtime model.
- “`NEXTAUTH_URL` is mandatory.” → Forbidden; official v5 docs say host auto-detection usually removes this requirement.
- “npm latest for `next-auth` gives us Auth.js v5.” → Forbidden; official docs still instruct `next-auth@beta` for v5.
- “Cloudflare Workers are just Node with full parity.” → Forbidden; Cloudflare explicitly documents only a subset of Node APIs plus partial/polyfilled behavior.
- “tRPC App Router can keep `createNextApiHandler`.” → Forbidden; official docs say App Router should use `fetchRequestHandler`.

## Version lock summary

- `next`: `16.2.1`
- `@opennextjs/cloudflare`: `1.17.1`
- `next-auth`: `5.0.0-beta.30`
- `@auth/drizzle-adapter`: `1.11.1`
- `drizzle-orm`: `0.45.1`
- `drizzle-kit`: `0.31.10`
- `@libsql/client`: `0.17.2`
- `@trpc/server`: `11.14.1`
- `@trpc/client`: `11.14.1`
- `@trpc/react-query`: `11.14.1`
