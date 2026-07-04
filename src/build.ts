import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
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
const templatePath = join(root, "template.html");
const katexDist = join(root, "node_modules/katex/dist");
const katexOut = join(root, "katex");

const template = readFileSync(templatePath, "utf8");

interface ParsedNote {
  note: Note;
  result: ReturnType<typeof parseTex>;
  titleHtml: string;
  titlePlain: string;
}

const parsedByCourse = new Map<string, ParsedNote[]>();
const sitemapPaths: string[] = ["/index.html"];

interface PageSeo {
  description: string;
  /** Omit to skip rel=canonical (e.g. aggregate pages marked noindex). */
  canonicalPath?: string;
  robots?: string;
}

for (const course of COURSES) {
  const courseRoot = courseDir(root, course.id);
  const notesDir = courseNotesDir(root, course.id);
  const preamblePath = coursePreamblePath(root, course.id);
  const preamble = existsSync(preamblePath) ? readFileSync(preamblePath, "utf8") : "";
  const notes = loadNotes(notesDir, course.id);
  const parsed = notes.map((note) => ({
    note,
    result: parseTex(note.source, preamble, courseRoot, "images", "audio"),
    titleHtml: renderInlineFragment(note.title, preamble, courseRoot),
    titlePlain: titlePlainText(note.title),
  }));
  parsedByCourse.set(course.id, parsed);

  const siteDir = courseSiteDir(root, course.id);
  const notesOutDir = join(siteDir, "notes-html");
  mkdirSync(notesOutDir, { recursive: true });

  const assetPrefix = "../../";
  const lectureNavHomePrefix = "../../../";
  const lectureNavCoursePrefix = "../";
  for (const { note, result, titleHtml, titlePlain } of parsed) {
    const slug = lectureSlug(note.lectures);
    const pageTitle = lecturePageTitle(note, course.title, titlePlain);
    const courseTitle = coursePageTitle(course.title, course.subtitle);
    const canonicalPath = `/courses/${course.id}/notes-html/${slug}.html`;
    const subsections = extractSubsections(note.source).map(({ slug, titleTex }) => ({
      slug,
      titleHtml: renderInlineFragment(titleTex, preamble, courseRoot),
    }));
    const navbar = lectureNavbarHtml({
      homeHref: `${lectureNavHomePrefix}index.html`,
      courseHref: `${lectureNavCoursePrefix}index.html`,
      courseTitle: course.title,
      lectureLabel: formatLectureLabel(note.lectures),
      subsections,
    });
    const header = lectureHeaderHtml(note, course.title, titleHtml);
    const footer = lectureNavHtml(
      parsed.map(({ note, titleHtml }) => ({ note, titleHtml })),
      note,
    );
    writePage(
      join(notesOutDir, `${slug}.html`),
      pageTitle,
      { assetPrefix: "../../../", coursePrefix: "../" },
      `${navbar}${header}\n${result.html}\n${footer}`,
      {
        description: `${pageTitle}. MIT lecture notes for ${course.subtitle}.`,
        canonicalPath,
      },
    );
    sitemapPaths.push(canonicalPath);
  }

  const activeSlugs = new Set(parsed.map(({ note }) => lectureSlug(note.lectures)));
  for (const file of readdirSync(notesOutDir)) {
    if (!file.endsWith(".html")) continue;
    const slug = file.slice(0, -".html".length);
    if (!activeSlugs.has(slug)) {
      unlinkSync(join(notesOutDir, file));
    }
  }

  const courseTitle = coursePageTitle(course.title, course.subtitle);
  writePage(
    join(siteDir, "index.html"),
    courseTitle,
    { assetPrefix, coursePrefix: "" },
    renderCourseHome(course, parsed, assetPrefix, preamble, courseRoot),
    {
      description: `Lecture notes for ${courseTitle}.`,
      canonicalPath: `/courses/${course.id}/index.html`,
    },
  );
  sitemapPaths.push(`/courses/${course.id}/index.html`);

  const allPageTitle = `All lectures — ${courseTitle}`;
  writePage(
    join(siteDir, "all.html"),
    allPageTitle,
    { assetPrefix, coursePrefix: "" },
    renderCourseAll(course, parsed, assetPrefix),
    {
      description: `All MIT ${course.title} lectures in one page (${course.subtitle}). Prefer individual lecture pages for reading and search indexing.`,
      robots: "noindex, follow",
    },
  );
}

const siteHomeDescription = siteHomeMetaDescription();
writePage(
  join(root, "index.html"),
  SITE_PAGE_TITLE,
  { assetPrefix: "", coursePrefix: "" },
  renderSiteHome(),
  {
    description: siteHomeDescription,
    canonicalPath: "/index.html",
  },
);

