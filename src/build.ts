import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  COURSES,
  courseDir,
  courseNotesDir,
  coursePreamblePath,
  courseSiteDir,
} from "./courses.js";
import {
  coursePageTitle,
  formatLectureLabel,
  lectureHeaderHtml,
  lecturePageTitle,
  lectureSlug,
  loadNotes,
  type Note,
} from "./notes.js";
import { parseTex, renderInlineFragment, titlePlainText, extractSubsections } from "./parser.js";
import { SITE_PAGE_TITLE, siteUrl } from "./site.js";
import { getTocParts, groupNotesByTocParts, type TocPart } from "./toc-sections.js";
import { lectureNavHtml } from "./lecture-nav.js";
import { lectureNavbarHtml } from "./lecture-navbar.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = join(root, "dist");
/** Google Search Console verification file; must stay at the site root. */
const GOOGLE_VERIFICATION = "google7d30abf698d487de.html";
const templatePath = join(root, "template.html");
const katexDist = join(root, "node_modules/katex/dist");
const katexOut = join(distDir, "katex");

const template = readFileSync(templatePath, "utf8");

mkdirSync(distDir, { recursive: true });

// dist/ is rewritten in place rather than wiped: a dev server may be serving it,
// and deleting the tree would 404 every request mid-build. Instead each output is
// written only when its content actually changed, and whatever this build did not
// produce is pruned at the end. One edit then means one file change, so the dev
// server reloads once instead of reacting to the whole tree.
const producedPaths = new Set<string>();
let changedCount = 0;

function writeIfChanged(path: string, content: string): void {
  producedPaths.add(path);
  if (existsSync(path) && readFileSync(path, "utf8") === content) return;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  changedCount++;
}

/**
 * Mirror a file or directory into dist/, copying only entries that changed.
 *
 * Freshness is size plus mtime, since copyFileSync does not preserve mtimes and
 * so an exact comparison would never match. A source replaced by an *older* file
 * of identical size is therefore missed; `rm -rf dist` is the escape hatch.
 */
function syncPath(from: string, to: string): void {
  const source = statSync(from);
  if (source.isDirectory()) {
    mkdirSync(to, { recursive: true });
    for (const entry of readdirSync(from)) syncPath(join(from, entry), join(to, entry));
    return;
  }
  producedPaths.add(to);
  if (existsSync(to)) {
    const dest = statSync(to);
    if (dest.size === source.size && dest.mtimeMs >= source.mtimeMs) return;
  }
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
  changedCount++;
}

/** Delete anything under dist/ this build did not produce, then drop empty dirs. */
function pruneStale(dir: string): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      pruneStale(path);
      // Recursing first lets nested orphan trees collapse from the bottom up.
      if (readdirSync(path).length === 0) rmdirSync(path);
    } else if (!producedPaths.has(path)) {
      unlinkSync(path);
      changedCount++;
    }
  }
}

interface ParsedNote {
  note: Note;
  result: ReturnType<typeof parseTex>;
  titleHtml: string;
  titlePlain: string;
}

const parsedByCourse = new Map<string, ParsedNote[]>();
const sitemapPaths: string[] = ["/"];

interface PageSeo {
  description: string;
  canonicalPath: string;
}

