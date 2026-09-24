/**
 * Deployment base path.
 *
 * GitHub Pages serves a project repository from `https://<user>.github.io/<repo>/`,
 * so the Pages build sets `NEXT_PUBLIC_BASE_PATH=/<repo>` (the `predeploy` script in
 * package.json). Next.js applies that prefix to its own
 * `/_next/*` assets and to `<Link>` navigation on its own, but **not** to raw
 * paths handed to `next/image` or to metadata icons — use `assetPath` for those.
 *
 * `NEXT_PUBLIC_*` values are inlined at build time, so this is a constant.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Prefixes a public asset path (`/logo.png`) with the deployment base path. */
export function assetPath(path: string): string {
  if (!path.startsWith("/")) return path;
  return `${BASE_PATH}${path}`;
}
