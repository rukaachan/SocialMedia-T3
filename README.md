# Tweeva

Tweeva is a minimal social app for posting short updates, following profiles, and browsing a simple feed.

## Overview

- create an account with email/password, Discord, or Google authentication
- edit a profile name, bio, and avatar with OAuth-image fallback
- post text and up to four validated, alt-text-described images
- like, bookmark, edit, and soft-delete owned posts
- reply in single-level threads
- follow other users
- browse recent and following feeds
- search people and posts
- view user profiles and saved bookmarks

## Stack

- Next.js 16
- React 19
- Better Auth (Drizzle adapter)
- Drizzle ORM + Turso/libSQL
- tRPC
- Tailwind CSS
- Cloudflare Workers (OpenNext)
- Cloudflare R2 for private media storage and same-origin delivery

## Security controls

Rate-limited mutation paths (in-memory limiter, per user):

- post create/edit/delete, replies, likes, bookmarks, profile edits, and media uploads
- `POST /api/auth/unlink` -> `RATE_LIMITS.UNLINK_PROVIDER` (10/min)

Media controls:

- JPEG, PNG, and WebP only; 5 MB per file; server-side signature and dimension validation
- opaque R2 object keys, owner checks, pending-to-attached metadata, cleanup on failure, and deleted-object delivery blocking
- same-origin checks on upload/cleanup mutations and safe image response headers
- user-provided post alt text and stable dimensions/lazy loading in galleries

CSRF protections:

- Better Auth is configured with `trustedOrigins` from `BETTER_AUTH_TRUSTED_ORIGINS` + `APP_BASE_URL`/`BETTER_AUTH_URL`.
- `POST /api/auth/unlink` enforces same-origin requests by validating `Origin` (or `Referer` origin fallback) against the request URL origin.
- Protected tRPC mutations are JSON/fetch-based and authenticated through same-site session cookies.

## Run locally

1. Configure `.env`.
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Sync the local libSQL database:
   ```bash
   pnpm db:drizzle:migrate
   ```
4. For local media development, create the simulated R2 bindings once:
   ```bash
   pnpm wrangler r2 bucket create tweeva-media-local
   pnpm wrangler r2 bucket create tweeva-media-local-preview
   ```
5. Start the app:
   ```bash
   pnpm dev
   ```

Open `http://localhost:3000`.

Inspect the configured database shape without reading user rows:

```bash
pnpm db:inspect
```

## Cloudflare Workers deployment

OpenNext/Cloudflare build + preview commands are wired into the repo:

```bash
pnpm cf:build
pnpm cf:preview
pnpm cf:deploy
```

Deployment setup, preview promotion, and required Wrangler bindings are documented in [`docs/cloudflare-workers.md`](./docs/cloudflare-workers.md).

### Required Cloudflare secrets

Set these in your Cloudflare Workers dashboard or via `wrangler secret put`:

- `BETTER_AUTH_SECRET`
- `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET`
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
- `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN`

### Required R2 binding

- `MEDIA_BUCKET` is configured in `wrangler.toml`; it is a Worker binding, not an application secret.
- Bucket creation, local simulation, preview/production names, and free-tier limits are documented in [`docs/cloudflare-workers.md`](./docs/cloudflare-workers.md).

## Database

Turso provides edge-replicated SQLite via libSQL. Media bytes live in R2; Turso stores media ownership/metadata and post/profile relationships. Run migrations:

```bash
pnpm db:drizzle:migrate
```

For local development, ensure `TURSO_DATABASE_URL` points to your Turso database.

The one-time MySQL to Turso migration workflow is documented in [`docs/mysql-to-turso-cutover.md`](./docs/mysql-to-turso-cutover.md).

```bash
pnpm db:cutover
pnpm db:cutover:verify
```

### Rollback procedure

If you need to revert to the legacy MySQL stack:

1. Restore `prisma/schema.prisma` from git history
2. Re-add `@prisma/client`, `prisma`, and `@auth/prisma-adapter` to `package.json`
3. Revert `auth.ts` to use `PrismaAdapter`
4. Set `DATABASE_URL` to your MySQL connection string
5. Run `prisma generate && prisma db push`
