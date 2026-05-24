import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  formatLectureLabel,
  lectureHeaderHtml,
  lecturePageTitle,
  lectureSlug,
  loadNotes,
  type Note,
} from "./notes.js";
import { parseTex } from "./parser.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const notesDir = join(root, "notes");
const preamblePath = join(root, "preamble.tex");
const templatePath = join(root, "template.html");
const katexDist = join(root, "node_modules/katex/dist");
const katexOut = join(root, "katex");
const notesOutDir = join(root, "notes-html");

const COURSE = "6.1220 Notes";

const preamble = existsSync(preamblePath) ? readFileSync(preamblePath, "utf8") : "";
const template = readFileSync(templatePath, "utf8");
const notes = loadNotes(notesDir);

mkdirSync(notesOutDir, { recursive: true });

const parsed = notes.map((note) => ({
  note,
  result: parseTex(note.source, preamble, root),
}));

for (const { note, result } of parsed) {
  const pageTitle = lecturePageTitle(note);
  const nav = `<nav class="site-nav"><a href="../index.html">Home</a></nav>`;
  const header = lectureHeaderHtml(note);
  writePage(
    join(notesOutDir, `${lectureSlug(note.lectures)}.html`),
    pageTitle,
    "../",
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
  join(root, "index.html"),
  COURSE,
  "",
  renderHome(notes),
);

writePage(
  join(root, "all.html"),
  `All lectures — ${COURSE}`,
  "",
  renderAll(parsed),
);

cpSync(katexDist, katexOut, { recursive: true });

console.log(`Wrote index.html, all.html, and ${parsed.length} lecture page(s)`);

function writePage(
  path: string,
  title: string,
  assetPrefix: string,
  content: string,
): void {
  const resolvedContent = content.replaceAll("{{ASSET_PREFIX}}", assetPrefix);
  const page = template
    .replaceAll("{{ASSET_PREFIX}}", assetPrefix)
    .replace("{{TITLE}}", escapeHtml(title))
    .replace("{{CONTENT}}", resolvedContent);
  writeFileSync(path, page);
}

function renderHome(notes: Note[]): string {
  const items = notes
    .map(
      (note) =>
        `<li><a href="notes-html/${lectureSlug(note.lectures)}.html">${escapeHtml(formatLectureLabel(note.lectures))}: ${escapeHtml(note.title)}</a></li>`,
    )
    .join("\n");

  return `<h1>${escapeHtml(COURSE)}</h1>
<ul class="note-list">
${items}
</ul>
<p class="all-link"><a href="all.html">Read all lectures</a></p>`;
}

function renderAll(
  parsed: { note: Note; result: ReturnType<typeof parseTex> }[],
): string {
  const nav = `<nav class="site-nav"><a href="index.html">Home</a></nav>`;
  const sections = parsed
    .map(
      ({ note, result }) =>
        `<section class="lecture">${lectureHeaderHtml(note)}${result.html}</section>`,
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
