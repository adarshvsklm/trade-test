# trade-test

A tiny static demo site, deployed automatically to **GitHub Pages**.

🌐 **Live URL:** https://adarshvsklm.github.io/trade-test/

## What's here

- `index.html` — landing page
- `styles.css` — styling (modern, responsive, dark theme)
- `app.js` — small client-side ticker
- `.github/workflows/deploy.yml` — GitHub Actions workflow that publishes the site to GitHub Pages on every push to `main`

## One-time setup

After this branch is merged into `main`, enable GitHub Pages once:

1. Go to **Settings → Pages** in this repository.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. Push to `main` (or re-run the `Deploy static site to GitHub Pages` workflow from the **Actions** tab).

The site will then be live at the URL above. Subsequent pushes to `main` will re-deploy automatically.

## Local preview

Open `index.html` in a browser, or run any static server in the repo root:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```
