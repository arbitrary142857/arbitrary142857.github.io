/** Public site origin (no trailing slash). Used for canonical URLs, Open Graph, and sitemap. */
export const SITE_ORIGIN = "https://notes.jasonmao.me";

/**
 * Bare hostname, written to dist/CNAME so GitHub Pages serves the custom domain.
 * Derived from SITE_ORIGIN rather than repeated, so the two cannot disagree.
 */
export const SITE_HOST = new URL(SITE_ORIGIN).host;

/** Visible <h1> on the home page. */
export const SITE_PAGE_TITLE = "MIT Lecture Notes";

/** Home page <title> and social title; adds the byline a search result cannot infer. */
export const SITE_META_TITLE = `${SITE_PAGE_TITLE} | Jason Mao`;

export function siteUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_ORIGIN}${normalized}`;
}
