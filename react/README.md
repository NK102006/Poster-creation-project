# MedPortal Frontend

React + Vite frontend for MedPortal (login, doctor details, poster generator).

## Setup

```bash
cd react
npm install
cp .env.example .env
npm run dev
```

Open the local URL Vite prints (usually `http://localhost:5173`).

## Notes

- Configure the API base URL in `react/.env` (`VITE_API_BASE_URL`).

## Backend

```bash
cd react/server
npm install
npm start
```

- Requires Node.js 22.13+ (uses the built-in `node:sqlite` module — no database server to install).
- Data is stored in `react/server/data/poster-creation.db`, created on first start along with the
  default doctor fields, poster categories and themes. Set `SQLITE_PATH` in `server/.env` to use another file.
- Schema and queries live in `server/db.js`. To back up, copy the `.db` file while the server is stopped.
