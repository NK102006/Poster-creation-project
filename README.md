# MedPortal Frontend (UI branch)

Frontend-only branch for UI work. No backend required.

## Setup

```bash
git checkout ui
cd react
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:5173`.

## UI-only mode

`.env` sets `VITE_UI_ONLY=true`, so login and doctor APIs are mocked locally.

- Enter any valid employee ID on the login screen to continue.
- Poster studio UI works without MongoDB or the Express server.

To point at a real API later, set `VITE_UI_ONLY=false` and configure `VITE_API_BASE_URL`.
