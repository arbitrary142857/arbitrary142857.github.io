# arbitrary142857.github.io

MIT 6.1220 lecture notes, built as a static site.

Live site: [https://arbitrary142857.github.io/](https://arbitrary142857.github.io/)

## Local development

```bash
npm install
npm run build    # one-off build
npm run watch    # rebuild when notes change
```

Open `index.html` in a browser, or serve the repo root with any static file server.

## Deploy (GitHub Pages)

The site is **not** served from this README. GitHub Actions builds the HTML and deploys it.

### One-time setup

1. Open [Settings → Pages](https://github.com/arbitrary142857/arbitrary142857.github.io/settings/pages).
2. Under **Build and deployment**, set **Source** to **GitHub Actions** (not “Deploy from a branch”).
3. Go to [Actions](https://github.com/arbitrary142857/arbitrary142857.github.io/actions), open **Deploy to GitHub Pages**, and click **Re-run all jobs**.

If Source is left on “Deploy from a branch”, GitHub will render this README with Jekyll instead of the built notes site.

### After setup

Pushes to `main` deploy automatically.
