# MedStrip web

React front end for MedStrip. It runs fully in mock mode today: `src/engine.js`
pretends to be your Spring Boot apps, Kafka, Redis, S3, openFDA and the agents.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

Needs Node 18 or newer.

## Files

| File | What it is |
|---|---|
| `src/main.jsx` | Starts React |
| `src/App.jsx` | The 7 screens: Overview, Cabinet, Add medicine, Cabinet review, Ask, Approvals, Activity |
| `src/ui.jsx` | Shared pieces: icons, pills, strip art, cards |
| `src/engine.js` | Mock backend and sample data. Replace this step by step |
| `src/styles.css` | All styles, light and dark theme |

## Moving from mock to your real API

Do it one feature at a time, following the roadmap:

1. Pick one function in `engine.js` (start with the cabinet).
2. Replace its body with a `fetch("/api/...")` call to `medstrip-api`.
3. The Vite dev server forwards `/api` to `http://localhost:8080` (see `vite.config.js`).
4. Keep the rest on mock data until you build it.

Sample data only. Not medical advice.
