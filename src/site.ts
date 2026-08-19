/** Public site origin (no trailing slash). Used for canonical URLs, Open Graph, and sitemap. */
export const SITE_ORIGIN = "https://notes.jasonmao.me";

/**
 * Bare hostname, written to dist/CNAME so GitHub Pages serves the custom domain.
 * Derived from SITE_ORIGIN rather than repeated, so the two cannot disagree.
 */
export const SITE_HOST = new URL(SITE_ORIGIN).host;

export const SITE_PAGE_TITLE = "MIT Course Notes";

export function siteUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_ORIGIN}${normalized}`;
}
