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
import { parseTex, renderInlineFragment, titlePlainText } from "./parser.js";

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

for (const course of COURSES) {
  const courseRoot = courseDir(root, course.id);
  const notesDir = courseNotesDir(root, course.id);
  const preamblePath = coursePreamblePath(root, course.id);
  const preamble = existsSync(preamblePath) ? readFileSync(preamblePath, "utf8") : "";
  const notes = loadNotes(notesDir, course.id);
  const parsed = notes.map((note) => ({
    note,
    result: parseTex(note.source, preamble, courseRoot, "images"),
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
    const pageTitle = lecturePageTitle(note, titlePlain);
    const nav = `<nav class="site-nav"><a href="${lectureNavHomePrefix}index.html">Home</a> · <a href="${lectureNavCoursePrefix}index.html">${escapeHtml(course.title)}</a></nav>`;
    const header = lectureHeaderHtml(note, titleHtml);
    writePage(
      join(notesOutDir, `${lectureSlug(note.lectures)}.html`),
      pageTitle,
      { assetPrefix: "../../../", coursePrefix: "../" },
      `${nav}${header}\n${result.html}`,
    );
  }

  const activeSlugs = new Set(parsed.map(({ note }) => lectureSlug(note.lectures)));
  for (const file of readdirSync(notesOutDir)) {
    if (!file.endsWith(".html")) continue;
    const slug = file.slice(0, -".html".length);
    if (!activeSlugs.has(slug)) {
      unlinkSync(join(notesOutDir, file));
    }
  }

  writePage(
    join(siteDir, "index.html"),
    coursePageTitle(course.title, course.subtitle),
    { assetPrefix, coursePrefix: "" },
    renderCourseHome(course, parsed, assetPrefix),
  );

  writePage(
    join(siteDir, "all.html"),
    `All lectures — ${coursePageTitle(course.title, course.subtitle)}`,
    { assetPrefix, coursePrefix: "" },
    renderCourseAll(course, parsed, assetPrefix),
  );
}

writePage(
  join(root, "index.html"),
  "Course Notes",
  { assetPrefix: "", coursePrefix: "" },
  renderSiteHome(),
);

cpSync(katexDist, katexOut, { recursive: true });

const totalPages = [...parsedByCourse.values()].reduce((sum, parsed) => sum + parsed.length, 0);
console.log(
  `Wrote index.html, ${COURSES.length} course page(s), and ${totalPages} lecture page(s)`,
);

function writePage(
  path: string,
  title: string,
  prefixes: { assetPrefix: string; coursePrefix: string },
  content: string,
): void {
  const resolvedContent = content
    .replaceAll("{{ASSET_PREFIX}}", prefixes.assetPrefix)
    .replaceAll("{{COURSE_PREFIX}}", prefixes.coursePrefix);
  const page = template
    .replaceAll("{{ASSET_PREFIX}}", prefixes.assetPrefix)
    .replace("{{TITLE}}", escapeHtml(title))
    .replace("{{CONTENT}}", resolvedContent);
  writeFileSync(path, page);
}

function renderSiteHome(): string {
  const items = COURSES.map(
    (course) =>
      `<li><a href="courses/${course.id}/index.html"><strong>${escapeHtml(course.title)}</strong> — ${escapeHtml(course.subtitle)}</a></li>`,
  ).join("\n");

  return `<h1>Course Notes</h1>
<ul class="note-list">
${items}
</ul>`;
}

function renderCourseHome(
  course: (typeof COURSES)[number],
  parsed: ParsedNote[],
  assetPrefix: string,
): string {
  const nav = `<nav class="site-nav"><a href="${assetPrefix}index.html">Home</a></nav>`;
  const items = parsed
    .map(
      ({ note, titleHtml }) =>
        `<li><a href="notes-html/${lectureSlug(note.lectures)}.html">${escapeHtml(formatLectureLabel(note.lectures))}: ${titleHtml}</a></li>`,
    )
    .join("\n");

  return `${nav}<header class="lecture-header"><h1>${escapeHtml(course.title)}</h1><p class="lecture-title">${escapeHtml(course.subtitle)}</p></header>
<ul class="note-list lecture-list">
${items}
</ul>
<p class="all-link"><a href="all.html">Read all lectures</a></p>`;
}

function renderCourseAll(
  course: (typeof COURSES)[number],
  parsed: ParsedNote[],
  assetPrefix: string,
): string {
  const nav = `<nav class="site-nav"><a href="${assetPrefix}index.html">Home</a> · <a href="index.html">${escapeHtml(course.title)}</a></nav>`;
  const sections = parsed
    .map(
      ({ note, result, titleHtml }) =>
        `<section class="lecture">${lectureHeaderHtml(note, titleHtml)}${result.html}</section>`,
    )
    .join("\n");

  return `${nav}${sections}`;
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
