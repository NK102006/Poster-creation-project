const STORAGE_KEY = 'medportal_admin_doctors';

const PLACEHOLDER_LOGO =
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
      <rect width="80" height="80" rx="40" fill="#24473e"/>
      <circle cx="40" cy="32" r="14" fill="#c6a46a"/>
      <ellipse cx="40" cy="62" rx="22" ry="14" fill="#c6a46a"/>
    </svg>`
  );

const PLACEHOLDER_POSTER =
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="90" viewBox="0 0 60 90">
      <rect width="60" height="90" rx="6" fill="#1b3831"/>
      <rect x="8" y="10" width="44" height="28" rx="4" fill="#c6a46a" opacity="0.85"/>
      <rect x="12" y="48" width="36" height="6" rx="2" fill="#f3ebe0" opacity="0.7"/>
      <rect x="12" y="60" width="28" height="4" rx="2" fill="#f3ebe0" opacity="0.45"/>
    </svg>`
  );

function createId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(12)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const SEED = [
  {
    id: '6aabc8dbb86bcb679f17692a',
    name: 'Dr. Prem Limbachiya',
    contactnumber: '9876543210',
    logo: PLACEHOLDER_LOGO,
    poster: PLACEHOLDER_POSTER,
  },
  {
    id: '6aaa8078c932f19ffc17704f',
    name: 'Dr. Ananya Shah',
    contactnumber: '9123456780',
    logo: PLACEHOLDER_LOGO,
    poster: PLACEHOLDER_POSTER,
  },
  {
    id: '7bb1c0eed44ad20aae28815b',
    name: 'Dr. Rohan Mehta',
    contactnumber: '9988776655',
    logo: PLACEHOLDER_LOGO,
    poster: null,
  },
];

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // fall through to seed
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED));
  return [...SEED];
}

function writeAll(rows) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  return rows;
}

export function listDoctors() {
  return readAll();
}

export function createDoctor(payload) {
  const rows = readAll();
  const next = {
    id: createId(),
    name: payload.name?.trim() || '',
    contactnumber: String(payload.contactnumber || '').trim(),
    logo: payload.logo || PLACEHOLDER_LOGO,
    poster: payload.poster || null,
  };
  rows.unshift(next);
  writeAll(rows);
  return next;
}

export function updateDoctor(id, payload) {
  const rows = readAll();
  const index = rows.findIndex((row) => row.id === id);
  if (index < 0) return null;

  rows[index] = {
    ...rows[index],
    name: payload.name?.trim() ?? rows[index].name,
    contactnumber: String(payload.contactnumber ?? rows[index].contactnumber).trim(),
    logo: payload.logo !== undefined ? payload.logo : rows[index].logo,
    poster: payload.poster !== undefined ? payload.poster : rows[index].poster,
  };
  writeAll(rows);
  return rows[index];
}

export function deleteDoctor(id) {
  const rows = readAll().filter((row) => row.id !== id);
  writeAll(rows);
  return true;
}

export { PLACEHOLDER_LOGO, PLACEHOLDER_POSTER };