cpSync(katexDist, katexOut, { recursive: true });

writeFileSync(join(root, "sitemap.xml"), renderSitemap(sitemapPaths));
writeFileSync(
  join(root, "robots.txt"),
  `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl("/sitemap.xml")}\n`,
);

const totalPages = [...parsedByCourse.values()].reduce((sum, parsed) => sum + parsed.length, 0);
console.log(
  `Wrote index.html, sitemap.xml, robots.txt, ${COURSES.length} course page(s), and ${totalPages} lecture page(s)`,
);

function writePage(
  path: string,
  title: string,
  prefixes: { assetPrefix: string; coursePrefix: string },
  content: string,
  seo: PageSeo,
): void {
  const resolvedContent = content
    .replaceAll("{{ASSET_PREFIX}}", prefixes.assetPrefix)
    .replaceAll("{{COURSE_PREFIX}}", prefixes.coursePrefix);
  const canonicalUrl = seo.canonicalPath ? siteUrl(seo.canonicalPath) : "";
  const publicPath = seo.canonicalPath ?? `/${path.slice(root.length + 1).replaceAll("\\", "/")}`;
  const ogUrl = siteUrl(publicPath);
  const canonicalTag = canonicalUrl
    ? `<link rel="canonical" href="${escapeHtml(canonicalUrl)}">`
    : "";
  const robotsTag = seo.robots
    ? `<meta name="robots" content="${escapeHtml(seo.robots)}">`
    : "";
  const description = escapeHtml(seo.description);
  const page = template
    .replaceAll("{{ASSET_PREFIX}}", prefixes.assetPrefix)
    .replaceAll("{{TITLE}}", escapeHtml(title))
    .replaceAll("{{META_DESCRIPTION}}", description)
    .replace("{{CANONICAL}}", canonicalTag)
    .replace("{{ROBOTS}}", robotsTag)
    .replaceAll("{{OG_URL}}", escapeHtml(ogUrl))
    .replace("{{CONTENT}}", resolvedContent);
  writeFileSync(path, page);
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

function renderSiteHome(): string {
  const items = COURSES.map(
    (course) =>
      `<li><a href="courses/${course.id}/index.html"><strong>MIT ${escapeHtml(course.title)}</strong> — ${escapeHtml(course.subtitle)}</a></li>`,
  ).join("\n");

  return `<h1>${escapeHtml(SITE_PAGE_TITLE)}</h1>
<ul class="note-list">
${items}
</ul>`;
}

function renderCourseHome(
  course: (typeof COURSES)[number],
  parsed: ParsedNote[],
  assetPrefix: string,
  preamble: string,
  courseRoot: string,
): string {
  const nav = `<nav class="site-nav"><a href="${assetPrefix}index.html">Home</a></nav>`;
  const allLink = `<p class="all-link"><a href="all.html">Read all lectures</a></p>`;
  const tocParts = getTocParts(course.id);
  const tocHtml = tocParts
    ? renderCourseTocWithParts(parsed, tocParts, preamble, courseRoot)
    : renderCourseTocFlat(parsed, preamble, courseRoot);

  return `${nav}<header class="lecture-header"><h1>MIT ${escapeHtml(course.title)}</h1><p class="lecture-title">${escapeHtml(course.subtitle)}</p></header>
${allLink}
${tocHtml}`;
}

function renderLectureTocEntry(
  note: Note,
  titleHtml: string,
  preamble: string,
  courseRoot: string,
): string {
  const pageUrl = `notes-html/${lectureSlug(note.lectures)}.html`;
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

function renderCourseAll(
  course: (typeof COURSES)[number],
  parsed: ParsedNote[],
  assetPrefix: string,
): string {
  const nav = `<nav class="site-nav"><a href="${assetPrefix}index.html">Home</a> · <a href="index.html">${escapeHtml(course.title)}</a></nav>`;
  const pageHeader = `<header class="lecture-header"><h1>MIT ${escapeHtml(course.title)} — All lectures</h1><p class="lecture-title">${escapeHtml(course.subtitle)}</p></header>`;
  const sections = parsed
    .map(
      ({ note, result, titleHtml }) =>
        `<section class="lecture">${lectureHeaderHtml(note, course.title, titleHtml)}${result.html}</section>`,
    )
    .join("\n");

  return `${nav}${pageHeader}\n<hr class="all-lectures-divider">\n${sections}`;
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// Remove legacy single-course output from repo root.
for (const legacy of ["all.html", join("notes-html")]) {
  const path = join(root, legacy);
  if (existsSync(path)) rmSync(path, { recursive: true, force: true });
}
