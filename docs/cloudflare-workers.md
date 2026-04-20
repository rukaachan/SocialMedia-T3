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
- `AUTH_TRUST_HOST=true`
- `TURSO_DATABASE_URL`

Set secrets with Wrangler so they are exposed as Worker bindings/process env at runtime:

```bash
pnpm wrangler secret put AUTH_SECRET --env preview
pnpm wrangler secret put AUTH_DISCORD_ID --env preview
pnpm wrangler secret put AUTH_DISCORD_SECRET --env preview
pnpm wrangler secret put AUTH_GOOGLE_ID --env preview
pnpm wrangler secret put AUTH_GOOGLE_SECRET --env preview
pnpm wrangler secret put TURSO_AUTH_TOKEN --env preview
```

Repeat for `--env production` before the production deploy.

For local preview/runtime checks, copy `.dev.vars.example` to `.dev.vars` (and optionally `.dev.vars.preview` for real preview-environment deploys) and populate the secret values. Keep public/non-secret config in `wrangler.toml` `vars`; Cloudflare treats `vars` as plaintext config and `wrangler secret put` / `.dev.vars` as the secret path. `NEXTJS_ENV=development` keeps `next dev` and `opennextjs-cloudflare preview` aligned with the same local `.env` loading rules.

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

   This uses `.dev.vars` for local secrets and the top-level `wrangler.toml` `vars` block for non-secret config.

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
