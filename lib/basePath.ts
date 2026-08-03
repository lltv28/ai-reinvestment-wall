// Base path for GitHub Pages project-site hosting ("/ai-reinvestment-wall").
// Empty in local dev (serves from root); set in production builds. Mirrors the
// logic in next.config.ts so next/image, next/link, and raw asset() paths agree.
export const BASE_PATH =
  process.env.NEXT_PUBLIC_BASE_PATH ||
  (process.env.NODE_ENV === 'production' ? '/ai-reinvestment-wall' : '');

/**
 * Prefix a root-absolute asset path (e.g. "/paywall-video.mp4") with the base
 * path. Raw <video>/iframe src strings aren't rewritten by Next automatically
 * the way next/image and next/link are, so use this for them. External URLs and
 * already-prefixed paths are returned unchanged.
 */
export function asset(path: string): string {
  if (!path.startsWith('/')) return path; // external URL or relative — leave as-is
  if (BASE_PATH && path.startsWith(`${BASE_PATH}/`)) return path; // already prefixed
  return `${BASE_PATH}${path}`;
}
