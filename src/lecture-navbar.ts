/** Customize top lecture navbar here. */
export const LECTURE_NAVBAR = {
  toggleLabel: "Show section navigation",
  toggleLabelOpen: "Hide section navigation",
  /** Whether the navigation panel starts expanded on page load. */
  defaultOpen: false,
} as const;

const NAVBAR_TOGGLE_ICON =
  '<svg class="lecture-navbar-toggle-icon" width="20" height="20" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path fill="currentColor" d="M2 3.25h12v1.5H2zm0 4.25h12v1.5H2zm0 4.25h12v1.5H2z"/></svg>';

function renderSiteNav(homeHref: string, courseHref: string, courseTitle: string): string {
  return `<nav class="site-nav lecture-navbar-site-nav" aria-label="Site"><a href="${homeHref}">Home</a> · <a href="${courseHref}">${escapeHtml(courseTitle)}</a></nav>`;
}

export interface LectureNavbarSubsection {
  slug: string;
  titleHtml: string;
}

export interface LectureNavbarOptions {
  homeHref: string;
  courseHref: string;
  courseTitle: string;
  lectureLabel: string;
  subsections: LectureNavbarSubsection[];
}

function stripHtml(html: string): string {
  return html.replaceAll(/<[^>]+>/g, " ").replaceAll(/\s+/g, " ").trim();
}

function renderTimeline(subsections: LectureNavbarSubsection[]): string {
  const markers =
    subsections.length === 0
      ? ""
      : `<div class="lecture-navbar-markers">${subsections
          .map(({ slug, titleHtml }) => {
            const label = stripHtml(titleHtml);
            return `<a class="lecture-navbar-marker" href="#${escapeHtml(slug)}" data-slug="${escapeHtml(slug)}" aria-label="${escapeHtml(label)}"><span class="lecture-navbar-marker-dot" aria-hidden="true"></span></a>`;
          })
          .join("")}</div>`;
  const track = `<div class="lecture-navbar-track"><div class="lecture-navbar-progress" aria-hidden="true"></div>${markers}</div>`;
  const header = `<div class="lecture-navbar-header"><div class="lecture-navbar-track-col">${track}</div></div>`;

  if (subsections.length === 0) {
    return `<div class="lecture-navbar-timeline">${header}</div>`;
  }

  const sections = subsections
    .map(
      ({ slug, titleHtml }) =>
        `<li class="lecture-navbar-section-item" data-slug="${escapeHtml(slug)}"><a class="lecture-navbar-section" href="#${escapeHtml(slug)}" data-slug="${escapeHtml(slug)}"><span class="subsection-marker">§</span> ${titleHtml}</a></li>`,
    )
    .join("\n");

  return `<nav class="lecture-navbar-timeline" aria-label="Lecture sections">
${header}
<ul class="lecture-navbar-sections">
${sections}
</ul>
</nav>`;
}

export function lectureNavbarHtml(options: LectureNavbarOptions): string {
  const { homeHref, courseHref, courseTitle, subsections } = options;
  const siteNav = renderSiteNav(homeHref, courseHref, courseTitle);
  const timeline = renderTimeline(subsections);
  const openClass = LECTURE_NAVBAR.defaultOpen ? " is-open" : "";
  const expanded = LECTURE_NAVBAR.defaultOpen ? "true" : "false";
  const toggleLabel = LECTURE_NAVBAR.defaultOpen
    ? LECTURE_NAVBAR.toggleLabelOpen
    : LECTURE_NAVBAR.toggleLabel;

  const shell = `<div class="lecture-navbar-shell${openClass}" data-toggle-label="${escapeHtml(LECTURE_NAVBAR.toggleLabel)}" data-toggle-label-open="${escapeHtml(LECTURE_NAVBAR.toggleLabelOpen)}">
<button type="button" class="lecture-navbar-toggle" aria-expanded="${expanded}" aria-controls="lecture-navbar-panel" aria-label="${escapeHtml(toggleLabel)}">${NAVBAR_TOGGLE_ICON}</button>
<div class="lecture-navbar-panel" id="lecture-navbar-panel">
${timeline}
</div>
</div>`;

  return `${siteNav}\n${shell}`;
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
