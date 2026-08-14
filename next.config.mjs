import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker/OpenNext adapter builds that receive secrets as Wrangler bindings at runtime.
 */
if (!process.env.SKIP_ENV_VALIDATION) {
  await import("./src/env.mjs");
}

await initOpenNextCloudflareForDev();

/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Let OpenNext copy libSQL with its Workerd export condition instead of
  // bundling the Node-native implementation into the Worker.
  serverExternalPackages: ["@libsql/client", "@libsql/isomorphic-ws"],
  // OpenNext Cloudflare currently expects Next.js i18n routing to stay disabled.
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        hostname: "cdn.discordapp.com",
        protocol: "https",
      },
    ],
  },
};

export default nextConfig;
