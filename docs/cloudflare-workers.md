# Cloudflare Workers deployment

This app targets Cloudflare Workers through OpenNext.

## Required files

- `open-next.config.ts` enables the OpenNext Cloudflare adapter.
- `wrangler.toml` points Wrangler at `.open-next/worker.js` and `.open-next/assets`.
- `package.json` exposes the Cloudflare build, preview, deploy, and env-type generation commands.
- `scripts/cloudflare/opennext-cloudflare.mjs` routes OpenNext CLI calls through WSL on Windows hosts so the bundle step can create traced symlinks safely.
- `public/_headers` enables immutable caching for Next static assets on Workers Assets.

## Required runtime bindings

Set non-secret config in `wrangler.toml`:

- `APP_BASE_URL`
- `BETTER_AUTH_TRUSTED_ORIGINS` (the deployed app origin)
- `TURSO_DATABASE_URL`
- `MEDIA_BUCKET` R2 binding for local, preview, and production

Set secrets with Wrangler so they are exposed as Worker bindings/process env at runtime:

```bash
pnpm wrangler secret put BETTER_AUTH_SECRET --env preview
pnpm wrangler secret put DISCORD_CLIENT_ID --env preview
pnpm wrangler secret put DISCORD_CLIENT_SECRET --env preview
pnpm wrangler secret put GOOGLE_CLIENT_ID --env preview
pnpm wrangler secret put GOOGLE_CLIENT_SECRET --env preview
pnpm wrangler secret put TURSO_AUTH_TOKEN --env preview
```

Repeat for `--env production` before the production deploy.

For local preview/runtime checks, copy `.dev.vars.example` to `.dev.vars` (and optionally `.dev.vars.preview` for real preview-environment deploys) and populate the secret values. Keep public/non-secret config in `wrangler.toml` `vars`; Cloudflare treats `vars` as plaintext config and `wrangler secret put` / `.dev.vars` as the secret path. `NEXTJS_ENV=development` keeps `next dev` and `opennextjs-cloudflare preview` aligned with the same local `.env` loading rules.

`file:` Turso URLs are supported by the Node.js local app but not by the Workerd/web libSQL client used in Cloudflare previews. A real `libsql://`, `https://`, or local HTTP Hrana endpoint must therefore override `TURSO_DATABASE_URL` for `pnpm cf:preview`; use `pnpm dev`/`pnpm start` with the checked-in file URL when a remote database is unavailable. The OpenNext bundle supplies the platform Fetch API to libSQL’s Hrana client so preview requests do not fall back to Node’s `http` implementation.

## R2 media bucket

Uploaded avatars and post images are stored in a private R2 bucket through the `MEDIA_BUCKET` binding. The application serves known opaque keys through the same-origin `/api/media/<key>` route, so a public R2 bucket or a separate media hostname is not required.

Create the buckets once:

```bash
pnpm wrangler r2 bucket create tweeva-media-local
pnpm wrangler r2 bucket create tweeva-media-local-preview
pnpm wrangler r2 bucket create tweeva-media-preview
pnpm wrangler r2 bucket create tweeva-media
```

The binding names and environment-specific bucket names are checked into `wrangler.toml`. Run type generation after changing them:

```bash
pnpm cf:typegen
```

Local `next dev` and `pnpm cf:preview` use Wrangler's local R2 simulation unless remote bindings are explicitly enabled. Preview and production deployments use their respective R2 buckets. Do not place R2 credentials in application environment variables; the Worker binding supplies access.

Cloudflare currently documents a monthly R2 free allowance of 10 GB-month storage, 1 million Class A operations, 10 million Class B operations, and free egress. Writes (`PutObject`) count as Class A and image reads (`GetObject`) count as Class B; usage above the allowance is billed. Review the [R2 pricing documentation](https://developers.cloudflare.com/r2/pricing/) before production promotion.

For Cloudflare dashboard-managed runtime vars/secrets, prefer `opennextjs-cloudflare deploy -- --keep-vars` so deployments do not wipe values that are managed outside the repo.

## Preview deployment flow

1. Update `wrangler.toml` placeholder `env.preview.vars` values for the preview hostname and Turso database.
2. Build the Worker/assets bundle:

   ```bash
   pnpm cf:build
   ```

3. Smoke-test the Cloudflare runtime locally:

   ```bash
   pnpm cf:preview
   ```

   This uses `.dev.vars` for local secrets and the top-level `wrangler.toml` `vars` block for non-secret config. Before running it, replace the local file database value with a reachable remote/HTTP Hrana URL (and token), or pass equivalent Wrangler `--var` overrides through the preview command.

4. Deploy the preview environment:

   ```bash
   pnpm cf:deploy:preview
   ```

5. Validate the preview deployment:
   - `/`
   - `/profiles/<existing-user-id>`
   - `/api/auth/signin`

If you are using Workers Builds instead of local deploys, set the build command to `npx @opennextjs/cloudflare build` and the deploy command to `npx @opennextjs/cloudflare deploy`, then mirror the required secrets into both the build-time and runtime configuration screens.

## Production deploy flow

After preview passes, set the `env.production` values/secrets and deploy:

```bash
pnpm cf:deploy
```

## Runtime notes

- Keep `compatibility_flags = ["nodejs_compat", "global_fetch_strictly_public"]` in `wrangler.toml`.
- Keep a `compatibility_date` on or after `2025-05-05` so modern Workers APIs used by current OpenNext output are available and the existing runtime/env seam can keep reading Worker bindings through `process.env`.
- Do not add `export const runtime = "edge"`; OpenNext runs the Next.js Node runtime on Workers.
- `pnpm cf:build` intentionally uses `SKIP_ENV_VALIDATION=1` because secrets come from Wrangler bindings at Worker runtime instead of build-time CI env.
- `pnpm cf:preview` is the mandatory smoke-test path before deploys because it runs the app in the `workerd` runtime instead of local Node.js.
- On Windows, the checked-in wrapper runs OpenNext inside WSL because the upstream adapter warns that native Windows builds can fail unpredictably; in this repo that failure manifested as an `EPERM` symlink error while bundling traced dependencies.

## Worker constraints to check before promotion

- Worker bundle size limit: 3 MB gzip on Workers Free, 10 MB gzip on Workers Paid.
- Worker startup/global-scope time limit: 1 second.
- Memory limit per isolate: 128 MB.
- Environment variable limits: 64 vars on Free / 128 on Paid, with 5 KB per variable.
- Use `wrangler deploy --dry-run --outdir bundled/ --env preview` after `pnpm cf:build` to record gzip size and startup metrics before promoting a preview build.

These are deployment gates, not post-release concerns. If the dry-run output shows bundle size or startup risk, trim dependencies or move heavy work out of module scope before deploy.
