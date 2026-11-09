import { SECURITY_HEADERS } from "./lib/security/headers.mjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // This app is a Next.js multi-zone: the site rewrites aaronsulbaran.com/speedrun
  // to it. basePath namespaces its pages, API routes, /_next assets and public files.
  basePath: "/speedrun",
  // No x-powered-by header: it names the framework to anyone shopping for its advisories.
  poweredByHeader: false,
  // Every response, pages, assets and 404s alike (lib/security/headers.mjs).
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

// No withBotId wrapper: Vercel routes BotID itself, and the wrapper's rewrites
// would be prefixed by the basePath. The page mounts BotIdClient and the read and
// brief routes run the server checks.
export default nextConfig;
