# html/

Standalone static version of the app — plain HTML, CSS, and JS. No build step,
no backend. Open `index.html` directly or serve the folder with any static
host:

    npx serve html
    # or
    python3 -m http.server -d html 8080

Pages:
- `index.html` — landing
- `signup.html` / `login.html` — local-only auth (stored in `localStorage`)
- `dashboard.html` — upload a video/image, pick expiry + max views, get a share link
- `view.html?s=<slug>` — public viewer with view-cap, expiry, and a Report button

This is a demo mirror of the main React app in `src/routes/`. It does NOT talk
to Lovable Cloud — uploads live in the browser's `localStorage` only and are
not shareable across devices. Use the React app for real sharing.
