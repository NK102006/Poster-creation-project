// SQLite data layer (relational schema) for the poster portal.
// Uses Node's built-in `node:sqlite` driver, so no native package is needed.
import { DatabaseSync } from 'node:sqlite';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DB_PATH = process.env.SQLITE_PATH
  ? path.resolve(HERE, '..', process.env.SQLITE_PATH)
  : path.join(HERE, 'data', 'poster-creation.db');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
export const db = new DatabaseSync(DB_PATH);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  PRAGMA busy_timeout = 5000;
`);

db.exec(`
CREATE TABLE IF NOT EXISTS admins (
  id          TEXT PRIMARY KEY,
  username    TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password    TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY,
  empid           TEXT NOT NULL UNIQUE,
  password        TEXT NOT NULL,
  owner_admin_id  TEXT REFERENCES admins(id) ON DELETE CASCADE,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_users_owner_admin ON users(owner_admin_id);

CREATE TABLE IF NOT EXISTS doctors (
  id              TEXT PRIMARY KEY,
  owner_user_id   TEXT REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  clinic_name     TEXT NOT NULL DEFAULT '',
  doctor_degree   TEXT NOT NULL DEFAULT '',
  contactnumber   INTEGER,
  logo            TEXT,
  poster          TEXT,
  download_count  INTEGER NOT NULL DEFAULT 0,
  active          INTEGER NOT NULL DEFAULT 1,
  dynamic_fields  TEXT NOT NULL DEFAULT '{}',
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_doctors_owner_user ON doctors(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_doctors_created ON doctors(created_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_doctors_contactnumber ON doctors(contactnumber) WHERE contactnumber IS NOT NULL;

CREATE TABLE IF NOT EXISTS doctor_posters (
  id          TEXT PRIMARY KEY,
  doctor_id   TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  image       TEXT NOT NULL,
  downloads   INTEGER NOT NULL DEFAULT 0,
  kind        TEXT NOT NULL DEFAULT 'education' CHECK (kind IN ('education', 'festival', 'video')),
  label       TEXT NOT NULL DEFAULT '',
  month       TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_doctor_posters_doctor ON doctor_posters(doctor_id, created_at);

CREATE TABLE IF NOT EXISTS poster_templates (
  id               TEXT PRIMARY KEY,
  posterlink       TEXT NOT NULL,
  category         TEXT NOT NULL DEFAULT '',
  color            TEXT NOT NULL DEFAULT '',
  month            TEXT NOT NULL DEFAULT '',
  enabled          INTEGER NOT NULL DEFAULT 1,
  uploaddate       TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published')),
  disabled_fields  TEXT NOT NULL DEFAULT '[]',
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);

-- A doctor field placed on a template. x/y/w/h are fractions (0-1) of the 4:5 poster canvas.
CREATE TABLE IF NOT EXISTS poster_template_fields (
  poster_id  TEXT NOT NULL REFERENCES poster_templates(id) ON DELETE CASCADE,
  position   INTEGER NOT NULL,
  key        TEXT NOT NULL,
  type       TEXT NOT NULL DEFAULT 'text',
  x          REAL NOT NULL,
  y          REAL NOT NULL,
  w          REAL NOT NULL,
  h          REAL NOT NULL,
  color      TEXT NOT NULL DEFAULT '#ffffff',
  align      TEXT NOT NULL DEFAULT 'left' CHECK (align IN ('left', 'center', 'right')),
  shape      TEXT NOT NULL DEFAULT 'rectangle' CHECK (shape IN ('circle', 'rectangle', 'square')),
  PRIMARY KEY (poster_id, key)
);

CREATE TABLE IF NOT EXISTS doctor_fields (
  id           TEXT PRIMARY KEY,
  key          TEXT NOT NULL UNIQUE,
  label        TEXT NOT NULL,
  type         TEXT NOT NULL,
  required     INTEGER NOT NULL DEFAULT 0,
  is_standard  INTEGER NOT NULL DEFAULT 0,
  enabled      INTEGER NOT NULL DEFAULT 1,
  sort_order   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS categories (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL COLLATE NOCASE UNIQUE,
  enabled     INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS superadmin (
  id        TEXT PRIMARY KEY COLLATE NOCASE,
  password  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS themes (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL COLLATE NOCASE UNIQUE,
  slug          TEXT,
  header_bg     TEXT NOT NULL DEFAULT '#1a4f8b',
  footer_bg     TEXT NOT NULL DEFAULT '#143a66',
  accent_color  TEXT NOT NULL DEFAULT '#2b6cb0',
  description   TEXT NOT NULL DEFAULT '',
  card_glow     TEXT NOT NULL DEFAULT 'rgba(26, 79, 139, 0.14)',
  enabled       INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
`);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** 24-char hex ids keep the same shape the frontend already handles. */
export function newId() {
  return crypto.randomBytes(12).toString('hex');
}

export function isValidId(value) {
  return typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value);
}

function nowIso() {
  return new Date().toISOString();
}

function toIso(value) {
  if (value == null || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

const toText = (v) => (v == null ? null : String(v));
const toBool = (v) => (v ? 1 : 0);
const toNum = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const toJson = (fallback) => (v) => JSON.stringify(v ?? fallback);
const fromBool = (v) => v === 1 || v === true;
const fromJson = (fallback) => (v) => {
  try {
    return v == null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
};

export function escapeLike(value) {
  return String(value).replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

const UNIQUE_MESSAGES = {
  'admins.username': 'Admin username already exists',
  'users.empid': 'Employee ID already exists',
  'doctors.contactnumber': 'This mobile number already exists',
  'categories.name': 'Category already exists',
  'themes.name': 'Theme with this name already exists',
  'doctor_fields.key': 'A field with this key already exists',
};

/** Run a write; unique-constraint failures become HTTP 409 errors with a readable message. */
function write(fn) {
  try {
    return fn();
  } catch (error) {
    const match = /UNIQUE constraint failed: ([\w.]+)/.exec(error?.message || '');
    if (match) {
      throw Object.assign(new Error(UNIQUE_MESSAGES[match[1]] || 'Duplicate value'), {
        status: 409,
        code: 'DUPLICATE',
      });
    }
    throw error;
  }
}

export function transaction(fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

/**
 * Table description: `cols` maps the camelCase API property to [column, toDb, fromDb].
 * Gives every table the same insert / update / row-mapping behaviour.
 */
function defineTable(table, cols, { timestamps = true } = {}) {
  const all = { ...cols };
  if (timestamps) {
    all.createdAt = ['created_at', toIso, (v) => v];
    all.updatedAt = ['updated_at', toIso, (v) => v];
  }

  function fromRow(row) {
    if (!row) return null;
    const obj = { _id: row.id };
    for (const [prop, [column, , fromDb]] of Object.entries(all)) {
      obj[prop] = fromDb ? fromDb(row[column]) : row[column];
    }
    return obj;
  }

  function insert(data) {
    const id = data._id || newId();
    const now = nowIso();
    const columns = ['id'];
    const params = [id];
    for (const [prop, [column, toDb]] of Object.entries(all)) {
      let value = data[prop];
      if (timestamps && (prop === 'createdAt' || prop === 'updatedAt') && value == null) value = now;
      if (value === undefined) continue;
      columns.push(column);
      params.push(toDb ? toDb(value) : value);
    }
    write(() => db
      .prepare(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`)
      .run(...params));
    return id;
  }

  function update(id, patch) {
    const sets = [];
    const params = [];
    for (const [prop, [column, toDb]] of Object.entries(all)) {
      if (patch[prop] === undefined || (prop === 'createdAt' && patch[prop] == null)) continue;
      sets.push(`${column} = ?`);
      params.push(toDb ? toDb(patch[prop]) : patch[prop]);
    }
    if (timestamps && patch.updatedAt == null) {
      sets.push('updated_at = ?');
      params.push(nowIso());
    }
    if (!sets.length) return;
    params.push(id);
    write(() => db.prepare(`UPDATE ${table} SET ${sets.join(', ')} WHERE id = ?`).run(...params));
  }

  const byId = (id) => (id ? fromRow(db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(String(id))) : null);
  const remove = (id) => db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(String(id)).changes > 0;
  const count = () => db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;

  return { table, fromRow, insert, update, byId, remove, count };
}

// ---------------------------------------------------------------------------
// Superadmin
// ---------------------------------------------------------------------------

export const Superadmins = {
  findById(id) {
    const value = String(id || '').trim();
    if (!value) return null;
    return db.prepare('SELECT id, password FROM superadmin WHERE id = ?').get(value) || null;
  },
  /** Inserts the account only if that id doesn't exist yet (never overwrites). */
  ensure(id, password) {
    db.prepare('INSERT OR IGNORE INTO superadmin (id, password) VALUES (?, ?)').run(id, password);
  },
};

// ---------------------------------------------------------------------------
// Admins
// ---------------------------------------------------------------------------

const adminTable = defineTable('admins', {
  username: ['username', toText],
  password: ['password', toText],
});

export const Admins = {
  findById: adminTable.byId,
  findByUsername(username) {
    const value = String(username || '').trim();
    if (!value) return null;
    return adminTable.fromRow(db.prepare('SELECT * FROM admins WHERE username = ?').get(value));
  },
  listWithUserCounts() {
    return db.prepare(`
      SELECT a.*, (SELECT COUNT(*) FROM users u WHERE u.owner_admin_id = a.id) AS user_count
      FROM admins a ORDER BY a.created_at DESC
    `).all().map((row) => ({ ...adminTable.fromRow(row), userCount: row.user_count }));
  },
  create(data) {
    return adminTable.byId(adminTable.insert(data));
  },
  update(id, patch) {
    adminTable.update(id, patch);
    return adminTable.byId(id);
  },
  /** Cascades to the admin's employees and their doctors. */
  remove: adminTable.remove,
};

// ---------------------------------------------------------------------------
// Users (employees)
// ---------------------------------------------------------------------------

const userTable = defineTable('users', {
  empid: ['empid', (v) => String(v).trim()],
  password: ['password', toText],
  ownerAdmin: ['owner_admin_id', toText],
});

function userScopeWhere(scope, alias = 'u') {
  if (!scope) return { sql: '0', params: [] };
  if (scope.ownerAdminId) return { sql: `${alias}.owner_admin_id = ?`, params: [String(scope.ownerAdminId)] };
  if (scope.userId) return { sql: `${alias}.id = ?`, params: [String(scope.userId)] };
  return { sql: '1', params: [] };
}

const USER_SORT_COLUMNS = { createdAt: 'u.created_at', empid: 'u.empid' };

export const Users = {
  findById: userTable.byId,
  findByEmpid(empid) {
    const value = String(empid ?? '').trim();
    if (!value) return null;
    return userTable.fromRow(db.prepare('SELECT * FROM users WHERE empid = ?').get(value));
  },
  findForAdmin(userId, adminId) {
    return userTable.fromRow(
      db.prepare('SELECT * FROM users WHERE id = ? AND owner_admin_id = ?').get(String(userId), String(adminId))
    );
  },
  /** Users in scope with their doctor count and owning admin's username. */
  listWithCounts(scope) {
    const where = userScopeWhere(scope);
    return db.prepare(`
      SELECT u.*, a.username AS admin_username,
             (SELECT COUNT(*) FROM doctors d WHERE d.owner_user_id = u.id) AS doctor_count
      FROM users u LEFT JOIN admins a ON a.id = u.owner_admin_id
      WHERE ${where.sql}
      ORDER BY u.created_at DESC
    `).all(...where.params).map((row) => ({
      ...userTable.fromRow(row),
      doctorCount: row.doctor_count,
      adminUsername: row.admin_username || null,
    }));
  },
  /** Paged/searchable list for DataTables. */
  page(scope, { search = '', sortField = 'createdAt', sortDir = 'DESC', offset = 0, limit = 10 } = {}) {
    const scopeWhere = userScopeWhere(scope);
    const conditions = [scopeWhere.sql];
    const params = [...scopeWhere.params];
    if (search) {
      conditions.push("u.empid LIKE ? ESCAPE '\\'");
      params.push(`%${escapeLike(search)}%`);
    }
    const where = conditions.join(' AND ');
    const order = `${USER_SORT_COLUMNS[sortField] || 'u.created_at'} ${sortDir === 'ASC' ? 'ASC' : 'DESC'}`;
    const total = db.prepare(`SELECT COUNT(*) AS n FROM users u WHERE ${scopeWhere.sql}`).get(...scopeWhere.params).n;
    const filtered = db.prepare(`SELECT COUNT(*) AS n FROM users u WHERE ${where}`).get(...params).n;
    const rows = db.prepare(`SELECT u.* FROM users u WHERE ${where} ORDER BY ${order} LIMIT ? OFFSET ?`)
      .all(...params, limit, offset)
      .map(userTable.fromRow);
    return { total, filtered, rows };
  },
  create(data) {
    return userTable.byId(userTable.insert(data));
  },
  update(id, patch) {
    userTable.update(id, patch);
    return userTable.byId(id);
  },
  /** Cascades to the user's doctors and their posters. */
  remove: userTable.remove,
};

// ---------------------------------------------------------------------------
// Doctors and their generated posters
// ---------------------------------------------------------------------------

const doctorTable = defineTable('doctors', {
  ownerUser: ['owner_user_id', toText],
  name: ['name', toText],
  clinicName: ['clinic_name', (v) => String(v ?? '')],
  doctorDegree: ['doctor_degree', (v) => String(v ?? '')],
  contactnumber: ['contactnumber', toNum],
  logo: ['logo', toText],
  poster: ['poster', toText],
  downloadCount: ['download_count', (v) => Number(v) || 0],
  active: ['active', toBool, fromBool],
  dynamicFields: ['dynamic_fields', toJson({}), fromJson({})],
});

const doctorPosterTable = defineTable('doctor_posters', {
  doctorId: ['doctor_id', toText],
  image: ['image', toText],
  downloads: ['downloads', (v) => Number(v) || 0],
  kind: ['kind', (v) => String(v || 'education')],
  label: ['label', (v) => String(v ?? '')],
  month: ['month', (v) => String(v ?? '')],
  createdAt: ['created_at', (v) => toIso(v) || nowIso(), (v) => v],
}, { timestamps: false });

function attachPosters(doctors) {
  if (!doctors.length) return doctors;
  const byDoctor = new Map(doctors.map((d) => [d._id, d]));
  doctors.forEach((d) => { d.posters = []; });
  const ids = [...byDoctor.keys()];
  // Chunk to stay under SQLite's bound-parameter limit.
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500);
    db.prepare(`
      SELECT * FROM doctor_posters WHERE doctor_id IN (${chunk.map(() => '?').join(', ')})
      ORDER BY created_at ASC, rowid ASC
    `).all(...chunk).forEach((row) => {
      const { doctorId, ...poster } = doctorPosterTable.fromRow(row);
      byDoctor.get(doctorId)?.posters.push(poster);
    });
  }
  return doctors;
}

/**
 * Builds the WHERE clause for doctor lists.
 * scope: null (nothing) | {} (all) | { ownerUserId } | { ownerAdminId }
 */
function doctorWhere({ scope = {}, includeInactive = true, search = '', from = null, to = null } = {}) {
  if (!scope) return { sql: '0', params: [] };
  const conditions = [];
  const params = [];
  if (scope.ownerUserId) {
    conditions.push('d.owner_user_id = ?');
    params.push(String(scope.ownerUserId));
  } else if (scope.ownerAdminId) {
    conditions.push('d.owner_user_id IN (SELECT id FROM users WHERE owner_admin_id = ?)');
    params.push(String(scope.ownerAdminId));
  }
  if (!includeInactive) conditions.push('d.active = 1');
  if (search) {
    const like = `%${escapeLike(search)}%`;
    const parts = [
      "d.name LIKE ? ESCAPE '\\'",
      "d.clinic_name LIKE ? ESCAPE '\\'",
      "d.doctor_degree LIKE ? ESCAPE '\\'",
      "CAST(d.contactnumber AS TEXT) LIKE ? ESCAPE '\\'",
    ];
    params.push(like, like, like, like);
    if (isValidId(search)) {
      parts.push('d.id = ?');
      params.push(search.toLowerCase());
    }
    conditions.push(`(${parts.join(' OR ')})`);
  }
  if (from || to) {
    const range = [];
    const rangeParams = [];
    if (from) { range.push('>= ?'); rangeParams.push(from); }
    if (to) { range.push('<= ?'); rangeParams.push(to); }
    const inRange = (column) => range.map((op) => `${column} ${op}`).join(' AND ');
    conditions.push(`((${inRange('d.created_at')}) OR (${inRange('d.updated_at')}) OR EXISTS (
      SELECT 1 FROM doctor_posters p WHERE p.doctor_id = d.id AND ${inRange('p.created_at')}))`);
    params.push(...rangeParams, ...rangeParams, ...rangeParams);
  }
  return { sql: conditions.length ? conditions.join(' AND ') : '1', params };
}

const DOCTOR_SORT_COLUMNS = {
  createdAt: 'd.created_at',
  name: 'd.name COLLATE NOCASE',
  clinicName: 'd.clinic_name COLLATE NOCASE',
  contactnumber: 'd.contactnumber',
  logo: 'd.logo',
  poster: 'd.poster',
};

function insertPosters(doctorId, posters = []) {
  for (const poster of posters) {
    doctorPosterTable.insert({ ...poster, _id: undefined, doctorId, createdAt: poster.createdAt || new Date() });
  }
}

export const Doctors = {
  findById(id) {
    const doctor = doctorTable.byId(id);
    return doctor ? attachPosters([doctor])[0] : null;
  },
  findForUser(doctorId, userId) {
    const doctor = doctorTable.fromRow(
      db.prepare('SELECT * FROM doctors WHERE id = ? AND owner_user_id = ?').get(String(doctorId), String(userId))
    );
    return doctor ? attachPosters([doctor])[0] : null;
  },
  findByContact(contactnumber) {
    const num = toNum(contactnumber);
    if (num == null) return null;
    return doctorTable.fromRow(db.prepare('SELECT * FROM doctors WHERE contactnumber = ?').get(num));
  },
  latestActive() {
    const doctor = doctorTable.fromRow(
      db.prepare('SELECT * FROM doctors WHERE active = 1 ORDER BY created_at DESC LIMIT 1').get()
    );
    return doctor ? attachPosters([doctor])[0] : null;
  },
  count(filter) {
    const where = doctorWhere(filter);
    return db.prepare(`SELECT COUNT(*) AS n FROM doctors d WHERE ${where.sql}`).get(...where.params).n;
  },
  list(filter = {}, { sortField = 'createdAt', sortDir = 'DESC', offset = 0, limit = -1 } = {}) {
    const where = doctorWhere(filter);
    const order = `${DOCTOR_SORT_COLUMNS[sortField] || 'd.created_at'} ${sortDir === 'ASC' ? 'ASC' : 'DESC'}`;
    const rows = db.prepare(`SELECT d.* FROM doctors d WHERE ${where.sql} ORDER BY ${order}, d.rowid DESC LIMIT ? OFFSET ?`)
      .all(...where.params, limit, offset)
      .map(doctorTable.fromRow);
    return attachPosters(rows);
  },
  /** Creates a doctor together with any initial generated posters. */
  create(data, posters = []) {
    const id = transaction(() => {
      const doctorId = doctorTable.insert(data);
      insertPosters(doctorId, posters);
      return doctorId;
    });
    return this.findById(id);
  },
  update(id, patch) {
    doctorTable.update(id, patch);
    return this.findById(id);
  },
  /** Updates the doctor and replaces its whole poster history (CSV import). */
  updateWithPosters(id, patch, posters) {
    transaction(() => {
      doctorTable.update(id, patch);
      db.prepare('DELETE FROM doctor_posters WHERE doctor_id = ?').run(String(id));
      insertPosters(id, posters);
    });
    return this.findById(id);
  },
  /** Appends a generated poster and applies doctor updates in one transaction. */
  addPoster(id, poster, patch = {}) {
    transaction(() => {
      insertPosters(id, [poster]);
      doctorTable.update(id, patch);
    });
    return this.findById(id);
  },
  /** +1 download on the doctor and on the given poster (or the latest one). */
  recordDownload(id, posterId) {
    transaction(() => {
      db.prepare('UPDATE doctors SET download_count = download_count + 1, updated_at = ? WHERE id = ?')
        .run(nowIso(), String(id));
      if (posterId) {
        db.prepare('UPDATE doctor_posters SET downloads = downloads + 1 WHERE id = ? AND doctor_id = ?')
          .run(String(posterId), String(id));
      } else {
        db.prepare(`
          UPDATE doctor_posters SET downloads = downloads + 1
          WHERE id = (SELECT id FROM doctor_posters WHERE doctor_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1)
        `).run(String(id));
      }
    });
    return this.findById(id);
  },
  remove: doctorTable.remove,
};

// ---------------------------------------------------------------------------
// Master poster templates
// ---------------------------------------------------------------------------

const templateTable = defineTable('poster_templates', {
  posterlink: ['posterlink', toText],
  category: ['category', (v) => String(v ?? '')],
  color: ['color', (v) => String(v ?? '')],
  month: ['month', (v) => String(v ?? '')],
  enabled: ['enabled', toBool, fromBool],
  uploaddate: ['uploaddate', (v) => toIso(v) || nowIso(), (v) => v],
  status: ['status', (v) => (v === 'draft' ? 'draft' : 'published')],
  disabledFields: ['disabled_fields', toJson([]), fromJson([])],
});

const FIELD_COLUMNS = ['key', 'type', 'x', 'y', 'w', 'h', 'color', 'align', 'shape'];

function attachTemplateFields(templates) {
  if (!templates.length) return templates;
  const byId = new Map(templates.map((t) => [t._id, t]));
  templates.forEach((t) => { t.fields = []; });
  const ids = [...byId.keys()];
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500);
    db.prepare(`
      SELECT * FROM poster_template_fields WHERE poster_id IN (${chunk.map(() => '?').join(', ')})
      ORDER BY position ASC
    `).all(...chunk).forEach((row) => {
      const field = {};
      FIELD_COLUMNS.forEach((column) => { field[column] = row[column]; });
      byId.get(row.poster_id)?.fields.push(field);
    });
  }
  return templates;
}

function replaceTemplateFields(posterId, fields = []) {
  db.prepare('DELETE FROM poster_template_fields WHERE poster_id = ?').run(posterId);
  const stmt = db.prepare(`
    INSERT INTO poster_template_fields (poster_id, position, ${FIELD_COLUMNS.join(', ')})
    VALUES (?, ?, ${FIELD_COLUMNS.map(() => '?').join(', ')})
  `);
  fields.forEach((field, index) => {
    stmt.run(
      posterId, index, String(field.key), String(field.type || 'text'),
      Number(field.x), Number(field.y), Number(field.w), Number(field.h),
      String(field.color || '#ffffff'), field.align || 'left', field.shape || 'rectangle'
    );
  });
}

const TEMPLATE_ORDER = { uploaddate: 'uploaddate DESC', updatedAt: 'updated_at DESC' };

export const PosterTemplates = {
  findById(id) {
    const template = templateTable.byId(id);
    return template ? attachTemplateFields([template])[0] : null;
  },
  /** status: 'draft' | 'published'; month/category match case-insensitively. */
  list({ status, enabledOnly = false, month, category, orderBy = 'uploaddate' } = {}) {
    const conditions = [];
    const params = [];
    if (status) { conditions.push('status = ?'); params.push(status); }
    if (enabledOnly) conditions.push('enabled = 1');
    if (month) { conditions.push('month = ? COLLATE NOCASE'); params.push(String(month)); }
    if (category) { conditions.push('category = ? COLLATE NOCASE'); params.push(String(category)); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = db.prepare(`SELECT * FROM poster_templates ${where} ORDER BY ${TEMPLATE_ORDER[orderBy] || TEMPLATE_ORDER.uploaddate}`)
      .all(...params)
      .map(templateTable.fromRow);
    return attachTemplateFields(rows);
  },
  create(data) {
    const id = transaction(() => {
      const posterId = templateTable.insert({ ...data, uploaddate: data.uploaddate || new Date() });
      replaceTemplateFields(posterId, data.fields || []);
      return posterId;
    });
    return this.findById(id);
  },
  update(id, patch) {
    transaction(() => {
      templateTable.update(id, patch);
      if (patch.fields !== undefined) replaceTemplateFields(String(id), patch.fields || []);
    });
    return this.findById(id);
  },
  remove: templateTable.remove,
  /** Lowercased category name -> number of templates. */
  countsByCategory() {
    const map = new Map();
    db.prepare("SELECT LOWER(category) AS c, COUNT(*) AS n FROM poster_templates WHERE category <> '' GROUP BY LOWER(category)")
      .all()
      .forEach((row) => map.set(row.c, row.n));
    return map;
  },
  /** Lowercased, trimmed theme value -> number of templates. */
  countsByColor() {
    const map = new Map();
    db.prepare("SELECT LOWER(TRIM(color)) AS c, COUNT(*) AS n FROM poster_templates WHERE TRIM(color) <> '' GROUP BY LOWER(TRIM(color))")
      .all()
      .forEach((row) => map.set(row.c, row.n));
    return map;
  },
  renameCategory(oldName, newName) {
    return db.prepare('UPDATE poster_templates SET category = ?, updated_at = ? WHERE category = ? COLLATE NOCASE')
      .run(newName, nowIso(), oldName).changes;
  },
  renameColor(oldName, newName) {
    return db.prepare('UPDATE poster_templates SET color = ?, updated_at = ? WHERE color = ? COLLATE NOCASE')
      .run(newName, nowIso(), oldName).changes;
  },
  /** Deletes templates whose theme (trimmed, case-insensitive) is one of `names`. */
  removeByColors(names) {
    const values = names.map((n) => String(n).trim().toLowerCase()).filter(Boolean);
    if (!values.length) return 0;
    return db.prepare(`DELETE FROM poster_templates WHERE LOWER(TRIM(color)) IN (${values.map(() => '?').join(', ')})`)
      .run(...values).changes;
  },
};

// ---------------------------------------------------------------------------
// Doctor field configuration
// ---------------------------------------------------------------------------

const fieldTable = defineTable('doctor_fields', {
  key: ['key', toText],
  label: ['label', toText],
  type: ['type', toText],
  required: ['required', toBool, fromBool],
  isStandard: ['is_standard', toBool, fromBool],
  enabled: ['enabled', toBool, fromBool],
  order: ['sort_order', (v) => Number(v) || 0],
}, { timestamps: false });

export const DoctorFields = {
  findById: fieldTable.byId,
  findByKey(key) {
    return fieldTable.fromRow(db.prepare('SELECT * FROM doctor_fields WHERE key = ?').get(String(key)));
  },
  list({ enabledOnly = false } = {}) {
    const where = enabledOnly ? 'WHERE enabled = 1' : '';
    return db.prepare(`SELECT * FROM doctor_fields ${where} ORDER BY sort_order ASC, rowid ASC`).all().map(fieldTable.fromRow);
  },
  /** Highest order among non-file fields other than logo/photo. */
  maxRegularOrder() {
    const row = db.prepare(`
      SELECT MAX(sort_order) AS m FROM doctor_fields WHERE key NOT IN ('logo', 'photo') AND type <> 'file'
    `).get();
    return Number(row?.m) || 0;
  },
  count: fieldTable.count,
  create(data) {
    return fieldTable.byId(fieldTable.insert(data));
  },
  update(id, patch) {
    fieldTable.update(id, patch);
    return fieldTable.byId(id);
  },
  remove: fieldTable.remove,
};

// ---------------------------------------------------------------------------
// Categories and themes
// ---------------------------------------------------------------------------

const categoryTable = defineTable('categories', {
  name: ['name', (v) => String(v).trim()],
  enabled: ['enabled', toBool, fromBool],
});

export const Categories = {
  findById: categoryTable.byId,
  findByName(name) {
    return categoryTable.fromRow(db.prepare('SELECT * FROM categories WHERE name = ?').get(String(name).trim()));
  },
  list({ enabledOnly = false, orderBy = 'name' } = {}) {
    const where = enabledOnly ? 'WHERE enabled = 1' : '';
    const order = orderBy === 'createdAt' ? 'created_at DESC' : 'name COLLATE NOCASE ASC';
    return db.prepare(`SELECT * FROM categories ${where} ORDER BY ${order}`).all().map(categoryTable.fromRow);
  },
  count: categoryTable.count,
  create(data) {
    return categoryTable.byId(categoryTable.insert(data));
  },
  update(id, patch) {
    categoryTable.update(id, patch);
    return categoryTable.byId(id);
  },
  remove: categoryTable.remove,
};

const themeTable = defineTable('themes', {
  name: ['name', (v) => String(v).trim()],
  slug: ['slug', toText],
  headerBg: ['header_bg', toText],
  footerBg: ['footer_bg', toText],
  accentColor: ['accent_color', toText],
  description: ['description', (v) => String(v ?? '')],
  cardGlow: ['card_glow', toText],
  enabled: ['enabled', toBool, fromBool],
});

export const Themes = {
  findById: themeTable.byId,
  findByName(name) {
    return themeTable.fromRow(db.prepare('SELECT * FROM themes WHERE name = ?').get(String(name).trim()));
  },
  list({ enabledOnly = false, orderBy = 'createdAtAsc' } = {}) {
    const where = enabledOnly ? 'WHERE enabled = 1' : '';
    const order = orderBy === 'createdAtDesc' ? 'created_at DESC' : 'created_at ASC';
    return db.prepare(`SELECT * FROM themes ${where} ORDER BY ${order}, rowid ASC`).all().map(themeTable.fromRow);
  },
  count: themeTable.count,
  create(data) {
    return themeTable.byId(themeTable.insert(data));
  },
  update(id, patch) {
    themeTable.update(id, patch);
    return themeTable.byId(id);
  },
  remove: themeTable.remove,
};
