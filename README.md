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
  18.701/
    preamble.tex
    notes/lecture-*.tex
    images/...
```

Each course has its own preamble, notes, and images. The site home page lists courses; each course has its own index, all-lectures page, and per-lecture HTML under `courses/<id>/notes-html/`.

## Local development

```bash
npm install
npm run build    # one-off build
npm run watch    # rebuild when notes change
```

Open `index.html` in a browser, or serve the repo root with any static file server.

## Deploy (GitHub Pages)

Pushes to `main` deploy via GitHub Actions. In repo settings, set **Pages → Source** to **GitHub Actions**.

## Adding a course

1. Create `courses/<course-id>/` with `preamble.tex`, `notes/`, and `images/`.
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
