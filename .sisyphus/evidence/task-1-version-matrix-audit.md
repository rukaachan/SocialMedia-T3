# Task 1 — Version matrix audit

Date: 2026-03-23

## Scope audit

All six required migration surfaces are covered with current official sources:

1. Next.js App Router
2. `@opennextjs/cloudflare`
3. Auth.js v5
4. Drizzle ORM
5. Turso / libSQL
6. tRPC fetch adapter

## Official-source gate

- Primary authorities used:
  - Next.js docs / support policy
  - OpenNext Cloudflare docs
  - Auth.js docs
  - Drizzle docs
  - Turso docs
  - tRPC docs
  - Cloudflare Workers docs
- Context7 was used to confirm the currently indexed official documentation surfaces before extracting specifics.
- No blog, Medium, or community article was used as sole authority for any version or runtime decision.

## Compatibility verdicts

### Approved locks

- **Next.js 16.2.1** — approved because Next 16 is Active LTS and officially supported by OpenNext Cloudflare.
- **`@opennextjs/cloudflare` 1.17.1** — approved because official docs support Next 16 and require the Cloudflare-specific runtime flags and bindings listed in the matrix.
- **`next-auth` 5.0.0-beta.30** — approved because the official v5 migration guide still prescribes the beta channel.
- **`drizzle-orm` 0.45.1 + `drizzle-kit` 0.31.10** — approved because official docs document Turso/libSQL integration and the required migration workflow.
- **`@libsql/client` 0.17.2** — approved because both Turso and Drizzle officially use this client for TypeScript/JavaScript integration.
- **tRPC 11.14.1** — approved as-is because current repo already matches latest published v11 and official docs require a transport migration, not a version jump.

### Rejected or blocked assumptions

- **Stay on Next 13.5.11** — rejected.
- **Stay on NextAuth v4 because npm latest is stable** — rejected.
- **Keep Pages API handlers for final transport** — rejected.
- **Use OpenNext with `runtime = "edge"`** — rejected.
- **Assume `NEXTAUTH_URL` remains required** — rejected.
- **Assume Cloudflare Workers provide full Node parity** — rejected.

## Required runtime/config gates captured

- Cloudflare `nodejs_compat`
- Cloudflare `compatibility_date >= 2024-09-23`
- OpenNext `.dev.vars` with `NEXTJS_ENV=development`
- Cloudflare/OpenNext bindings and cache binding names
- Auth.js env rename to `AUTH_*`
- Turso env names `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN`
- Worker size/runtime caveats from Cloudflare official limits docs

## Baseline-to-target delta summary

| Surface           | Baseline                     | Target                         | Audit result                 |
| ----------------- | ---------------------------- | ------------------------------ | ---------------------------- |
| Next.js           | `13.5.11`                    | `16.2.1`                       | required upgrade             |
| Auth              | `next-auth@4.24.13`          | `next-auth@5.0.0-beta.30`      | required migration           |
| Prisma/MySQL      | Prisma runtime               | Drizzle + Turso/libSQL         | required replacement         |
| tRPC transport    | Next API handler assumptions | fetch adapter / route handlers | required transport migration |
| Cloudflare target | none                         | OpenNext Cloudflare            | required platform migration  |

## Audit conclusion

The version matrix passes the doc gate.

- Every required migration surface has an official source URL.
- Each major target version is justified by current official docs plus current package publication state.
- Required Cloudflare flags, env names, and runtime caveats are explicitly documented.
- The matrix blocks stale assumptions that would otherwise cause unsupported or misleading migration work.
