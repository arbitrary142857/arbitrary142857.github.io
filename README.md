# arbitrary142857.github.io

MIT 6.1220 lecture notes, built as a static site.

## Local development

```bash
npm install
npm run build    # one-off build
npm run watch    # rebuild when notes change
```

Open `index.html` in a browser, or serve the repo root with any static file server.

## Deploy

Pushes to `main` deploy automatically via GitHub Actions to [https://arbitrary142857.github.io/](https://arbitrary142857.github.io/).

In the repo settings, set **Pages → Build and deployment → Source** to **GitHub Actions**.
