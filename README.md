# Davis Thinks

A field reference and AI assistant for aircraft mechanics, organized around the real hierarchy of approved maintenance data under 14 CFR 43.13(a): manufacturer manual/ICA first, AC 43.13 only as a fallback, plus an Airworthiness Directive log, a chapter-by-chapter AC 43.13 browser, and a place to save photos of the manual page you're actually working from.

## What's in here

- `src/` — the React app (Vite)
- `netlify/functions/chat.js` — a serverless function that calls the Claude API, keeping your API key off the client
- `netlify.toml` — build + redirect config for Netlify

The in-app "Ask Assistant" feature needs a Claude API key (see step 3 below). Everything else works with no setup.

## 1. Push to GitHub

```bash
cd davis-thinks
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

(Create the empty repo on GitHub first if you haven't — github.com/new.)

## 2. Connect it to Netlify

1. Go to [app.netlify.com](https://app.netlify.com) and click **Add new site → Import an existing project**.
2. Choose GitHub and select this repository.
3. Build settings should auto-fill from `netlify.toml`:
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Functions directory: `netlify/functions`
4. Click **Deploy**.

## 3. Add your Anthropic API key

The assistant tab calls Anthropic's API through the included serverless function, which needs your own API key (get one at [console.anthropic.com](https://console.anthropic.com)):

1. In Netlify: **Site settings → Environment variables → Add a variable**.
2. Key: `ANTHROPIC_API_KEY`
3. Value: your API key (starts with `sk-ant-...`)
4. Save, then **redeploy** the site (Deploys tab → Trigger deploy) so the function picks up the new variable.

Without this variable set, the rest of the app (AD tracker, AC 43.13 library, manual photos) still works fully — only the chat assistant will show an error.

## Local development

```bash
npm install
npm run dev
```

This runs the UI on its own, but `/.netlify/functions/chat` won't exist yet — the assistant tab will error locally unless you also run it through the Netlify CLI:

```bash
npm install -g netlify-cli
netlify dev
```

`netlify dev` proxies the Vite dev server and serves the function together, so the assistant works locally too. Create a `.env` file (already gitignored) with `ANTHROPIC_API_KEY=sk-ant-...` for local testing.

## Notes

- Aircraft info, the AD log, and manual photos are stored in the browser's `localStorage` — per-device, not synced across users or devices.
- This app is a reference tool only. It is not approved maintenance data. All actual maintenance must follow 14 CFR 43.13 and the applicable manufacturer manual or ICA.