for (const course of COURSES) {
  const courseRoot = courseDir(root, course.id);
  const notesDir = courseNotesDir(root, course.id);
  const preamblePath = coursePreamblePath(root, course.id);
  const preamble = existsSync(preamblePath) ? readFileSync(preamblePath, "utf8") : "";
  const notes = loadNotes(notesDir, course.id);
  const parsed = notes.map((note) => ({
    note,
    result: parseTex(note.source, preamble, courseRoot, "images", "audio", "widgets"),
    titleHtml: renderInlineFragment(note.title, preamble, courseRoot),
    titlePlain: titlePlainText(note.title),
  }));
  parsedByCourse.set(course.id, parsed);

  const siteDir = courseSiteDir(root, course.id);
  const lecturesOutDir = join(siteDir, "lectures");
  mkdirSync(lecturesOutDir, { recursive: true });

  // Images and audio are published at /<courseId>/, so course-relative asset
  // URLs from the parser resolve there from any page depth.
  const coursePrefix = `/${course.id}/`;
  for (const { note, result, titleHtml, titlePlain } of parsed) {
    const slug = lectureSlug(note.lectures);
    const pageTitle = lecturePageTitle(note, course.title, titlePlain);
    const canonicalPath = `/${course.id}/lectures/${slug}/`;
    const subsections = extractSubsections(note.source).map(({ slug, titleTex }) => ({
      slug,
      titleHtml: renderInlineFragment(titleTex, preamble, courseRoot),
    }));
    const navbar = lectureNavbarHtml({
      homeHref: "/",
      courseHref: coursePrefix,
      courseTitle: course.title,
      lectureLabel: formatLectureLabel(note.lectures),
      subsections,
    });
    const header = lectureHeaderHtml(note, course.title, titleHtml);
    const footer = lectureNavHtml(
      parsed.map(({ note, titleHtml }) => ({ note, titleHtml })),
      note,
    );
    const lectureOutDir = join(lecturesOutDir, slug);
    mkdirSync(lectureOutDir, { recursive: true });
    writePage(
      join(lectureOutDir, "index.html"),
      pageTitle,
      coursePrefix,
      `${navbar}${header}\n${result.html}\n${footer}`,
      {
        description: `${pageTitle}. MIT lecture notes for ${course.subtitle}.`,
        canonicalPath,
      },
    );
    sitemapPaths.push(canonicalPath);
  }

  for (const assetDir of ["images", "audio"]) {
    const from = join(courseRoot, assetDir);
    if (existsSync(from)) syncPath(from, join(siteDir, assetDir));
  }

  const courseTitle = coursePageTitle(course.title, course.subtitle);
  writePage(
    join(siteDir, "index.html"),
    courseTitle,
    coursePrefix,
    renderCourseHome(course, parsed, preamble, courseRoot),
    {
      description: `Lecture notes for ${courseTitle}.`,
      canonicalPath: coursePrefix,
    },
  );
  sitemapPaths.push(coursePrefix);
}

const siteHomeDescription = siteHomeMetaDescription();
writePage(join(distDir, "index.html"), SITE_PAGE_TITLE, "", renderSiteHome(), {
  description: siteHomeDescription,
  canonicalPath: "/",
});

syncPath(katexDist, katexOut);
for (const asset of ["highlight", "fonts", "lecture-navbar.js", "mobile.js", GOOGLE_VERIFICATION]) {
  syncPath(join(root, asset), join(distDir, asset));
}
// Keep GitHub Pages from running the output through Jekyll.
writeIfChanged(join(distDir, ".nojekyll"), "");

writeIfChanged(join(distDir, "sitemap.xml"), renderSitemap(sitemapPaths));
writeIfChanged(
  join(distDir, "robots.txt"),
  `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl("/sitemap.xml")}\n`,
);

pruneStale(distDir);

const totalPages = [...parsedByCourse.values()].reduce((sum, parsed) => sum + parsed.length, 0);
const unchanged = producedPaths.size - changedCount;
console.log(
  `Built dist/: ${COURSES.length} course page(s), ${totalPages} lecture page(s) — ` +
    `${changedCount} file(s) changed, ${unchanged} unchanged`,
);

function writePage(
  path: string,
  title: string,
  coursePrefix: string,
  content: string,
  seo: PageSeo,
): void {
  const resolvedContent = content.replaceAll("{{COURSE_PREFIX}}", coursePrefix);
  const canonicalUrl = siteUrl(seo.canonicalPath);
  const ogUrl = canonicalUrl;
  const canonicalTag = `<link rel="canonical" href="${escapeHtml(canonicalUrl)}">`;
  const description = escapeHtml(seo.description);
  const page = template
    .replaceAll("{{TITLE}}", escapeHtml(title))
    .replaceAll("{{META_DESCRIPTION}}", description)
    .replace("{{CANONICAL}}", canonicalTag)
    .replaceAll("{{OG_URL}}", escapeHtml(ogUrl))
    .replace("{{CONTENT}}", resolvedContent);
  writeIfChanged(path, page);
}

