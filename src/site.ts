/** Public site origin (no trailing slash). Used for canonical URLs, Open Graph, and sitemap. */
export const SITE_ORIGIN = "https://arbitrary142857.github.io";

export const SITE_PAGE_TITLE = "MIT Course Notes";

export function siteUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_ORIGIN}${normalized}`;
}
