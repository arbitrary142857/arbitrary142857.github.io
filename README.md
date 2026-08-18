# arbitrary142857.github.io

MIT course notes, built as static HTML from LaTeX.

Live site: [https://arbitrary142857.github.io/](https://arbitrary142857.github.io/)

## Layout

```
courses/
  6.1220/
    preamble.tex
    notes/lecture-*.tex
    images/lecture-NN/...
    audio/lecture-NN/...
  18.701/
    preamble.tex
    notes/lecture-*.tex
    images/...
```

Each course has its own preamble, notes, images, and audio. `courses/` holds only sources; the build assembles the entire publishable site into `dist/` (gitignored) and copies each course's `images/` and `audio/` alongside its pages.

URLs are:

| Page | URL | Generated file |
| --- | --- | --- |
| Site home | `/` | `dist/index.html` |
| Course TOC | `/18.701/` | `dist/18.701/index.html` |
| Lecture | `/18.701/lectures/1/` | `dist/18.701/lectures/1/index.html` |

Every link in the generated HTML — and every internal `\href` in the notes — is root-relative (`/18.701/lectures/1/#anchor`), so no page depends on its own directory depth. Cross-course links use the same form.

### Images and audio in notes

Images use `\includegraphics` (extension optional if a matching file exists under `images/`):

```tex
\includegraphics[width=0.4\textwidth]{lecture-15/spectrogram}
```

Audio uses `\includeaudio` with the same path convention under `audio/`:

```tex
\includeaudio[width=0.6\textwidth]{lecture-15/sound}
```

Omit the extension when a unique match exists (`.wav`, `.mp3`, `.ogg`, etc.). Optional `\graphicspath` and `\audiopath` in the preamble override the default directories.

## Local development

```bash
npm install
npm run build    # one-off build
npm run watch    # rebuild when notes change
```

The dev loop is two processes side by side:

1. `npm run watch` — rebuilds `dist/` whenever a `.tex`, image, template, or `src/` file changes.
2. A static server rooted at `dist/` — VS Code Live Server with `"liveServer.settings.root": "/dist"` (click **Go Live**, then browse `http://127.0.0.1:5501/`), or `npx serve dist` if you don't want the extension.

Live Server must be stopped and restarted after changing its root setting; it does not pick that up while running. Use **Go Live** and navigate from `/` rather than right-clicking a file — files under `courses/` are outside the server root.

Opening a generated file directly via `file://` will not work: links are root-relative and need a server root.

The build rewrites `dist/` in place instead of wiping it, writing only files whose content actually changed and pruning anything it no longer produces. That keeps the served tree valid at every instant (no 404 mid-rebuild) and means one edit triggers one reload. Each build prints how many files changed. If assets ever look stale, `rm -rf dist && npm run build` is the reset.

## Deploy (GitHub Pages)

Pushes to `main` deploy via GitHub Actions. In repo settings, set **Pages → Source** to **GitHub Actions**.

The workflow runs `npm run build` and publishes `dist/` as-is, so the deployed tree is exactly what a local build produces. Note that `.tex` sources are not copied into `dist/` and so are not served by the site.

The build also writes `sitemap.xml` and `robots.txt` at the site root (canonical URLs use `SITE_ORIGIN` in `src/site.ts`). Submit the sitemap in [Google Search Console](https://search.google.com/search-console) under **Sitemaps** → `https://arbitrary142857.github.io/sitemap.xml`.

## Adding a course

1. Create `courses/<course-id>/` with `preamble.tex`, `notes/`, `images/`, and `audio/` as needed.
2. Add an entry to `COURSES` in `src/courses.ts`.
3. Run `npm run build`.

Use `\lecture{N}` or `\lectures{N,M}` in note file headers, as before.

## Course table of contents (parts)

For a multi-part TOC (e.g. 18.701’s six units), edit `courses/<course-id>/toc-sections.ts`:

```ts
export const TOC_PARTS = [
  { title: "Groups", from: 1, to: 4 },
  // ...
];
```

Register the file in `src/toc-sections.ts` (`TOC_PARTS_BY_COURSE`). Courses without an entry keep a flat lecture list.