function renderSitemap(paths: string[]): string {
  const urls = paths
    .map(
      (path) => `  <url>\n    <loc>${escapeXml(siteUrl(path))}</loc>\n  </url>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function escapeXml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function siteHomeMetaDescription(): string {
  const courses = COURSES.map((c) => `MIT ${c.title}`).join(", ");
  return `Lecture notes for ${courses} — algebra, algorithms, signal processing, statistics, machine learning, and more.`;
}

/** Lets a course summary be authored as an indented multi-line template literal. */
function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Seasonal tint class for a course card, read out of the free-form semester label
 * ("🍂 Fall 2025"). A label naming no season (say, "IAP 2027") tints nothing and
 * falls back to the plain card.
 */
function seasonModifier(semester: string): string {
  const label = semester.toLowerCase();
  if (label.includes("fall") || label.includes("autumn")) return " course-card--fall";
  if (label.includes("spring")) return " course-card--spring";
  if (label.includes("summer")) return " course-card--summer";
  return "";
}

function renderSiteHome(): string {
  const cards = COURSES.map(
    (course) => `<a class="course-card${seasonModifier(course.semester)}" href="/${course.id}/">
<span class="course-card-head">
<span class="course-card-number">${escapeHtml(course.title)}</span>
<span class="course-card-term">${escapeHtml(course.semester)}</span>
</span>
<span class="course-card-title">${escapeHtml(course.subtitle)}</span>
<span class="course-card-summary">${escapeHtml(collapseWhitespace(course.summary))}</span>
</a>`,
  ).join("\n");

  return `<h1 class="site-title">${escapeHtml(SITE_PAGE_TITLE)}</h1>
<div class="course-grid">
${cards}
</div>`;
}

function renderCourseHome(
  course: (typeof COURSES)[number],
  parsed: ParsedNote[],
  preamble: string,
  courseRoot: string,
): string {
  const nav = `<nav class="site-nav"><a href="/">Home</a></nav>`;
  const tocParts = getTocParts(course.id);
  const tocHtml = tocParts
    ? renderCourseTocWithParts(parsed, tocParts, preamble, courseRoot)
    : renderCourseTocFlat(parsed, preamble, courseRoot);

  return `${nav}<header class="lecture-header"><h1>MIT ${escapeHtml(course.title)}</h1><p class="lecture-title">${escapeHtml(course.subtitle)}</p></header>
${tocHtml}`;
}

function renderLectureTocEntry(
  note: Note,
  titleHtml: string,
  preamble: string,
  courseRoot: string,
): string {
  const pageUrl = `/${note.courseId}/lectures/${lectureSlug(note.lectures)}/`;
  const lectureLink = `<a href="${pageUrl}" class="lecture-toc-link">${escapeHtml(formatLectureLabel(note.lectures))}: ${titleHtml}</a>`;
  const subsections = extractSubsections(note.source);
  if (subsections.length === 0) {
    return `<li class="lecture-toc-entry">${lectureLink}</li>`;
  }
  const subItems = subsections
    .map(({ slug, titleTex }) => {
      const subTitleHtml = renderInlineFragment(titleTex, preamble, courseRoot);
      return `<li><a href="${pageUrl}#${escapeHtml(slug)}" class="toc-subsection-link"><span class="toc-subsection-marker">§</span> ${subTitleHtml}</a></li>`;
    })
    .join("\n");
  return `<li class="lecture-toc-entry">${lectureLink}\n<ul class="subsection-toc">\n${subItems}\n</ul></li>`;
}

function renderCourseTocFlat(
  parsed: ParsedNote[],
  preamble: string,
  courseRoot: string,
): string {
  const items = parsed
    .map(({ note, titleHtml }) => renderLectureTocEntry(note, titleHtml, preamble, courseRoot))
    .join("\n");
  return `<nav class="toc-outline" aria-label="Lectures">\n<ul class="toc-lectures">\n${items}\n</ul>\n</nav>`;
}

function renderCourseTocWithParts(
  parsed: ParsedNote[],
  tocParts: TocPart[],
  preamble: string,
  courseRoot: string,
): string {
  const notes = parsed.map((p) => p.note);
  const grouped = groupNotesByTocParts(notes, tocParts);
  const parsedBySlug = new Map(
    parsed.map((p) => [lectureSlug(p.note.lectures), p] as const),
  );

  const partsHtml = grouped
    .map(({ part, notes: partNotes }, index) => {
      const lectureItems = partNotes
        .map((note) => {
          const entry = parsedBySlug.get(lectureSlug(note.lectures));
          if (!entry) return "";
          return renderLectureTocEntry(
            entry.note,
            entry.titleHtml,
            preamble,
            courseRoot,
          );
        })
        .filter(Boolean)
        .join("\n");
      return `<section class="toc-part">
<h2 class="toc-part-title"><span class="toc-part-marker">§</span> Section ${index + 1}: ${escapeHtml(part.title)}</h2>
<ul class="toc-lectures">
${lectureItems}
</ul>
</section>`;
    })
    .join("\n");

  return `<nav class="toc-outline" aria-label="Lectures">\n${partsHtml}\n</nav>`;
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
