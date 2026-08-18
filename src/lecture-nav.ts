import { formatLectureLabel, lectureSlug, type NoteMeta } from "./notes.js";

/** Customize lecture footer labels here. */
export const LECTURE_NAV = {
  nextArrow: "→",
} as const;

export interface LectureNavEntry {
  note: NoteMeta;
  titleHtml: string;
}

export function buildLectureNumberMap(notes: NoteMeta[]): Map<number, string> {
  const map = new Map<number, string>();
  for (const note of notes) {
    const slug = lectureSlug(note.lectures);
    for (const lecture of note.lectures) {
      map.set(lecture, slug);
    }
  }
  return map;
}

function buildLectureTitleHtmlMap(entries: LectureNavEntry[]): Map<number, string> {
  const map = new Map<number, string>();
  for (const { note, titleHtml } of entries) {
    for (const lecture of note.lectures) {
      map.set(lecture, titleHtml);
    }
  }
  return map;
}

function previewTemplate(label: string, titleHtml: string): string {
  return `<template class="lecture-nav-preview-tpl">${renderPreviewHtml(label, titleHtml)}</template>`;
}

function renderPreviewHtml(label: string, titleHtml: string): string {
  return `<span class="lecture-nav-preview-label">${escapeHtml(label)}</span><span class="lecture-nav-preview-sep">:</span> <span class="lecture-nav-preview-title">${titleHtml}</span>`;
}

function renderNextButton(note: NoteMeta, titleHtml: string, href: string): string {
  const label = formatLectureLabel(note.lectures);
  const body = `<span class="lecture-nav-btn-body"><span class="lecture-nav-btn-label">${escapeHtml(label)}</span><span class="lecture-nav-btn-title">${titleHtml}</span></span>`;
  const arrow = `<span class="lecture-nav-btn-arrow">${escapeHtml(LECTURE_NAV.nextArrow)}</span>`;
  return `<a class="lecture-nav-btn lecture-nav-next" href="${href}" rel="next">${body}${arrow}${previewTemplate(label, titleHtml)}</a>`;
}

/** Root-relative URL of a lecture page, so nav links are depth-independent. */
function lectureHref(courseId: string, slug: string): string {
  return `/${courseId}/lectures/${slug}/`;
}

export function lectureNavHtml(entries: LectureNavEntry[], current: NoteMeta): string {
  const notes = entries.map((entry) => entry.note);
  const courseId = current.courseId;

  const sorted = [...entries].sort((a, b) => a.note.lectures[0] - b.note.lectures[0]);
  const currentIndex = sorted.findIndex(
    (entry) => lectureSlug(entry.note.lectures) === lectureSlug(current.lectures),
  );
  const next =
    currentIndex >= 0 && currentIndex < sorted.length - 1
      ? sorted[currentIndex + 1]
      : null;

  const numberMap = buildLectureNumberMap(notes);
  const titleHtmlMap = buildLectureTitleHtmlMap(entries);
  const numbers = [...numberMap.keys()].sort((a, b) => a - b);
  const currentNumbers = new Set(current.lectures);
  const currentLabel = formatLectureLabel(current.lectures);
  const titleHtmlByNote = new Map(
    entries.map((entry) => [lectureSlug(entry.note.lectures), entry.titleHtml] as const),
  );
  const currentTitleHtml =
    titleHtmlByNote.get(lectureSlug(current.lectures)) ?? escapeHtml(current.title);
  const currentPreview = renderPreviewHtml(currentLabel, currentTitleHtml);

  const numberLinks = numbers
    .map((num) => {
      const slug = numberMap.get(num)!;
      const label = `Lecture ${num}`;
      const titleHtml = titleHtmlMap.get(num) ?? "";
      const tpl = previewTemplate(label, titleHtml);
      if (currentNumbers.has(num)) {
        return `<span class="lecture-nav-num is-current" aria-current="page">${tpl}${num}</span>`;
      }
      return `<a class="lecture-nav-num" href="${lectureHref(courseId, slug)}">${tpl}${num}</a>`;
    })
    .join("\n");

  const nextHtml = next
    ? renderNextButton(next.note, next.titleHtml, lectureHref(courseId, lectureSlug(next.note.lectures)))
    : "";

  const navClass = next ? "lecture-nav" : "lecture-nav is-final";

  return `<nav class="${navClass}" aria-label="Lecture navigation">
<div class="lecture-nav-preview" aria-live="polite">${currentPreview}</div>
<div class="lecture-nav-main">
<div class="lecture-nav-lectures" aria-label="All lectures">
${numberLinks}
</div>
${nextHtml}
</div>
</nav>`;
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
