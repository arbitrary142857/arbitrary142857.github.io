import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { extractBracedCommand } from "./tex-read.js";

export interface NoteMeta {
  courseId: string;
  lectures: number[];
  title: string;
  filename: string;
}

export interface Note extends NoteMeta {
  source: string;
}

export function loadNotes(notesDir: string, courseId: string): Note[] {
  const files = readdirSync(notesDir)
    .filter((name) => name.endsWith(".tex"))
    .sort();

  const notes = files.map((filename) => {
    const source = readFileSync(join(notesDir, filename), "utf8");
    const meta = extractNoteMeta(source, filename);
    return { ...meta, courseId, source, filename };
  });

  return notes.sort((a, b) => a.lectures[0] - b.lectures[0]);
}

export function extractNoteMeta(source: string, filename: string): Omit<NoteMeta, "courseId"> {
  const header = source.includes("\\begin{document}")
    ? source.slice(0, source.indexOf("\\begin{document}"))
    : source.slice(0, 500);

  const title =
    extractBracedCommand(header, "title") ||
    formatLectureLabel(parseLecturesFromFilename(filename));

  const lectures =
    parseLecturesFromHeader(header) ?? parseLecturesFromFilename(filename);

  return { lectures, title, filename };
}

function parseLecturesFromHeader(header: string): number[] | null {
  const lecturesMatch = header.match(/\\lectures\{([^}]*)\}/);
  if (lecturesMatch) {
    const parsed = lecturesMatch[1]
      .split(",")
      .map((part) => Number.parseInt(part.trim(), 10))
      .filter((n) => !Number.isNaN(n));
    return parsed.length > 0 ? parsed : null;
  }

  const lectureMatch = header.match(/\\lecture\{(\d+)\}/);
  if (lectureMatch) {
    return [Number.parseInt(lectureMatch[1], 10)];
  }

  return null;
}

function parseLecturesFromFilename(filename: string): number[] {
  const rangeMatch = filename.match(/lecture-(\d+)-(\d+)\.tex$/);
  if (rangeMatch) {
    return [
      Number.parseInt(rangeMatch[1], 10),
      Number.parseInt(rangeMatch[2], 10),
    ];
  }

  const singleMatch = filename.match(/lecture-(\d+)\.tex$/);
  if (singleMatch) {
    return [Number.parseInt(singleMatch[1], 10)];
  }

  return [0];
}

export function lectureSlug(lectures: number[]): string {
  if (lectures.length === 1) return String(lectures[0]);
  return `${lectures[0]}-${lectures[lectures.length - 1]}`;
}

export function formatLectureLabel(lectures: number[]): string {
  if (lectures.length === 0) return "Lecture";
  if (lectures.length === 1) return `Lecture ${lectures[0]}`;

  const consecutive = lectures.every(
    (n, index) => index === 0 || n === lectures[index - 1] + 1,
  );
  if (consecutive) {
    return `Lectures ${lectures[0]}\u2013${lectures[lectures.length - 1]}`;
  }

  if (lectures.length === 2) {
    return `Lectures ${lectures[0]} and ${lectures[1]}`;
  }

  const last = lectures[lectures.length - 1];
  const rest = lectures.slice(0, -1).join(", ");
  return `Lectures ${rest}, and ${last}`;
}

export function mitCourseNumber(courseNumber: string): string {
  return `MIT ${courseNumber}`;
}

export function coursePageTitle(courseNumber: string, courseSubtitle: string): string {
  return `${mitCourseNumber(courseNumber)} — ${courseSubtitle}`;
}

export function lecturePageTitle(
  note: NoteMeta,
  courseNumber: string,
  titlePlain = note.title,
): string {
  return `${mitCourseNumber(courseNumber)} ${formatLectureLabel(note.lectures)}: ${titlePlain}`;
}

export function lectureHeaderHtml(
  note: NoteMeta,
  courseNumber: string,
  titleHtml: string,
): string {
  return `<header class="lecture-header"><h1>${escapeHtml(mitCourseNumber(courseNumber))} — ${escapeHtml(formatLectureLabel(note.lectures))}</h1><p class="lecture-title">${titleHtml}</p></header>`;
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
