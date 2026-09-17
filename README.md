# Frontend-only UI branch (no backend required)

This branch has only the React frontend. Login, poster studio, and admin work locally with no API, server, or database.

## Run

```bash
git checkout ui
cd react
npm install
npm run dev
```

## Pages

- Login: http://localhost:5173/?view=login
- Poster Studio: http://localhost:5173/?view=doctor
- Admin (DataTables): http://localhost:5173/admin

Enter any numeric employee ID (e.g. `12345`) on login to continue into Poster Studio.

Admin uses one DataTable with **ID, Name, Contact Number, Logo, Poster**, and **Edit / Delete in the same row**.
