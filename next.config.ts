import path from "node:path";
import type { NextConfig } from "next";

// Pin the workspace root to this project so Next does not walk up to a
// stray lockfile outside the repo (e.g. one in the home directory).
const root = path.resolve(".");

/**
 * GitHub Pages can only serve static files, so the Pages build opts into a
 * static export (`NEXT_OUTPUT=export`) with the repository name as its base
 * path. Everything else — `npm run dev`, `npm run build` + `npm start` — keeps
 * the normal Node server behaviour, which is also what the Puppeteer suite
 * drives.
 */
const staticExport = process.env.NEXT_OUTPUT === "export";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: { root },
  outputFileTracingRoot: root,
  ...(staticExport
    ? {
        output: "export" as const,
        basePath,
        // /dashboard -> /dashboard/index.html, which is what Pages serves.
        trailingSlash: true,
        // There is no Image Optimization server behind Pages.
        images: { unoptimized: true },
      }
    : {}),
};

export default nextConfig;

