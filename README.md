# MedPortal UI branch

## Run frontend

```bash
git checkout ui
cd react
npm install
cp .env.example .env
npm run dev
```

## Pages

- Login: http://localhost:5173/?view=login
- Poster Studio: http://localhost:5173/?view=doctor
- Admin: http://localhost:5173/admin

Admin login: `admin` / `admin123` (requires backend running)

## Backend (for admin + live data)

```bash
cd react/server
npm install
npm run dev
```

Set `VITE_API_BASE_URL=http://localhost:3000/api` in `react/.env`.
