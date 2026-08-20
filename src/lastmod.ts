import { spawnSync } from "node:child_process";

/**
 * Sources that change the HTML of every page: the renderer, the page template, and the
 * assets copied into dist/. A commit touching any of them re-dates the whole site, which
 * is what makes a metadata-only change like a rewritten <meta description> show up as a
 * real modification to a crawler.
 */
const SITE_WIDE_SOURCES = [
  "src",
  "template.html",
  "lecture-navbar.js",
  "mobile.js",
  "highlight",
  "fonts",
  "favicon.svg",
];

/**
 * Resolves a page's <lastmod> from git history: the newest commit touching either the
 * page's own sources or anything site-wide. Returns null when git cannot answer — an
 * untracked note, a shallow clone with no history, or no repository at all — in which
 * case the entry is written without a <lastmod> rather than with a invented one.
 */
export type Lastmod = (sourcePaths: string[]) => string | null;

export function createLastmod(root: string): Lastmod {
  const commitTimes = indexCommitTimes(root);
  const siteWide = newestUnder(commitTimes, SITE_WIDE_SOURCES) ?? 0;
  return (sourcePaths) => {
    const newest = Math.max(siteWide, newestUnder(commitTimes, sourcePaths) ?? 0);
    return newest > 0 ? isoUtcSeconds(newest) : null;
  };
}

/** Maps every tracked path to the commit time of the last commit that touched it. */
function indexCommitTimes(root: string): Map<string, number> {
  const times = new Map<string, number>();
  const log = spawnSync("git", ["log", "--format=%ct", "--name-only", "--no-renames"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (log.status !== 0 || !log.stdout) return times;

  let commitTime = 0;
  for (const line of log.stdout.split("\n")) {
    const text = line.trim();
    if (!text) continue;
    // A bare Unix timestamp starts each commit; everything else is a path it touched.
    if (/^\d{9,11}$/.test(text)) {
      commitTime = Number.parseInt(text, 10);
      continue;
    }
    // Newest commits come first, so the first sighting of a path is its latest change.
    if (!times.has(text)) times.set(text, commitTime);
  }
  return times;
}

function newestUnder(times: Map<string, number>, prefixes: string[]): number | null {
  let newest = 0;
  for (const [path, seconds] of times) {
    if (prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
      newest = Math.max(newest, seconds);
    }
  }
  return newest > 0 ? newest : null;
}

/** W3C datetime, which is what <lastmod> expects. Milliseconds add nothing here. */
function isoUtcSeconds(seconds: number): string {
  return new Date(seconds * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");
}
