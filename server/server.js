import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import dotenv from 'dotenv';
import session from 'express-session';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = path.resolve(SERVER_DIR, '..');
dotenv.config({ path: path.join(PROJECT_DIR, '.env') });
dotenv.config({ path: path.join(SERVER_DIR, '.env') });
const BASE_PATH = `/${(process.env.APP_BASE_PATH || '/Poster-Creater').replace(/^\/+|\/+$/g, '')}`.replace(/^\/$/, '');


// The database is opened (and its schema created) when db.js is imported.
const {
  DB_PATH,
  isValidId,
  Superadmins,
  Admins,
  Users,
  Doctors,
  PosterTemplates,
  DoctorFields,
  Categories,
  Themes,
} = await import('./db.js');

const app = express();
app.set('trust proxy', 'loopback');
// Keep existing API routes while accepting the configured public URL prefix.
app.use((req, res, next) => {
  if (BASE_PATH && (req.path === BASE_PATH || req.path.startsWith(`${BASE_PATH}/`))) {
    req.url = req.url.slice(BASE_PATH.length) || '/';
    if (req.url.startsWith('?')) req.url = `/${req.url}`;
  }
  next();
});
app.use(session({
  secret: process.env.SESSION_SECRET || 'local-development-only',
  name: 'poster.sid',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    path: BASE_PATH || '/',
    secure: process.env.COOKIE_SECURE === 'true',
  },
}));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit for high-res posters and videos
});

const PORT = process.env.PORT || 4017;

app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

const UPLOADS_DIR = path.resolve(PROJECT_DIR, process.env.UPLOADS_DIR || 'uploads');
fs.mkdirSync(path.join(UPLOADS_DIR, 'logos'), { recursive: true });
fs.mkdirSync(path.join(UPLOADS_DIR, 'posters'), { recursive: true });
fs.mkdirSync(path.join(UPLOADS_DIR, 'festival_posters'), { recursive: true });
fs.mkdirSync(path.join(UPLOADS_DIR, 'education_posters'), { recursive: true });
fs.mkdirSync(path.join(UPLOADS_DIR, 'videos'), { recursive: true });
fs.mkdirSync(path.join(UPLOADS_DIR, 'master_posters'), { recursive: true });
app.use('/uploads', express.static(UPLOADS_DIR));

// Tables and queries live in db.js.

function normalizePosterKind(value, imageHint = '') {
  const raw = String(value || '').toLowerCase();
  if (raw === 'festival' || raw === 'video' || raw === 'education') return raw;
  if (raw === 'gk') return 'education';
  const src = String(imageHint || '');
  if (src.includes('.mp4') || src.includes('video')) return 'video';
  return 'education';
}

function assertContactNumber(value, { required = true } = {}) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) {
    if (!required) return null;
    throw Object.assign(new Error('Contact number must be exactly 10 digits'), { status: 400 });
  }
  if (digits.length !== 10) {
    throw Object.assign(new Error('Contact number must be exactly 10 digits'), { status: 400 });
  }
  return Number(digits);
}

function isHashedPassword(value) {
  return /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(String(value || ''));
}

async function hashPassword(value) {
  const password = String(value || '');
  if (!password || isHashedPassword(password)) return password;
  return bcrypt.hash(password, 10);
}

async function verifyPassword(plain, stored) {
  const candidate = String(plain || '');
  const current = stored != null ? String(stored) : '';
  if (!candidate || !current) return false;
  if (isHashedPassword(current)) return bcrypt.compare(candidate, current);
  return candidate === current;
}

function assertNewPassword(password, { required = true } = {}) {
  const value = String(password ?? '');
  if (!value && !required) return '';
  if (isHashedPassword(value)) return value;
  if (!value) {
    throw Object.assign(new Error('Password is required'), { status: 400 });
  }
  if (/\s/.test(value)) {
    throw Object.assign(new Error('Password cannot contain spaces'), { status: 400 });
  }
  if (value.length < 6) {
    throw Object.assign(new Error('Password must be at least 6 characters'), { status: 400 });
  }
  return value;
}

// The logo is only mandatory while the superadmin keeps the logo field enabled and required.
async function isDoctorLogoRequired() {
  const logoField = DoctorFields.findByKey('logo');
  return Boolean(logoField && logoField.enabled && logoField.required);
}

/** Uploaded paths come back from the client as URLs ("/uploads/x.png"); store them as "uploads/x.png". */
function normalizeStoredPath(value) {
  if (value == null || value === '') return null;
  let str = String(value).replace(/^https?:\/\/[^/]+/, '');
  if (BASE_PATH && str.startsWith(`${BASE_PATH}/uploads/`)) str = str.slice(BASE_PATH.length);
  const match = /^\/(uploads\/.*)$/.exec(str);
  return match ? match[1] : str;
}

function slugifyTheme(name) {
  const base = String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return base.startsWith('theme-') ? base : `theme-${base}`;
}

const SUPERADMIN_USERNAME = 'superadmin';

// Seed the default superadmin row (password stored as a bcrypt hash of "superadmin123").
if (!Superadmins.findById(SUPERADMIN_USERNAME)) {
  Superadmins.ensure(SUPERADMIN_USERNAME, bcrypt.hashSync('superadmin123', 10));
}


// Identity comes ONLY from the server-side session. The X-Auth-Role header just
// selects which of the session's logins to use, and X-Auth-Id is a consistency
// check: if the session now belongs to a different account than the one the
// client thinks it is (e.g. another login in the same browser), reject the request.
function getAuthFromRequest(req) {
  const headerRole = String(req.headers['x-auth-role'] || '').trim();
  const headerId = String(req.headers['x-auth-id'] || '').trim();
  const auths = req.session?.auths;
  if (!auths) return null;

  const auth = headerRole ? auths[headerRole] : req.session.auth;
  if (!auth?.role) return null;
  if (headerId && String(auth.id) !== headerId) return null;
  return auth;
}

// --- Login throttling (in-memory, per process) ---
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_LIMITS = { ip: 30, accountAndIp: 5, account: 20 };
const loginFailures = new Map();
// Unknown accounts still pay for one bcrypt compare so response time doesn't reveal which IDs exist.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('not-a-real-password', 10);

function loginKeys(req, account) {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  const acct = String(account || '').trim().toLowerCase().slice(0, 100);
  return [
    [`ip:${ip}`, LOGIN_LIMITS.ip],
    [`acct-ip:${acct}|${ip}`, LOGIN_LIMITS.accountAndIp],
    [`acct:${acct}`, LOGIN_LIMITS.account],
  ];
}

/**
 * Returns true (and sends 429) when this request is over a login limit. Otherwise it counts
 * this attempt immediately (so parallel bursts can't slip past); a successful login refunds it.
 */
function loginBlocked(req, res, account) {
  const now = Date.now();
  const keys = loginKeys(req, account);
  let retryAfter = 0;
  for (const [key, limit] of keys) {
    const entry = loginFailures.get(key);
    if (entry && entry.resetAt > now && entry.count >= limit) {
      retryAfter = Math.max(retryAfter, Math.ceil((entry.resetAt - now) / 1000));
    }
  }
  if (retryAfter) {
    res.set('Retry-After', String(retryAfter));
    res.status(429).json({
      success: false,
      code: 'RATE_LIMITED',
      message: `Too many failed login attempts. Try again in ${Math.ceil(retryAfter / 60)} minute(s).`,
    });
    return true;
  }
  for (const [key] of keys) {
    const entry = loginFailures.get(key);
    if (!entry || entry.resetAt <= now) loginFailures.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    else entry.count += 1;
  }
  return false;
}

/** A successful login: forget this account+IP and give back the attempt counted on arrival. */
function clearLoginFailures(req, account) {
  const keys = loginKeys(req, account);
  loginFailures.delete(keys[1][0]);
  for (const i of [0, 2]) {
    const entry = loginFailures.get(keys[i][0]);
    if (entry) entry.count = Math.max(0, entry.count - 1);
  }
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of loginFailures) if (entry.resetAt <= now) loginFailures.delete(key);
}, 60 * 1000).unref();

/** Verify a password for a possibly-missing account; always spends a bcrypt compare. */
async function verifyPasswordOrDummy(plain, account) {
  if (!account) {
    await bcrypt.compare(String(plain || ''), DUMMY_PASSWORD_HASH);
    return false;
  }
  return verifyPassword(plain, account.password);
}

function requireAuth(...roles) {
  return async (req, res, next) => {
    try {
      const auth = getAuthFromRequest(req);
      if (!auth || (roles.length && !roles.includes(auth.role))) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      if (auth.role === 'admin' && auth.id) {
        const admin = Admins.findById(auth.id);
        if (!admin) {
          if (req.session) {
            if (req.session.auths) delete req.session.auths.admin;
            if (req.session.auth?.role === 'admin') delete req.session.auth;
          }
          return res.status(401).json({ success: false, message: 'Unauthorized - Admin not found' });
        }
      } else if (auth.role === 'user' && auth.id) {
        const user = Users.findById(auth.id);
        if (!user) {
          if (req.session) {
            if (req.session.auths) delete req.session.auths.user;
            if (req.session.auth?.role === 'user') delete req.session.auth;
          }
          return res.status(401).json({ success: false, message: 'Unauthorized - User not found' });
        }
      }

      req.auth = auth;
      next();
    } catch (error) {
      console.error('Auth check error:', error);
      return res.status(500).json({ success: false, message: 'Server error during authentication' });
    }
  };
}

function buildAuthPayload(role, actor) {
  if (role === 'superadmin') {
    return {
      role: 'superadmin',
      id: 'superadmin',
      username: SUPERADMIN_USERNAME,
      name: 'Superadmin',
    };
  }
  if (role === 'admin') {
    return {
      role: 'admin',
      id: String(actor._id),
      username: actor.username,
      name: actor.username,
    };
  }
  return {
    role: 'user',
    id: String(actor._id),
    empid: actor.empid ?? actor.id,
    name: actor.name || '',
    ownerAdmin: actor.ownerAdmin ? String(actor.ownerAdmin) : null,
  };
}

function formatAdmin(doc, extra = {}) {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  return {
    id: String(obj._id),
    username: obj.username,
    createdAt: obj.createdAt,
    ...extra,
  };
}

async function findAdminByUsername(username) {
  return Admins.findByUsername(username);
}

// Scopes are plain objects understood by db.js: null = nothing, {} = everything,
// { ownerUserId } / { ownerAdminId } = restricted.
function doctorScopeForAuth(auth, { adminId } = {}) {
  if (!auth) return null;
  if (auth.role === 'superadmin') {
    if (adminId) return isValidId(String(adminId)) ? { ownerAdminId: adminId } : null;
    return {};
  }
  if (auth.role === 'admin') return { ownerAdminId: auth.id };
  if (auth.role === 'user') return { ownerUserId: auth.id };
  return null;
}

function userScopeForAuth(auth, { adminId } = {}) {
  if (!auth) return null;
  if (auth.role === 'superadmin') {
    return adminId && isValidId(String(adminId)) ? { ownerAdminId: adminId } : {};
  }
  if (auth.role === 'admin') return { ownerAdminId: auth.id };
  return null;
}

async function assertUserInScope(auth, user) {
  if (!user) return false;
  if (auth.role === 'superadmin') return true;
  if (auth.role === 'admin') return String(user.ownerAdmin || '') === String(auth.id);
  return false;
}

async function canAccessDoctor(auth, doctor) {
  if (!doctor) return false;
  if (auth.role === 'superadmin') return true;
  if (auth.role === 'admin') {
    if (!doctor.ownerUser) return false;
    const owner = Users.findById(doctor.ownerUser);
    return String(owner?.ownerAdmin || '') === String(auth.id);
  }
  if (auth.role === 'user') {
    return String(doctor.ownerUser || '') === String(auth.id);
  }
  return false;
}

// Helper to save buffer to disk and return relative path
async function saveFile(buffer, originalname, subfolder) {
  if (!buffer) return null;
  let ext = originalname ? path.extname(originalname).toLowerCase() : '';
  if (!ext) ext = subfolder === 'logos' ? '.png' : '.jpg';
  const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
  const relativePath = `uploads/${subfolder}/${filename}`;
  const absolutePath = path.join(UPLOADS_DIR, subfolder, filename);
  await fs.promises.writeFile(absolutePath, buffer);
  return relativePath;
}

// Helper to format doctor document for frontend consumption
function bufferToDataUrl(value, fallbackMime = 'image/png') {
  if (!value) return null;
  if (typeof value === 'string') {
    if (value.startsWith('uploads/') || value.startsWith('uploads\\')) {
      // Relative by default so the URL works from any device (proxied by Vite); set PUBLIC_BASE_URL to force an absolute origin.
      const base = (process.env.PUBLIC_BASE_URL || BASE_PATH).replace(/\/$/, '');
      return `${base}/${value.replace(/\\/g, '/')}`;
    }
    return value;
  }

  const buf = Buffer.isBuffer(value)
    ? value
    : value.buffer && Buffer.isBuffer(value.buffer)
      ? value.buffer
      : null;
  if (!buf) return null;

  const head = buf.slice(0, 40).toString('utf8').trim().toLowerCase();
  if (head.startsWith('<svg') || head.startsWith('<?xml')) {
    return `data:image/svg+xml;base64,${buf.toString('base64')}`;
  }
  return `data:${fallbackMime};base64,${buf.toString('base64')}`;
}

function getPosterStats(obj) {
  const posters = Array.isArray(obj.posters) ? obj.posters : [];
  let postersMade = posters.length;
  if (postersMade === 0 && obj.poster) postersMade = 1;

  let downloadCount = Number(obj.downloadCount) || 0;
  if (downloadCount === 0 && posters.length > 0) {
    downloadCount = posters.reduce((sum, p) => sum + (Number(p.downloads) || 0), 0);
  }

  return { postersMade, downloadCount };
}

function formatDoctor(doc, { includePosters = false, light = false } = {}) {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  const { postersMade, downloadCount } = getPosterStats(obj);

  const postersArray = Array.isArray(obj.posters) ? obj.posters : [];
  const monthlyDownloads = {};
  const monthlyPosters = {};
  const posterActivity = [];
  postersArray.forEach((p) => {
    if (!p.createdAt) return;
    let m = new Date(p.createdAt).getMonth(); // fallback: 0 = Jan, 11 = Dec
    if (p.month) {
      const monthPrefix = String(p.month).trim().toLowerCase().slice(0, 3);
      const mIndex = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(monthPrefix);
      if (mIndex !== -1) {
        m = mIndex;
      }
    }
    const downloads = Number(p.downloads) || 0;
    monthlyDownloads[m] = (monthlyDownloads[m] || 0) + downloads;
    monthlyPosters[m] = (monthlyPosters[m] || 0) + 1;
    posterActivity.push({
      createdAt: p.createdAt,
      downloads,
    });
  });

  const base = {
    id: obj._id,
    name: obj.name,
    clinicName: obj.clinicName || '',
    doctorDegree: obj.doctorDegree || '',
    contactnumber: obj.contactnumber,
    active: obj.active !== false,
    postersMade,
    downloadCount,
    ownerUser: obj.ownerUser ? String(obj.ownerUser) : null,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
    dynamicFields: obj.dynamicFields || {},
    monthlyDownloads,
    monthlyPosters,
    posterActivity,
  };

  if (light) {
    return {
      ...base,
      logo: bufferToDataUrl(obj.logo, 'image/png'),
    };
  }

  const formatted = {
    ...base,
    logo: bufferToDataUrl(obj.logo, 'image/png'),
    poster: bufferToDataUrl(obj.poster, 'image/jpeg'),
  };

  if (includePosters) {
    const posters = Array.isArray(obj.posters) ? obj.posters : [];
    formatted.posters = posters.map((p) => ({
      id: p._id,
      image: bufferToDataUrl(p.image, 'image/jpeg'),
      downloads: Number(p.downloads) || 0,
      createdAt: p.createdAt,
      kind: normalizePosterKind(p.kind, p.image),
      label: p.label || '',
    }));

    // Legacy single poster fallback for gallery
    if (formatted.posters.length === 0 && formatted.poster) {
      formatted.posters = [
        {
          id: 'legacy',
          image: formatted.poster,
          downloads: downloadCount,
          createdAt: obj.updatedAt || obj.createdAt,
          kind: normalizePosterKind(null, formatted.poster),
          label: '',
        },
      ];
    }
  }

  return formatted;
}

function formatUser(doc, extra = {}) {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  return {
    id: obj._id,
    empid: obj.empid ?? obj.id ?? null,
    ownerAdmin: obj.ownerAdmin ? String(obj.ownerAdmin) : null,
    createdAt: obj.createdAt,
    ...extra,
  };
}

async function findUserByLoginId(id) {
  return Users.findByEmpid(id);
}

// Issues a fresh session id on every login (session-fixation defence) while keeping
// the other roles already signed in from this browser.
function setAuthSession(req, auth) {
  return new Promise((resolve, reject) => {
    if (!req.session) return resolve(auth);
    const previous = req.session.auths || {};
    req.session.regenerate((err) => {
      if (err) return reject(err);
      req.session.auths = { ...previous, [auth.role]: auth };
      req.session.auth = auth;
      resolve(auth);
    });
  });
}

// Routes
app.post('/api/login', async (req, res) => {
  const { id, password, username } = req.body;
  const loginId = String(id || username || '').trim();
  const pass = String(password || '');

  if (!loginId || !pass) {
    return res.status(400).json({ success: false, message: 'Employee ID / username and password are required' });
  }

  if (loginBlocked(req, res, loginId)) return;

  try {
    const user = await findUserByLoginId(loginId);
    if (!(await verifyPasswordOrDummy(pass, user))) {
      return res.status(401).json({ success: false, message: 'Invalid employee ID or password' });
    }

    clearLoginFailures(req, loginId);
    const auth = await setAuthSession(req, buildAuthPayload('user', user));
    return res.status(200).json({
      success: true,
      message: 'Login successful',
      user: auth,
      auth,
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, message: 'Server error during login' });
  }
});

app.post('/api/logout', (req, res) => {
  const headerRole = String(req.headers['x-auth-role'] || '').trim();
  if (req.session) {
    if (req.session.auths && headerRole) {
      delete req.session.auths[headerRole];
      if (req.session.auth && req.session.auth.role === headerRole) {
        delete req.session.auth;
      }
      if (Object.keys(req.session.auths).length > 0) {
        return res.status(200).json({ success: true });
      }
    }
    req.session.destroy(() => {
      res.status(200).json({ success: true });
    });
    return;
  }
  return res.status(200).json({ success: true });
});

// Get current/latest doctor profile
app.get('/api/doctors/current', async (req, res) => {
  try {
    const doctor = Doctors.latestActive();
    if (!doctor) {
      return res.status(404).json({ message: 'No doctor profiles found' });
    }
    return res.status(200).json({ doctor: formatDoctor(doctor) });
  } catch (error) {
    console.error('Error fetching current doctor:', error);
    return res.status(500).json({ message: 'Failed to retrieve doctor profile' });
  }
});

// Get all doctors (searchable list)
app.get('/api/doctors', requireAuth('superadmin', 'admin', 'user'), async (req, res) => {
  try {
    const auth = req.auth;

    const q = String(req.query.q || '').trim();
    const includeInactive = String(req.query.includeInactive || '') === 'true';
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, parseInt(req.query.limit) || 10);
    const skip = (page - 1) * limit;

    const scope = doctorScopeForAuth(auth);
    if (!scope) {
      return res.status(200).json({ total: 0, totalFiltered: 0, count: 0, page: 1, totalPages: 0, doctors: [] });
    }
    const filter = { scope, includeInactive, search: q };

    const doctors = Doctors.list(filter, { sortField: 'createdAt', sortDir: 'DESC', offset: skip, limit });
    const totalFiltered = Doctors.count(filter);
    const total = Doctors.count({ scope, includeInactive });

    return res.status(200).json({
      total,
      totalFiltered,
      count: doctors.length,
      page,
      totalPages: Math.ceil(totalFiltered / limit),
      doctors: doctors.map((d) => formatDoctor(d, { light: true })),
    });
  } catch (error) {
    console.error('Error fetching doctors:', error);
    return res.status(500).json({ message: 'Failed to retrieve doctors' });
  }
});

// Get one doctor with posters
app.get('/api/doctors/:id', requireAuth('superadmin', 'admin', 'user'), async (req, res) => {
  try {
    const auth = req.auth;
    const doctor = Doctors.findById(req.params.id);
    if (!doctor || !(await canAccessDoctor(auth, doctor))) {
      return res.status(404).json({ message: 'Doctor not found' });
    }
    return res.status(200).json({ doctor: formatDoctor(doctor, { includePosters: true }) });
  } catch (error) {
    console.error('Error fetching doctor:', error);
    return res.status(500).json({ message: 'Failed to retrieve doctor' });
  }
});

// Update doctor profile fields
app.put('/api/doctors/:id', upload.any(), async (req, res) => {
  try {
    const existing = Doctors.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Doctor not found' });
    const doctor = {};

    const { name, contactnumber, clinicName, doctorDegree, active } = req.body;
    let logoFile = req.files?.find((f) => f.fieldname === 'logo');
    let logoBuffer = logoFile?.buffer || null;
    let originalName = logoFile?.originalname || '';

    if (!logoBuffer && req.body.logo && typeof req.body.logo === 'string' && req.body.logo.startsWith('data:')) {
      logoBuffer = Buffer.from(req.body.logo.replace(/^data:image\/\w+;base64,/, ''), 'base64');
    }

    if (name != null) doctor.name = String(name).trim() || existing.name;
    if (clinicName != null) {
      const cleaned = String(clinicName).trim();
      if (!cleaned) {
        return res.status(400).json({ message: 'Clinic/Hospital name is required.' });
      }
      doctor.clinicName = cleaned;
    }
    if (doctorDegree != null) {
      const cleaned = String(doctorDegree).trim();
      if (!cleaned) {
        return res.status(400).json({ message: "Doctor's degree is required." });
      }
      doctor.doctorDegree = cleaned;
    }
    if (contactnumber != null && String(contactnumber).trim() !== '') {
      doctor.contactnumber = assertContactNumber(contactnumber);
    }
    if (active != null) doctor.active = String(active) !== 'false' && active !== false;

    if (logoBuffer) {
      doctor.logo = await saveFile(logoBuffer, originalName, 'logos');
    }

    const saved = Doctors.update(existing._id, doctor);
    return res.status(200).json({
      success: true,
      message: 'Doctor updated',
      doctor: formatDoctor(saved, { includePosters: true }),
    });
  } catch (error) {
    console.error('Error updating doctor:', error);
    return res.status(error.status || 500).json({ message: error.message || 'Failed to update doctor' });
  }
});

// Deactivate / reactivate doctor
app.patch('/api/doctors/:id/status', async (req, res) => {
  try {
    const active = req.body?.active !== false && String(req.body?.active) !== 'false';
    if (!Doctors.findById(req.params.id)) return res.status(404).json({ message: 'Doctor not found' });
    const doctor = Doctors.update(req.params.id, { active });
    return res.status(200).json({
      success: true,
      message: active ? 'Doctor activated' : 'Doctor deactivated',
      doctor: formatDoctor(doctor, { includePosters: true }),
    });
  } catch (error) {
    console.error('Error updating doctor status:', error);
    return res.status(500).json({ message: 'Failed to update doctor status' });
  }
});

// Delete doctor
app.delete('/api/doctors/:id', async (req, res) => {
  try {
    if (!Doctors.remove(req.params.id)) return res.status(404).json({ message: 'Doctor not found' });
    return res.status(200).json({ success: true, message: 'Doctor removed' });
  } catch (error) {
    console.error('Error deleting doctor:', error);
    return res.status(500).json({ message: 'Failed to delete doctor' });
  }
});

// Record a poster download for a doctor
app.post('/api/doctors/:id/download', async (req, res) => {
  try {
    if (!Doctors.findById(req.params.id)) return res.status(404).json({ message: 'Doctor not found' });

    const posterId = req.body?.posterId;
    const doctor = Doctors.recordDownload(req.params.id, posterId ? String(posterId) : null);
    return res.status(200).json({
      success: true,
      doctor: formatDoctor(doctor, { includePosters: true }),
    });
  } catch (error) {
    console.error('Error recording download:', error);
    return res.status(500).json({ message: 'Failed to record download' });
  }
});

// Create/update doctor profile and poster with multer file upload
app.post('/api/doctors', requireAuth('superadmin', 'admin', 'user'), upload.any(), async (req, res) => {
  const { name, contactnumber, clinicName, doctorDegree, doctorId, ownerUserId } = req.body;
  const countDownload = String(req.body.countDownload || '') === 'true';
  let logoFile = req.files?.find((f) => f.fieldname === 'logo');
  let logoBuffer = logoFile?.buffer || null;
  let logoName = logoFile?.originalname || '';

  let posterFile = req.files?.find((f) => f.fieldname === 'poster');
  let posterBuffer = posterFile?.buffer || null;
  let posterName = posterFile?.originalname || '';
  const posterKind = normalizePosterKind(req.body.posterKind, posterName);
  const posterLabel = String(req.body.posterLabel || '').trim();
  const posterMonth = String(req.body.posterMonth || '').trim();

  // Also support base64 fallback if sent in body
  if (!logoBuffer && req.body.logo && typeof req.body.logo === 'string' && req.body.logo.startsWith('data:')) {
    const base64Data = req.body.logo.replace(/^data:image\/\w+;base64,/, '');
    logoBuffer = Buffer.from(base64Data, 'base64');
  }

  if (!posterBuffer && req.body.poster && typeof req.body.poster === 'string' && req.body.poster.startsWith('data:')) {
    const base64Data = req.body.poster.replace(/^data:image\/\w+;base64,/, '');
    posterBuffer = Buffer.from(base64Data, 'base64');
  }

  let parsedDynamicFields = {};
  if (req.body.dynamicFields) {
    try {
      parsedDynamicFields = JSON.parse(req.body.dynamicFields);
    } catch (e) {
      console.error('Failed to parse dynamicFields');
    }
  }

  try {
    const cleanedContact = contactnumber
      ? assertContactNumber(contactnumber, { required: false })
      : null;
    const cleanedDegree = String(doctorDegree).trim();

    if (cleanedContact) {
      const existingDoc = Doctors.findByContact(cleanedContact);
      if (existingDoc && (!doctorId || String(existingDoc._id) !== String(doctorId))) {
        return res.status(400).json({ success: false, message: 'This mobile number already exists' });
      }
    }

    // Update existing doctor when doctorId is provided
    if (doctorId) {
      const existing = Doctors.findById(doctorId);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Doctor not found' });
      }

      const patch = {};
      if (name) patch.name = name.trim();
      if (clinicName !== undefined) patch.clinicName = String(clinicName).trim();
      if (doctorDegree !== undefined) patch.doctorDegree = cleanedDegree;
      if (cleanedContact !== null) patch.contactnumber = cleanedContact;
      patch.dynamicFields = { ...existing.dynamicFields, ...parsedDynamicFields };
      if (logoBuffer) patch.logo = await saveFile(logoBuffer, logoName, 'logos');

      let doctor;
      if (posterBuffer) {
        let posterSubfolder = 'posters';
        if (posterKind === 'festival') posterSubfolder = 'festival_posters';
        else if (posterKind === 'gk') posterSubfolder = 'education_posters';
        else if (posterKind === 'video') posterSubfolder = 'videos';

        const posterPath = await saveFile(posterBuffer, posterName, posterSubfolder);
        patch.poster = posterPath;
        if (countDownload) {
          patch.downloadCount = (Number(existing.downloadCount) || 0) + 1;
        }
        doctor = Doctors.addPoster(existing._id, {
          image: posterPath,
          downloads: countDownload ? 1 : 0,
          createdAt: new Date(),
          kind: posterKind,
          label: posterLabel,
          month: posterMonth,
        }, patch);
      } else {
        doctor = Doctors.update(existing._id, patch);
      }

      return res.status(200).json({
        success: true,
        message: 'Doctor profile and poster saved successfully',
        doctor: formatDoctor(doctor, { includePosters: true }),
      });
    }

    if (!logoBuffer && (await isDoctorLogoRequired())) {
      return res.status(400).json({ success: false, message: 'Doctor logo is required.' });
    }

    const logoPath = logoBuffer ? await saveFile(logoBuffer, logoName, 'logos') : null;

    let ownerUser = isValidId(ownerUserId) && Users.findById(ownerUserId) ? ownerUserId : null;
    if (req.auth?.role === 'user') {
      ownerUser = req.auth.id;
    } else if (req.auth?.role === 'admin') {
      if (ownerUser) {
        const assigned = Users.findById(ownerUser);
        if (!assigned || String(assigned.ownerAdmin || '') !== String(req.auth.id)) {
          ownerUser = null;
        }
      }
    }

    const docData = {
      ownerUser,
      name: name?.trim() || 'Doctor',
      clinicName: clinicName ? String(clinicName).trim() : '',
      doctorDegree: cleanedDegree,
      contactnumber: cleanedContact,
      logo: logoPath,
      active: true,
      posters: [],
      downloadCount: 0,
      dynamicFields: parsedDynamicFields,
    };

    if (posterBuffer) {
      let posterSubfolder = 'posters';
      if (posterKind === 'festival') posterSubfolder = 'festival_posters';
      else if (posterKind === 'gk') posterSubfolder = 'education_posters';
      else if (posterKind === 'video') posterSubfolder = 'videos';

      const posterPath = await saveFile(posterBuffer, posterName, posterSubfolder);
      docData.poster = posterPath;
      docData.posters = [
        {
          image: posterPath,
          downloads: countDownload ? 1 : 0,
          createdAt: new Date(),
          kind: posterKind,
          label: posterLabel,
          month: posterMonth,
        },
      ];
      docData.downloadCount = countDownload ? 1 : 0;
    }

    const { posters: initialPosters, ...doctorRow } = docData;
    const doctor = Doctors.create(doctorRow, initialPosters);
    return res.status(201).json({
      success: true,
      message: 'Doctor profile and poster saved successfully',
      doctor: formatDoctor(doctor, { includePosters: true }),
    });
  } catch (error) {
    console.error('Error saving doctor and poster:', error);
    return res.status(error.status || 500).json({ message: error.message || 'Failed to save doctor and poster' });
  }
});

async function listUsersForAuth(auth, { adminId } = {}) {
  const scope = userScopeForAuth(auth, { adminId });
  return Users.listWithCounts(scope).map((user) => formatUser(user, {
    doctorCount: user.doctorCount || 0,
    adminUsername: user.adminUsername,
  }));
}

async function createUserUnderAdmin(adminId, { empid, password }) {
  const cleanEmpid = String(empid || '').trim();
  if (!cleanEmpid) {
    const error = new Error('Employee ID and password are required');
    error.status = 400;
    throw error;
  }
  const existing = await findUserByLoginId(cleanEmpid);
  if (existing) {
    throw Object.assign(new Error('Employee ID already exists'), { status: 409 });
  }
  const cleanPassword = assertNewPassword(password);
  const user = Users.create({
    empid: cleanEmpid,
    password: await hashPassword(cleanPassword),
    ownerAdmin: adminId ? String(adminId) : null,
  });
  return formatUser(user, { doctorCount: 0 });
}

async function updateUserRecord(user, { empid, password, ownerAdmin, createdAt, updatedAt }) {
  const patch = {};
  if (empid != null) {
    const cleanEmpid = String(empid).trim();
    if (!cleanEmpid) {
      const error = new Error('Employee ID is required');
      error.status = 400;
      throw error;
    }
    if (cleanEmpid !== String(user.empid || '')) {
      const existing = await findUserByLoginId(cleanEmpid);
      if (existing && String(existing._id) !== String(user._id)) {
        throw Object.assign(new Error('Employee ID already exists'), { status: 409 });
      }
    }
    patch.empid = cleanEmpid;
  }
  if (password != null && String(password).trim()) {
    patch.password = await hashPassword(assertNewPassword(password));
  }
  if (ownerAdmin !== undefined) {
    patch.ownerAdmin = isValidId(String(ownerAdmin || '')) && Admins.findById(ownerAdmin) ? String(ownerAdmin) : null;
  }
  if (createdAt) patch.createdAt = createdAt;
  if (updatedAt) patch.updatedAt = updatedAt;
  return formatUser(Users.update(user._id, patch));
}

/** Deleting a user cascades to their doctors (foreign key ON DELETE CASCADE). */
async function deleteUserAndDoctors(userId) {
  Users.remove(userId);
}

const ADMIN_CSV_HEADERS = ['id', 'username', 'password', 'createdAt', 'updatedAt'];
const USER_CSV_HEADERS = ['id', 'empid', 'password', 'ownerAdmin', 'createdAt', 'updatedAt'];
const DOCTOR_CSV_HEADERS = [
  'id', 'name', 'clinicName', 'doctorDegree', 'contactnumber',
  'logo', 'poster', 'posters', 'downloadCount', 'active',
  'createdAt', 'updatedAt', 'ownerUser',
];

function parseCsvText(text) {
  const input = String(text || '').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  while (rows.length && rows[rows.length - 1].every((value) => !String(value).trim())) {
    rows.pop();
  }
  if (!rows.length) return { headers: [], records: [] };
  const headers = rows[0].map((header) => String(header).trim());
  const records = rows.slice(1).map((values) => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = values[index] ?? '';
    });
    return record;
  });
  return { headers, records };
}

function assertCsvHeaders(headers, expected) {
  const match = headers.length === expected.length && headers.every((header, index) => header === expected[index]);
  if (!match) {
    const error = new Error(`CSV header must be exactly: ${expected.join(',')}`);
    error.status = 400;
    throw error;
  }
}

function parseCsvDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseCsvActive(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return true;
  if (raw === 'true' || raw === '1' || raw === 'yes') return true;
  if (raw === 'false' || raw === '0' || raw === 'no') return false;
  return true;
}

function parseContactNumber(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const num = Number(raw);
  return Number.isFinite(num) ? num : null;
}

function parsePostersCell(value) {
  const raw = String(value || '').trim();
  if (!raw) return [];
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const error = new Error('posters must be a JSON array');
    error.status = 400;
    throw error;
  }
  if (!Array.isArray(parsed)) {
    const error = new Error('posters must be a JSON array');
    error.status = 400;
    throw error;
  }
  return parsed.map((poster) => ({
    image: normalizeStoredPath(poster?.image) || '',
    downloads: Number(poster?.downloads) || 0,
    createdAt: parseCsvDate(poster?.createdAt) || undefined,
    kind: normalizePosterKind(poster?.kind, poster?.image),
    label: poster?.label || '',
  })).filter((poster) => poster.image);
}

function csvTimestamps(row) {
  const createdAt = parseCsvDate(row.createdAt);
  const updatedAt = parseCsvDate(row.updatedAt);
  return {
    ...(createdAt ? { createdAt } : {}),
    ...(updatedAt ? { updatedAt } : {}),
  };
}

/** Doctor columns from one CSV row (posters are returned separately). */
function doctorFieldsFromCsv(row, { ownerUser }) {
  return {
    name: String(row.name || '').trim(),
    clinicName: String(row.clinicName || '').trim(),
    doctorDegree: String(row.doctorDegree || '').trim(),
    contactnumber: parseContactNumber(row.contactnumber),
    logo: normalizeStoredPath(String(row.logo || '').trim()),
    poster: normalizeStoredPath(String(row.poster || '').trim()),
    downloadCount: String(row.downloadCount ?? '').trim() === '' ? 0 : Number(row.downloadCount) || 0,
    active: parseCsvActive(row.active),
    ownerUser,
    ...csvTimestamps(row),
  };
}

// --- Auth for staff pages ---
async function superadminLogin(req, res) {
  const { username, password } = req.body || {};
  const loginId = String(username || '').trim();
  if (loginBlocked(req, res, `superadmin:${loginId}`)) return;
  try {
    const superadmin = Superadmins.findById(loginId);
    if (await verifyPasswordOrDummy(password, superadmin)) {
      clearLoginFailures(req, `superadmin:${loginId}`);
      const auth = await setAuthSession(req, buildAuthPayload('superadmin'));
      return res.status(200).json({ success: true, message: 'Superadmin login successful', auth });
    }
    return res.status(401).json({ success: false, message: 'Invalid superadmin credentials' });
  } catch (error) {
    console.error('Superadmin login error:', error);
    return res.status(500).json({ success: false, message: 'Server error during login' });
  }
}
app.post('/api/superadmin/login', superadminLogin);
app.post('/api/super-admin/login', superadminLogin);

app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body || {};
  const loginId = String(username || '').trim();
  const pass = String(password || '');
  if (loginBlocked(req, res, `admin:${loginId}`)) return;
  try {
    const admin = await findAdminByUsername(loginId);
    if (!(await verifyPasswordOrDummy(pass, admin))) {
      return res.status(401).json({ success: false, message: 'Invalid admin credentials' });
    }
    clearLoginFailures(req, `admin:${loginId}`);
    const auth = await setAuthSession(req, buildAuthPayload('admin', admin));
    return res.status(200).json({ success: true, message: 'Admin login successful', auth });
  } catch (error) {
    console.error('Admin login error:', error);
    return res.status(500).json({ success: false, message: 'Server error during login' });
  }
});

app.post('/api/userpanel/login', async (req, res) => {
  const { username, password, id } = req.body || {};
  const loginId = String(username || id || '').trim();
  const pass = String(password || '');
  if (!loginId || !pass) {
    return res.status(400).json({ success: false, message: 'Username / employee ID and password are required' });
  }
  if (loginBlocked(req, res, loginId)) return;
  try {
    const user = await findUserByLoginId(loginId);
    if (await verifyPasswordOrDummy(pass, user)) {
      clearLoginFailures(req, loginId);
      const auth = await setAuthSession(req, buildAuthPayload('user', user));
      return res.status(200).json({ success: true, message: 'Login successful', auth });
    }
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  } catch (error) {
    console.error('Userpanel login error:', error);
    return res.status(500).json({ success: false, message: 'Server error during login' });
  }
});

// --- Doctor Fields Config ---
app.get('/api/doctor-fields', async (req, res) => {
  try {
    const fields = DoctorFields.list();
    res.json({ success: true, fields });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/superadmin/doctor-fields', requireAuth('superadmin'), async (req, res) => {
  try {
    const label = String(req.body?.label || '').trim();
    const type = String(req.body?.type || 'text').trim() || 'text';
    const required = Boolean(req.body?.required);
    const enabled = req.body?.enabled !== false;

    if (!label) return res.status(400).json({ success: false, message: 'Label is required' });

    // The internal key is generated from the label (snake_case) and made unique.
    const baseKey = label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/^[0-9]+/, '') || 'field';
    let key = baseKey;
    for (let n = 2; DoctorFields.findByKey(key); n += 1) key = `${baseKey}_${n}`;

    const logoField = DoctorFields.findByKey('logo');
    const nextOrder = DoctorFields.maxRegularOrder() + 1;
    if (logoField && Number(logoField.order) <= nextOrder) {
      DoctorFields.update(logoField._id, { order: nextOrder + 1 });
    }

    const field = DoctorFields.create({
      key,
      label,
      type,
      required,
      enabled,
      isStandard: false,
      order: nextOrder,
    });

    return res.status(201).json({ success: true, field });
  } catch (err) {
    console.error('Error creating doctor field:', err);
    if (err?.code === 'DUPLICATE') {
      return res.status(409).json({ success: false, message: 'A field with this key already exists' });
    }
    return res.status(500).json({ success: false, message: err.message || 'Failed to create field' });
  }
});

app.put('/api/superadmin/doctor-fields/:id', requireAuth('superadmin'), async (req, res) => {
  try {
    if (!DoctorFields.findById(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Field not found' });
    }
    // The key identifies the field on posters and doctor records, so it is never renamed here.
    const body = req.body || {};
    const patch = {};
    if (body.label !== undefined) patch.label = String(body.label).trim();
    if (body.type !== undefined) patch.type = String(body.type).trim() || 'text';
    if (body.required !== undefined) patch.required = Boolean(body.required);
    if (body.enabled !== undefined) patch.enabled = Boolean(body.enabled);
    if (body.order !== undefined) patch.order = Number(body.order) || 0;
    const field = DoctorFields.update(req.params.id, patch);
    res.json({ success: true, field });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

app.delete('/api/superadmin/doctor-fields/:id', requireAuth('superadmin'), async (req, res) => {
  try {
    if (!DoctorFields.remove(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Field not found' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// --- Superadmin: admins ---
app.get('/api/superadmin/admins', requireAuth('superadmin'), async (_req, res) => {
  try {
    const admins = Admins.listWithUserCounts();
    return res.json({
      admins: admins.map((admin) => formatAdmin(admin, { userCount: admin.userCount || 0 })),
    });
  } catch (error) {
    console.error('Error fetching admins:', error);
    return res.status(500).json({ message: 'Failed to retrieve admins' });
  }
});

app.post('/api/superadmin/admins', requireAuth('superadmin'), async (req, res) => {
  try {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');
    if (!username) {
      return res.status(400).json({ message: 'Username and password are required' });
    }
    const cleanPassword = assertNewPassword(password);
    const existing = await findAdminByUsername(username);
    if (existing) return res.status(409).json({ message: 'Admin username already exists' });
    const admin = Admins.create({ username, password: await hashPassword(cleanPassword) });
    return res.status(201).json({ success: true, admin: formatAdmin(admin, { userCount: 0 }) });
  } catch (error) {
    console.error('Error creating admin:', error);
    return res.status(error.status || 500).json({ message: error.message || 'Failed to create admin' });
  }
});

app.post('/api/superadmin/admins/import', requireAuth('superadmin'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ message: 'CSV file is required' });
    }
    const { headers, records } = parseCsvText(req.file.buffer.toString('utf8'));
    assertCsvHeaders(headers, ADMIN_CSV_HEADERS);

    let created = 0;
    let updated = 0;
    const errors = [];

    for (let index = 0; index < records.length; index += 1) {
      const row = records[index];
      const rowNumber = index + 2;
      try {
        const id = String(row.id || '').trim();
        const username = String(row.username || '').trim();
        const password = String(row.password || '');
        if (!username) {
          throw Object.assign(new Error('Username is required'), { status: 400 });
        }

        let admin = null;
        if (id && isValidId(id)) {
          admin = Admins.findById(id);
        }
        if (!admin) {
          admin = await findAdminByUsername(username);
        }

        if (admin) {
          const taken = await findAdminByUsername(username);
          if (taken && String(taken._id) !== String(admin._id)) {
            throw Object.assign(new Error('Admin username already exists'), { status: 409 });
          }
          const patch = { username, ...csvTimestamps(row) };
          if (password.trim()) patch.password = await hashPassword(assertNewPassword(password));
          Admins.update(admin._id, patch);
          updated += 1;
        } else {
          if (!password.trim()) {
            throw Object.assign(new Error('Password is required for a new admin'), { status: 400 });
          }
          Admins.create({
            username,
            password: await hashPassword(assertNewPassword(password)),
            ...csvTimestamps(row),
          });
          created += 1;
        }
      } catch (error) {
        errors.push({ row: rowNumber, message: error.message || 'Failed to import admin' });
      }
    }

    return res.json({ success: true, created, updated, errors });
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message || 'Failed to import admins' });
  }
});

app.put('/api/superadmin/admins/:id', requireAuth('superadmin'), async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid admin ID' });
    }
    const admin = Admins.findById(req.params.id);
    if (!admin) return res.status(404).json({ message: 'Admin not found' });
    const patch = {};
    if (req.body?.username != null) {
      const username = String(req.body.username).trim();
      if (!username) return res.status(400).json({ message: 'Username is required' });
      const existing = await findAdminByUsername(username);
      if (existing && String(existing._id) !== String(admin._id)) {
        return res.status(409).json({ message: 'Admin username already exists' });
      }
      patch.username = username;
    }
    if (req.body?.password != null && String(req.body.password).trim()) {
      patch.password = await hashPassword(assertNewPassword(req.body.password));
    }
    return res.json({ success: true, admin: formatAdmin(Admins.update(admin._id, patch)) });
  } catch (error) {
    console.error('Error updating admin:', error);
    return res.status(error.status || 500).json({ message: error.message || 'Failed to update admin' });
  }
});

app.delete('/api/superadmin/admins/:id', requireAuth('superadmin'), async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid admin ID' });
    }
    // Foreign keys cascade: admin -> employees -> doctors -> generated posters.
    if (!Admins.remove(req.params.id)) return res.status(404).json({ message: 'Admin not found' });
    return res.json({ success: true, message: 'Admin deleted' });
  } catch (error) {
    console.error('Error deleting admin:', error);
    return res.status(500).json({ message: 'Failed to delete admin' });
  }
});

app.get('/api/superadmin/admins/:adminId/users', requireAuth('superadmin'), async (req, res) => {
  try {
    if (!isValidId(req.params.adminId)) {
      return res.status(400).json({ message: 'Invalid admin ID' });
    }
    const admin = Admins.findById(req.params.adminId);
    if (!admin) return res.status(404).json({ message: 'Admin not found' });
    const users = await listUsersForAuth(req.auth, { adminId: req.params.adminId });
    return res.json({ admin: formatAdmin(admin), users });
  } catch (error) {
    console.error('Error fetching admin users:', error);
    return res.status(500).json({ message: 'Failed to retrieve users' });
  }
});

app.post('/api/superadmin/admins/:adminId/users', requireAuth('superadmin'), async (req, res) => {
  try {
    if (!isValidId(req.params.adminId)) {
      return res.status(400).json({ message: 'Invalid admin ID' });
    }
    const admin = Admins.findById(req.params.adminId);
    if (!admin) return res.status(404).json({ message: 'Admin not found' });
    const user = await createUserUnderAdmin(admin._id, req.body || {});
    return res.status(201).json({ success: true, user });
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message || 'Failed to create user' });
  }
});

async function importEmployeesForAdmin(adminId, fileBuffer) {
  if (!fileBuffer) {
    throw Object.assign(new Error('CSV file is required'), { status: 400 });
  }

  const { headers, records } = parseCsvText(fileBuffer.toString('utf8'));
  assertCsvHeaders(headers, USER_CSV_HEADERS);

  let created = 0;
  let updated = 0;
  const errors = [];

  for (let index = 0; index < records.length; index += 1) {
    const row = records[index];
    const rowNumber = index + 2;
    try {
      const id = String(row.id || '').trim();
      const empid = String(row.empid || '').trim();
      const password = String(row.password || '');
      if (!empid) {
        throw Object.assign(new Error('Employee ID is required'), { status: 400 });
      }

      let user = null;
      if (id && isValidId(id)) {
        user = Users.findById(id);
      }
      if (!user) {
        user = await findUserByLoginId(empid);
      }

      if (user) {
        await updateUserRecord(user, { empid, password, ownerAdmin: adminId, ...csvTimestamps(row) });
        updated += 1;
      } else {
        if (!password.trim()) {
          throw Object.assign(new Error('Password is required for a new employee'), { status: 400 });
        }
        Users.create({
          empid,
          password: await hashPassword(assertNewPassword(password)),
          ownerAdmin: String(adminId),
          ...csvTimestamps(row),
        });
        created += 1;
      }
    } catch (error) {
      errors.push({ row: rowNumber, message: error.message || 'Failed to import employee' });
    }
  }

  return { created, updated, errors };
}

app.post('/api/superadmin/admins/:adminId/users/import', requireAuth('superadmin'), upload.single('file'), async (req, res) => {
  try {
    if (!isValidId(req.params.adminId)) {
      return res.status(400).json({ message: 'Invalid admin ID' });
    }
    const admin = Admins.findById(req.params.adminId);
    if (!admin) return res.status(404).json({ message: 'Admin not found' });
    const result = await importEmployeesForAdmin(admin._id, req.file?.buffer);
    return res.json({ success: true, ...result });
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message || 'Failed to import employees' });
  }
});

app.put('/api/superadmin/admins/:adminId/users/:userId', requireAuth('superadmin'), async (req, res) => {
  try {
    if (!isValidId(req.params.adminId) || !isValidId(req.params.userId)) {
      return res.status(400).json({ message: 'Invalid admin or user ID' });
    }
    const user = Users.findForAdmin(req.params.userId, req.params.adminId);
    if (!user) return res.status(404).json({ message: 'User not found for this admin' });
    const updated = await updateUserRecord(user, req.body || {});
    return res.json({ success: true, user: updated });
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message || 'Failed to update user' });
  }
});

app.delete('/api/superadmin/admins/:adminId/users/:userId', requireAuth('superadmin'), async (req, res) => {
  try {
    if (!isValidId(req.params.adminId) || !isValidId(req.params.userId)) {
      return res.status(400).json({ message: 'Invalid admin or user ID' });
    }
    const user = Users.findForAdmin(req.params.userId, req.params.adminId);
    if (!user) return res.status(404).json({ message: 'User not found for this admin' });
    await deleteUserAndDoctors(user._id);
    return res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    console.error('Error deleting user:', error);
    return res.status(500).json({ message: 'Failed to delete user' });
  }
});

app.get('/api/superadmin/admins/:adminId/users/:userId/doctors', requireAuth('superadmin'), async (req, res) => {
  try {
    if (!isValidId(req.params.adminId) || !isValidId(req.params.userId)) {
      return res.status(400).json({ message: 'Invalid admin or user ID' });
    }
    const user = Users.findForAdmin(req.params.userId, req.params.adminId);
    if (!user) return res.status(404).json({ message: 'User not found for this admin' });
    const doctors = Doctors.list({ scope: { ownerUserId: user._id } });
    return res.json({
      user: formatUser(user),
      doctors: doctors.map((doctor) => formatDoctor(doctor, { light: true })),
    });
  } catch (error) {
    console.error('Error fetching user doctors:', error);
    return res.status(500).json({ message: 'Failed to retrieve doctors' });
  }
});

app.get('/api/superadmin/admins/:adminId/users/:userId/doctors/:doctorId', requireAuth('superadmin'), async (req, res) => {
  try {
    if (!isValidId(req.params.adminId) || !isValidId(req.params.userId) || !isValidId(req.params.doctorId)) {
      return res.status(400).json({ message: 'Invalid id' });
    }
    const user = Users.findForAdmin(req.params.userId, req.params.adminId);
    if (!user) return res.status(404).json({ message: 'User not found for this admin' });
    const doctor = Doctors.findForUser(req.params.doctorId, user._id);
    if (!doctor) return res.status(404).json({ message: 'Doctor not found for this user' });
    return res.json({ doctor: formatDoctor(doctor, { includePosters: true }) });
  } catch (error) {
    console.error('Error fetching doctor:', error);
    return res.status(500).json({ message: 'Failed to retrieve doctor' });
  }
});

// --- Admin page: users under the signed-in admin (or all users for superadmin) ---
app.get('/api/admin/users', requireAuth('superadmin', 'admin'), async (req, res) => {
  try {
    const adminId = req.auth.role === 'superadmin' ? req.query.adminId : req.auth.id;
    const users = await listUsersForAuth(req.auth, { adminId });
    return res.json({ users });
  } catch (error) {
    console.error('Error fetching admin users:', error);
    return res.status(500).json({ message: 'Failed to retrieve users' });
  }
});

app.post('/api/admin/users/import', requireAuth('superadmin', 'admin'), upload.single('file'), async (req, res) => {
  try {
    const requestedAdmin = req.body?.ownerAdmin || req.query.adminId;
    const adminId = req.auth.role === 'admin' ? req.auth.id : requestedAdmin;
    if (!isValidId(adminId)) {
      return res.status(400).json({ message: 'An admin must be selected to import employees' });
    }
    if (req.auth.role === 'admin' && String(adminId) !== String(req.auth.id)) {
      return res.status(403).json({ message: 'Admins can only import employees under themselves' });
    }
    const result = await importEmployeesForAdmin(adminId, req.file?.buffer);
    return res.json({ success: true, ...result });
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message || 'Failed to import employees' });
  }
});

app.post('/api/admin/users', requireAuth('superadmin', 'admin'), async (req, res) => {
  try {
    const requestedAdmin = req.body?.ownerAdmin || req.query.adminId;
    const adminId = req.auth.role === 'admin' ? req.auth.id : requestedAdmin;
    if (!isValidId(adminId)) {
      return res.status(400).json({ message: 'An admin must be selected to create a user' });
    }
    if (req.auth.role === 'admin' && String(adminId) !== String(req.auth.id)) {
      return res.status(403).json({ message: 'Admins can only create users under themselves' });
    }
    const user = await createUserUnderAdmin(adminId, req.body || {});
    return res.status(201).json({ success: true, user });
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message || 'Failed to create user' });
  }
});

app.put('/api/admin/users/:id', requireAuth('superadmin', 'admin'), async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }
    const user = Users.findById(req.params.id);
    if (!user || !(await assertUserInScope(req.auth, user))) {
      return res.status(404).json({ message: 'User not found' });
    }
    const updates = { ...req.body };
    if (req.auth.role === 'admin') delete updates.ownerAdmin;
    const updated = await updateUserRecord(user, updates);
    return res.json({ success: true, user: updated });
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message || 'Failed to update user' });
  }
});

app.delete('/api/admin/users/:id', requireAuth('superadmin', 'admin'), async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }
    const user = Users.findById(req.params.id);
    if (!user || !(await assertUserInScope(req.auth, user))) {
      return res.status(404).json({ message: 'User not found' });
    }
    await deleteUserAndDoctors(user._id);
    return res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    console.error('Error deleting user:', error);
    return res.status(500).json({ message: 'Failed to delete user' });
  }
});

app.get('/api/admin/users/:userId/doctors', requireAuth('superadmin', 'admin'), async (req, res) => {
  try {
    if (!isValidId(req.params.userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }
    const user = Users.findById(req.params.userId);
    if (!user || !(await assertUserInScope(req.auth, user))) {
      return res.status(404).json({ message: 'User not found' });
    }
    const doctors = Doctors.list({ scope: { ownerUserId: user._id } });
    return res.json({
      user: formatUser(user),
      doctors: doctors.map((doctor) => formatDoctor(doctor, { light: true })),
    });
  } catch (error) {
    console.error('Error fetching user doctors:', error);
    return res.status(500).json({ message: 'Failed to retrieve doctors' });
  }
});

app.post('/api/admin/users/:userId/doctors/import', requireAuth('superadmin', 'admin'), upload.single('file'), async (req, res) => {
  try {
    if (!isValidId(req.params.userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }
    const user = Users.findById(req.params.userId);
    if (!user || !(await assertUserInScope(req.auth, user))) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (!req.file?.buffer) {
      return res.status(400).json({ message: 'CSV file is required' });
    }

    const { headers, records } = parseCsvText(req.file.buffer.toString('utf8'));
    assertCsvHeaders(headers, DOCTOR_CSV_HEADERS);

    const ownerUser = user._id;
    let created = 0;
    let updated = 0;
    const errors = [];

    for (let index = 0; index < records.length; index += 1) {
      const row = records[index];
      const rowNumber = index + 2;
      try {
        const name = String(row.name || '').trim();
        const clinicName = String(row.clinicName || '').trim();
        const contactnumber = parseContactNumber(row.contactnumber);
        if (!name || !clinicName || contactnumber == null) {
          throw Object.assign(new Error('name, clinicName, and contactnumber are required'), { status: 400 });
        }

        const id = String(row.id || '').trim();
        let doctor = null;
        if (id && isValidId(id)) {
          doctor = Doctors.findById(id);
        }
        if (!doctor) {
          doctor = Doctors.findByContact(contactnumber);
        }
        if (doctor && req.auth.role === 'admin' && !(await canAccessDoctor(req.auth, doctor))) {
          throw Object.assign(new Error('Doctor is outside your scope'), { status: 403 });
        }

        const fields = doctorFieldsFromCsv(row, { ownerUser });
        const posters = parsePostersCell(row.posters);
        if (doctor) {
          Doctors.updateWithPosters(doctor._id, fields, posters);
          updated += 1;
        } else {
          Doctors.create(fields, posters);
          created += 1;
        }
      } catch (error) {
        errors.push({ row: rowNumber, message: error.message || 'Failed to import doctor' });
      }
    }

    return res.json({ success: true, created, updated, errors });
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message || 'Failed to import doctors' });
  }
});

app.get('/api/admin/users/:userId/doctors/:doctorId', requireAuth('superadmin', 'admin'), async (req, res) => {
  try {
    if (!isValidId(req.params.userId) || !isValidId(req.params.doctorId)) {
      return res.status(400).json({ message: 'Invalid user or doctor ID' });
    }
    const user = Users.findById(req.params.userId);
    if (!user || !(await assertUserInScope(req.auth, user))) {
      return res.status(404).json({ message: 'User not found' });
    }
    const doctor = Doctors.findForUser(req.params.doctorId, user._id);
    if (!doctor) return res.status(404).json({ message: 'Doctor not found for this user' });
    return res.json({ doctor: formatDoctor(doctor, { includePosters: true }) });
  } catch (error) {
    console.error('Error fetching doctor:', error);
    return res.status(500).json({ message: 'Failed to retrieve doctor' });
  }
});

app.get('/api/super-admin/users', requireAuth('superadmin', 'admin'), async (req, res) => {
  try {
    const users = await listUsersForAuth(req.auth);
    return res.json({ users });
  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({ message: 'Failed to retrieve users' });
  }
});

app.get('/api/super-admin/users/:userId/doctors', requireAuth('superadmin', 'admin'), async (req, res) => {
  try {
    if (!isValidId(req.params.userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }
    const user = Users.findById(req.params.userId);
    if (!user || !(await assertUserInScope(req.auth, user))) {
      return res.status(404).json({ message: 'User not found' });
    }
    const doctors = Doctors.list({ scope: { ownerUserId: user._id } });
    return res.json({
      user: formatUser(user),
      doctors: doctors.map((doctor) => formatDoctor(doctor, { light: true })),
    });
  } catch (error) {
    console.error('Error fetching user doctors:', error);
    return res.status(500).json({ message: 'Failed to retrieve doctors' });
  }
});

app.get('/api/super-admin/users/:userId/doctors/:doctorId', requireAuth('superadmin', 'admin'), async (req, res) => {
  try {
    if (!isValidId(req.params.userId) || !isValidId(req.params.doctorId)) {
      return res.status(400).json({ message: 'Invalid user or doctor ID' });
    }
    const user = Users.findById(req.params.userId);
    if (!user || !(await assertUserInScope(req.auth, user))) {
      return res.status(404).json({ message: 'User not found' });
    }
    const doctor = Doctors.findForUser(req.params.doctorId, user._id);
    if (!doctor) return res.status(404).json({ message: 'Doctor not found for this user' });
    return res.json({ doctor: formatDoctor(doctor, { includePosters: true }) });
  } catch (error) {
    console.error('Error fetching doctor:', error);
    return res.status(500).json({ message: 'Failed to retrieve doctor' });
  }
});

const COLLECTIONS = new Set(['doctors', 'users']);

function scopeForCollection(auth, collection) {
  if (collection === 'doctors') return doctorScopeForAuth(auth);
  if (collection === 'users') return userScopeForAuth(auth);
  return null;
}

/** Whitelisted doctor columns accepted by the generic collection endpoints. */
async function doctorPatchFromBody(body, auth) {
  const patch = {};
  if (body.name !== undefined) patch.name = String(body.name || '').trim() || 'Doctor';
  if (body.clinicName !== undefined) patch.clinicName = String(body.clinicName || '').trim();
  if (body.doctorDegree !== undefined) patch.doctorDegree = String(body.doctorDegree || '').trim();
  if (body.contactnumber !== undefined) patch.contactnumber = body.contactnumber;
  if (body.logo !== undefined) patch.logo = normalizeStoredPath(body.logo);
  if (body.poster !== undefined) patch.poster = normalizeStoredPath(body.poster);
  if (body.active !== undefined) patch.active = body.active !== false && String(body.active) !== 'false';
  if (body.dynamicFields !== undefined && body.dynamicFields && typeof body.dynamicFields === 'object') {
    patch.dynamicFields = body.dynamicFields;
  }
  if (body.ownerUser !== undefined && auth.role !== 'user') {
    const owner = isValidId(String(body.ownerUser || '')) ? Users.findById(body.ownerUser) : null;
    const allowed = owner && (auth.role === 'superadmin' || String(owner.ownerAdmin || '') === String(auth.id));
    patch.ownerUser = allowed ? owner._id : null;
  }
  return patch;
}

app.get('/api/userpanel/collections/:collection', requireAuth('superadmin', 'admin', 'user'), async (req, res, next) => {
  req.url = `/api/admin/collections/${req.params.collection}`;
  next();
});

app.get('/api/admin/collections/:collection', requireAuth('superadmin', 'admin', 'user'), async (req, res) => {
  try {
    if (req.params.collection !== 'doctors' && req.auth.role === 'user') {
      return res.status(403).json({ message: 'Users can only access doctors' });
    }
    if (!COLLECTIONS.has(req.params.collection)) return res.status(404).json({ message: 'Collection not found' });

    const scope = scopeForCollection(req.auth, req.params.collection);
    if (req.params.collection === 'doctors') {
      const docs = Doctors.list({ scope });
      return res.status(200).json(docs.map(d => formatDoctor(d, { includePosters: true })));
    }
    return res.status(200).json(Users.listWithCounts(scope).map((user) => formatUser(user)));
  } catch (err) {
    res.status(500).json({ message: 'Error fetching collection', error: err.message });
  }
});

// DataTables server-side processing endpoint
app.get('/api/userpanel/datatables/:collection', requireAuth('superadmin', 'admin', 'user'), async (req, res, next) => {
  req.url = `/api/admin/datatables/${req.params.collection}`;
  next();
});

app.get('/api/admin/datatables/:collection', requireAuth('superadmin', 'admin', 'user'), async (req, res) => {
  try {
    const collection = req.params.collection;
    if (collection !== 'doctors' && req.auth.role === 'user') {
      return res.status(403).json({ message: 'Users can only access doctors' });
    }
    if (!COLLECTIONS.has(collection)) return res.status(404).json({ message: 'Collection not found' });
    const scope = scopeForCollection(req.auth, collection);

    const draw = Number(req.query.draw) || 1;
    const start = Math.max(0, Number(req.query.start) || 0);
    const lengthRaw = Number(req.query.length);
    const length = Number.isFinite(lengthRaw) && lengthRaw > 0 ? Math.min(lengthRaw, 100) : 10;
    const searchValue = String(
      req.query.search?.value ?? req.query['search[value]'] ?? ''
    ).trim();

    const orderCol = Number(
      req.query.order?.[0]?.column ?? req.query['order[0][column]'] ?? 1
    );
    const orderDir =
      String(req.query.order?.[0]?.dir ?? req.query['order[0][dir]'] ?? 'asc').toLowerCase() ===
        'desc'
        ? 'DESC'
        : 'ASC';

    const doctorColumns = ['id', 'name', 'clinicName', 'contactnumber', 'logo', 'poster', null];
    const userColumns = ['id', 'empid', null];
    const columns = collection === 'doctors' ? doctorColumns : userColumns;
    const sortField = columns[orderCol] && columns[orderCol] !== 'id' ? columns[orderCol] : 'createdAt';
    // Column 0 (id) means "newest first".
    const sortDir = sortField === 'createdAt' && orderCol === 0 ? 'DESC' : orderDir;

    let recordsTotal;
    let recordsFiltered;
    let data;
    if (collection === 'doctors') {
      const fromStr = String(req.query.from ?? req.query.dateFrom ?? '').trim();
      const toStr = String(req.query.to ?? req.query.dateTo ?? '').trim();
      let from = null;
      let to = null;
      if (fromStr) {
        const date = new Date(fromStr);
        if (!Number.isNaN(date.getTime())) {
          date.setHours(0, 0, 0, 0);
          from = date.toISOString();
        }
      }
      if (toStr) {
        const date = new Date(toStr);
        if (!Number.isNaN(date.getTime())) {
          date.setHours(23, 59, 59, 999);
          to = date.toISOString();
        }
      }

      const filter = { scope, search: searchValue, from, to };
      recordsTotal = Doctors.count({ scope });
      recordsFiltered = Doctors.count(filter);
      data = Doctors.list(filter, { sortField, sortDir, offset: start, limit: length }).map((d) => formatDoctor(d));
    } else {
      const page = Users.page(scope, { search: searchValue, sortField, sortDir, offset: start, limit: length });
      recordsTotal = page.total;
      recordsFiltered = page.filtered;
      data = page.rows.map((user) => formatUser(user));
    }

    return res.status(200).json({
      draw,
      recordsTotal,
      recordsFiltered,
      data,
    });
  } catch (err) {
    console.error('DataTables error:', err);
    res.status(500).json({
      draw: Number(req.query.draw) || 1,
      recordsTotal: 0,
      recordsFiltered: 0,
      data: [],
      error: err.message,
    });
  }
});

app.post('/api/userpanel/collections/:collection', requireAuth('superadmin', 'admin', 'user'), async (req, res, next) => {
  req.url = `/api/admin/collections/${req.params.collection}`;
  next();
});

app.post('/api/admin/collections/:collection', requireAuth('superadmin', 'admin', 'user'), async (req, res) => {
  try {
    if (req.params.collection !== 'doctors' && req.auth.role === 'user') {
      return res.status(403).json({ message: 'Users can only access doctors' });
    }
    if (!COLLECTIONS.has(req.params.collection)) return res.status(404).json({ message: 'Collection not found' });

    const body = { ...req.body };
    if (req.params.collection === 'users') {
      const requestedAdmin = req.auth.role === 'admin' ? req.auth.id : body.ownerAdmin;
      const adminId = isValidId(String(requestedAdmin || '')) && Admins.findById(requestedAdmin) ? requestedAdmin : null;
      const user = await createUserUnderAdmin(adminId, body);
      return res.status(201).json({ success: true, data: user });
    }

    if (body.contactnumber) {
      const cleanedContact = assertContactNumber(body.contactnumber);
      body.contactnumber = cleanedContact;
      if (Doctors.findByContact(cleanedContact)) {
        return res.status(400).json({ message: 'This mobile number already exists for another doctor.' });
      }
    }

    if (!body.logo && (await isDoctorLogoRequired())) {
      return res.status(400).json({ message: 'Doctor logo is required.' });
    }

    if (body.logo && typeof body.logo === 'string' && body.logo.startsWith('data:')) {
      const logoBuffer = Buffer.from(body.logo.replace(/^data:image\/\w+;base64,/, ''), 'base64');
      body.logo = await saveFile(logoBuffer, null, 'logos');
    }
    let posters = [];
    if (body.poster && typeof body.poster === 'string' && body.poster.startsWith('data:')) {
      const posterBuffer = Buffer.from(body.poster.replace(/^data:image\/\w+;base64,/, ''), 'base64');
      body.poster = await saveFile(posterBuffer, null, 'posters');
      posters = [{ image: body.poster, downloads: 0, createdAt: new Date() }];
    }

    const data = await doctorPatchFromBody(body, req.auth);
    if (req.auth.role === 'user') data.ownerUser = req.auth.id;
    if (!data.name) data.name = 'Doctor';
    data.active = data.active !== false;

    const doctor = Doctors.create(data, posters);
    res.status(201).json({ success: true, data: formatDoctor(doctor) });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || 'Error creating document' });
  }
});

app.put('/api/userpanel/collections/:collection/:id', requireAuth('superadmin', 'admin', 'user'), async (req, res, next) => {
  req.url = `/api/admin/collections/${req.params.collection}/${req.params.id}`;
  next();
});

app.put('/api/admin/collections/:collection/:id', requireAuth('superadmin', 'admin', 'user'), async (req, res) => {
  try {
    if (req.params.collection !== 'doctors' && req.auth.role === 'user') {
      return res.status(403).json({ message: 'Users can only access doctors' });
    }
    if (!COLLECTIONS.has(req.params.collection)) return res.status(404).json({ message: 'Collection not found' });

    if (req.params.collection === 'users') {
      const existingUser = Users.findById(req.params.id);
      if (!existingUser || !(await assertUserInScope(req.auth, existingUser))) {
        return res.status(404).json({ message: 'Document not found' });
      }
      const updates = { ...req.body };
      if (req.auth.role === 'admin') delete updates.ownerAdmin;
      const user = await updateUserRecord(existingUser, {
        empid: updates.empid,
        password: updates.password,
        ownerAdmin: updates.ownerAdmin,
      });
      return res.status(200).json({ success: true, data: user });
    }

    const body = { ...req.body };
    if (body.contactnumber) {
      const cleanedContact = assertContactNumber(body.contactnumber);
      body.contactnumber = cleanedContact;
      const existingDoc = Doctors.findByContact(cleanedContact);
      if (existingDoc && String(existingDoc._id) !== String(req.params.id)) {
        return res.status(400).json({ message: 'This mobile number already exists for another doctor.' });
      }
    }

    if (Object.prototype.hasOwnProperty.call(body, 'logo') && !body.logo && (await isDoctorLogoRequired())) {
      return res.status(400).json({ message: 'Doctor logo is required.' });
    }

    if (body.logo && typeof body.logo === 'string' && body.logo.startsWith('data:')) {
      const logoBuffer = Buffer.from(body.logo.replace(/^data:image\/\w+;base64,/, ''), 'base64');
      body.logo = await saveFile(logoBuffer, null, 'logos');
    }
    if (body.poster && typeof body.poster === 'string' && body.poster.startsWith('data:')) {
      const posterBuffer = Buffer.from(body.poster.replace(/^data:image\/\w+;base64,/, ''), 'base64');
      body.poster = await saveFile(posterBuffer, null, 'posters');
    }

    const existing = Doctors.findById(req.params.id);
    if (!existing || !(await canAccessDoctor(req.auth, existing))) {
      return res.status(404).json({ message: 'Document not found' });
    }

    const doctor = Doctors.update(existing._id, await doctorPatchFromBody(body, req.auth));
    res.status(200).json({ success: true, data: formatDoctor(doctor) });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || 'Error updating document' });
  }
});

app.delete('/api/userpanel/collections/:collection/:id', requireAuth('superadmin', 'admin', 'user'), async (req, res, next) => {
  req.url = `/api/admin/collections/${req.params.collection}/${req.params.id}`;
  next();
});

app.delete('/api/admin/collections/:collection/:id', requireAuth('superadmin', 'admin', 'user'), async (req, res) => {
  try {
    if (req.params.collection !== 'doctors' && req.auth.role === 'user') {
      return res.status(403).json({ message: 'Users can only access doctors' });
    }
    if (!COLLECTIONS.has(req.params.collection)) return res.status(404).json({ message: 'Collection not found' });

    if (req.params.collection === 'doctors') {
      const existing = Doctors.findById(req.params.id);
      if (!existing || !(await canAccessDoctor(req.auth, existing))) {
        return res.status(404).json({ message: 'Document not found' });
      }
      Doctors.remove(existing._id);
    } else {
      const existing = Users.findById(req.params.id);
      if (!existing || !(await assertUserInScope(req.auth, existing))) {
        return res.status(404).json({ message: 'Document not found' });
      }
      Users.remove(existing._id);
    }

    res.status(200).json({ success: true, message: 'Document deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting document', error: err.message });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Centralized error handling middleware
app.use((err, req, res, next) => {
  console.error('Centralized Server Error:', err);
  res.status(err.status || 500).json({
    message: err.message || 'Internal server error',
    error: err.toString(),
  });
});

// --- Superadmin Template Posters API ---
app.get('/api/posters', requireAuth('superadmin', 'admin', 'user'), async (req, res) => {
  try {
    const { month, category } = req.query;
    const posters = PosterTemplates.list({
      status: 'published',
      enabledOnly: true,
      month: month ? String(month) : undefined,
      category: category && category !== 'all' ? String(category) : undefined,
    });
    res.status(200).json({ posters });
  } catch (error) {
    console.error('Error fetching posters:', error);
    res.status(500).json({ message: 'Failed to fetch posters' });
  }
});

const POSTER_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const POSTER_FIELD_MIN_W = 0.01;
const POSTER_FIELD_MIN_H = 0.01;

function parseJsonField(raw, fallback) {
  if (raw === undefined || raw === '') return fallback;
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// Validates the field layout sent by the poster designer. Drafts only need clean geometry;
// a published poster needs a category and every active doctor field placed.
async function resolvePosterLayout(body, status) {
  const rawFields = parseJsonField(body.fields, []);
  const rawDisabled = parseJsonField(body.disabledFields, []);
  if (!Array.isArray(rawFields) || !Array.isArray(rawDisabled)) {
    return { error: 'Invalid field layout' };
  }

  const disabledFields = [...new Set(rawDisabled.map((k) => String(k).trim()).filter(Boolean))];
  const seen = new Set();
  let fields = [];
  for (const raw of rawFields) {
    const key = String(raw?.key || '').trim();
    if (!key) return { error: 'Every placed field needs a key' };
    if (seen.has(key)) return { error: `Field "${key}" is placed more than once` };
    seen.add(key);

    const x = Number(raw.x);
    const y = Number(raw.y);
    const w = Number(raw.w);
    const h = Number(raw.h);
    const inside = [x, y, w, h].every(Number.isFinite)
      && x >= 0 && y >= 0 && w >= POSTER_FIELD_MIN_W && h >= POSTER_FIELD_MIN_H
      && x + w <= 1.001 && y + h <= 1.001;
    if (!inside) return { error: `Field "${key}" has an invalid position` };

    fields.push({
      key,
      type: String(raw.type || 'text'),
      x,
      y,
      w: Math.min(w, 1 - x),
      h: Math.min(h, 1 - y),
      color: /^#[0-9a-f]{6}$/i.test(String(raw.color || '')) ? String(raw.color) : '#ffffff',
      align: ['left', 'center', 'right'].includes(raw.align) ? raw.align : 'left',
      shape: ['circle', 'rectangle', 'square'].includes(raw.shape) ? raw.shape : 'rectangle',
    });
  }

  if (status === 'draft') return { fields, disabledFields, category: String(body.category || '').trim() };

  const categoryName = String(body.category || '').trim();
  if (!categoryName) return { error: 'Choose a category for this poster' };
  const category = Categories.findByName(categoryName);
  if (!category) return { error: 'Choose one of the existing poster categories' };

  const themeName = String(body.color || '').trim();
  if (!themeName) return { error: 'Choose a theme for this poster' };
  const theme = Themes.findByName(themeName);
  if (!theme) return { error: 'Choose one of the existing poster themes' };

  const monthName = String(body.month || '').trim();
  const month = POSTER_MONTHS.find((m) => m.toLowerCase() === monthName.toLowerCase());
  if (!month) return { error: 'Choose a month for this poster' };

  const activeFields = DoctorFields.list({ enabledOnly: true });
  const activeKeys = new Set(activeFields.map((f) => f.key));
  const disabled = new Set(disabledFields);

  fields = fields.filter((f) => !disabled.has(f.key));
  const unknown = fields.find((f) => !activeKeys.has(f.key));
  if (unknown) return { error: `Field "${unknown.key}" is not an active doctor field` };
  if (fields.length === 0) return { error: 'Place at least one field on the poster' };

  const placed = new Set(fields.map((f) => f.key));
  const missing = activeFields.filter((f) => !disabled.has(f.key) && !placed.has(f.key));
  if (missing.length > 0) {
    return { error: `Place every field on the poster before saving. Missing: ${missing.map((f) => f.label).join(', ')}` };
  }

  return { fields, disabledFields, category: category.name, color: theme.name, month };
}

app.get('/api/superadmin/posters', requireAuth('superadmin'), async (req, res) => {
  try {
    if (req.query.status === 'draft') {
      const drafts = PosterTemplates.list({ status: 'draft', orderBy: 'updatedAt' });
      return res.status(200).json({ posters: drafts });
    }
    const posters = PosterTemplates.list({ status: 'published' });
    res.status(200).json({ posters });
  } catch (error) {
    console.error('Error fetching posters:', error);
    res.status(500).json({ message: 'Failed to fetch posters' });
  }
});

app.post('/api/superadmin/posters', requireAuth('superadmin'), upload.any(), async (req, res) => {
  try {
    const { uploaddate } = req.body;
    let { color, month } = req.body;
    let category = req.body.category;
    let posterlink = req.body.posterlink || '';

    const posterFile = req.files?.find((f) => f.fieldname === 'posterFile');
    if (posterFile) {
      posterlink = await saveFile(posterFile.buffer, posterFile.originalname, 'master_posters');
    }

    if (!posterlink) {
      return res.status(400).json({ message: 'Poster file or link is required' });
    }

    // Only the designer sends `fields`; the plain upload form creates a legacy footer poster.
    const status = req.body.status === 'draft' ? 'draft' : 'published';
    let layout = { fields: [], disabledFields: [] };
    if (req.body.fields !== undefined) {
      layout = await resolvePosterLayout(req.body, status);
      if (layout.error) return res.status(400).json({ message: layout.error });
      category = layout.category;
      if (status === 'published') ({ color, month } = layout);
    }

    const enabledVal = req.body.enabled === undefined ? true : String(req.body.enabled) === 'true' || req.body.enabled === true;
    const newPoster = PosterTemplates.create({
      posterlink,
      category: category || '',
      color: color || '',
      month: month || '',
      enabled: enabledVal,
      status,
      fields: layout.fields,
      disabledFields: layout.disabledFields,
      ...(uploaddate ? { uploaddate: new Date(uploaddate) } : {}),
    });

    res.status(201).json({ success: true, poster: newPoster });
  } catch (error) {
    console.error('Error creating poster:', error);
    res.status(500).json({ message: 'Failed to upload poster' });
  }
});

app.put('/api/superadmin/posters/:id', requireAuth('superadmin'), upload.any(), async (req, res) => {
  try {
    const { uploaddate } = req.body;
    let { color, month } = req.body;
    let category = req.body.category;
    if (!PosterTemplates.findById(req.params.id)) return res.status(404).json({ message: 'Poster not found' });
    const poster = {};

    const posterFile = req.files?.find((f) => f.fieldname === 'posterFile');
    if (posterFile) {
      poster.posterlink = await saveFile(posterFile.buffer, posterFile.originalname, 'master_posters');
    } else if (req.body.posterlink) {
      poster.posterlink = req.body.posterlink;
    }

    if (req.body.fields !== undefined) {
      const status = req.body.status === 'draft' ? 'draft' : 'published';
      const layout = await resolvePosterLayout(req.body, status);
      if (layout.error) return res.status(400).json({ message: layout.error });
      poster.status = status;
      poster.fields = layout.fields;
      poster.disabledFields = layout.disabledFields;
      category = layout.category;
      if (status === 'published') ({ color, month } = layout);
    }

    if (category !== undefined) poster.category = category;
    if (color !== undefined) poster.color = color;
    if (month !== undefined) poster.month = month;
    if (req.body.enabled !== undefined) {
      poster.enabled = String(req.body.enabled) === 'true' || req.body.enabled === true;
    }
    if (uploaddate) poster.uploaddate = new Date(uploaddate);

    const saved = PosterTemplates.update(req.params.id, poster);
    res.status(200).json({ success: true, poster: saved });
  } catch (error) {
    console.error('Error updating poster:', error);
    res.status(500).json({ message: 'Failed to update poster' });
  }
});

app.patch('/api/superadmin/posters/:id/toggle-status', requireAuth('superadmin'), async (req, res) => {
  try {
    const existing = PosterTemplates.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Poster not found' });
    const poster = PosterTemplates.update(existing._id, { enabled: existing.enabled === false });
    res.status(200).json({ success: true, poster });
  } catch (error) {
    console.error('Error toggling poster status:', error);
    res.status(500).json({ message: 'Failed to toggle poster status' });
  }
});

app.delete('/api/superadmin/posters/:id', requireAuth('superadmin'), async (req, res) => {
  try {
    if (!PosterTemplates.remove(req.params.id)) return res.status(404).json({ message: 'Poster not found' });
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error deleting poster:', error);
    res.status(500).json({ message: 'Failed to delete poster' });
  }
});

// --- Poster Categories API ---
app.get('/api/categories', requireAuth('superadmin', 'admin', 'user'), async (req, res) => {
  try {
    const categories = Categories.list({ enabledOnly: req.query.includeDisabled !== 'true', orderBy: 'name' });
    res.status(200).json({ categories });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ message: 'Failed to fetch categories' });
  }
});

app.get('/api/superadmin/categories', requireAuth('superadmin'), async (req, res) => {
  try {
    const categories = Categories.list({ orderBy: 'createdAt' });
    const countMap = PosterTemplates.countsByCategory();
    const formatted = categories.map((c) => ({
      _id: c._id,
      name: c.name,
      enabled: c.enabled !== false,
      createdAt: c.createdAt,
      posterCount: countMap.get(c.name.toLowerCase()) || 0,
    }));
    res.status(200).json({ categories: formatted });
  } catch (error) {
    console.error('Error fetching superadmin categories:', error);
    res.status(500).json({ message: 'Failed to fetch categories' });
  }
});

app.post('/api/superadmin/categories', requireAuth('superadmin'), async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) {
      return res.status(400).json({ message: 'Category name is required' });
    }
    if (Categories.findByName(name)) {
      return res.status(400).json({ message: 'Category already exists' });
    }
    const enabled = req.body.enabled === undefined ? true : Boolean(req.body.enabled);
    const category = Categories.create({ name, enabled });
    res.status(201).json({ success: true, category });
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(error.status || 500).json({ message: error.status ? error.message : 'Failed to create category' });
  }
});

app.put('/api/superadmin/categories/:id', requireAuth('superadmin'), async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) {
      return res.status(400).json({ message: 'Category name is required' });
    }
    const category = Categories.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    const existing = Categories.findByName(name);
    if (existing && existing._id !== category._id) {
      return res.status(400).json({ message: 'Another category with this name already exists' });
    }
    const oldName = category.name;
    const patch = { name };
    if (req.body.enabled !== undefined) {
      patch.enabled = Boolean(req.body.enabled);
    }
    const saved = Categories.update(category._id, patch);

    if (oldName.toLowerCase() !== name.toLowerCase()) {
      PosterTemplates.renameCategory(oldName, name);
    }

    res.status(200).json({ success: true, category: saved });
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(error.status || 500).json({ message: error.status ? error.message : 'Failed to update category' });
  }
});

app.patch('/api/superadmin/categories/:id/toggle-status', requireAuth('superadmin'), async (req, res) => {
  try {
    const existing = Categories.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Category not found' });
    const category = Categories.update(existing._id, { enabled: existing.enabled === false });
    res.status(200).json({ success: true, category });
  } catch (error) {
    console.error('Error toggling category status:', error);
    res.status(500).json({ message: 'Failed to toggle category status' });
  }
});

app.delete('/api/superadmin/categories/:id', requireAuth('superadmin'), async (req, res) => {
  try {
    if (!Categories.remove(req.params.id)) {
      return res.status(404).json({ message: 'Category not found' });
    }
    res.status(200).json({ success: true, message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ message: 'Failed to delete category' });
  }
});

// --- Poster Themes API ---
app.get('/api/themes', requireAuth('superadmin', 'admin', 'user'), async (req, res) => {
  try {
    const themes = Themes.list({ enabledOnly: req.query.includeDisabled !== 'true', orderBy: 'createdAtAsc' });
    res.status(200).json({ themes });
  } catch (error) {
    console.error('Error fetching themes:', error);
    res.status(500).json({ message: 'Failed to fetch themes' });
  }
});

app.get('/api/superadmin/themes', requireAuth('superadmin'), async (req, res) => {
  try {
    const themes = Themes.list({ orderBy: 'createdAtDesc' });
    const countByColor = PosterTemplates.countsByColor();
    const formatted = themes.map((t) => {
      const tName = t.name.toLowerCase();
      const tSlug = (t.slug || '').toLowerCase();
      const posterCount = (countByColor.get(tName) || 0) + (tSlug && tSlug !== tName ? countByColor.get(tSlug) || 0 : 0);
      return {
        _id: t._id,
        name: t.name,
        slug: t.slug,
        headerBg: t.headerBg,
        footerBg: t.footerBg,
        accentColor: t.accentColor,
        description: t.description,
        cardGlow: t.cardGlow,
        enabled: t.enabled !== false,
        createdAt: t.createdAt,
        posterCount,
      };
    });
    res.status(200).json({ themes: formatted });
  } catch (error) {
    console.error('Error fetching superadmin themes:', error);
    res.status(500).json({ message: 'Failed to fetch themes' });
  }
});

app.post('/api/superadmin/themes', requireAuth('superadmin'), async (req, res) => {
  try {
    const { name, headerBg, footerBg, accentColor, description } = req.body;
    const trimmed = String(name || '').trim();
    if (!trimmed) {
      return res.status(400).json({ message: 'Theme name is required' });
    }
    if (Themes.findByName(trimmed)) {
      return res.status(400).json({ message: 'Theme with this name already exists' });
    }

    const hBg = String(headerBg || '#1a4f8b').trim();
    const fBg = String(footerBg || '#143a66').trim();
    const aColor = String(accentColor || '#2b6cb0').trim();
    const enabled = req.body.enabled === undefined ? true : Boolean(req.body.enabled);

    const theme = Themes.create({
      name: trimmed,
      slug: slugifyTheme(trimmed),
      headerBg: hBg,
      footerBg: fBg,
      accentColor: aColor,
      description: String(description || '').trim(),
      cardGlow: `${hBg}25`,
      enabled,
    });
    res.status(201).json({ success: true, theme });
  } catch (error) {
    console.error('Error creating theme:', error);
    res.status(error.status || 500).json({ message: error.status ? error.message : 'Failed to create theme' });
  }
});

app.put('/api/superadmin/themes/:id', requireAuth('superadmin'), async (req, res) => {
  try {
    const { name, headerBg, footerBg, accentColor, description } = req.body;
    const trimmed = String(name || '').trim();
    if (!trimmed) {
      return res.status(400).json({ message: 'Theme name is required' });
    }
    const theme = Themes.findById(req.params.id);
    if (!theme) {
      return res.status(404).json({ message: 'Theme not found' });
    }
    const existing = Themes.findByName(trimmed);
    if (existing && existing._id !== theme._id) {
      return res.status(400).json({ message: 'Another theme with this name already exists' });
    }

    const oldName = theme.name;
    const patch = { name: trimmed, slug: slugifyTheme(trimmed) };
    if (headerBg) patch.headerBg = String(headerBg).trim();
    if (footerBg) patch.footerBg = String(footerBg).trim();
    if (accentColor) patch.accentColor = String(accentColor).trim();
    if (description !== undefined) patch.description = String(description).trim();
    if (req.body.enabled !== undefined) {
      patch.enabled = Boolean(req.body.enabled);
    }
    patch.cardGlow = `${patch.headerBg || theme.headerBg}25`;
    const saved = Themes.update(theme._id, patch);

    if (oldName.toLowerCase() !== trimmed.toLowerCase()) {
      PosterTemplates.renameColor(oldName, trimmed);
    }

    res.status(200).json({ success: true, theme: saved });
  } catch (error) {
    console.error('Error updating theme:', error);
    res.status(error.status || 500).json({ message: error.status ? error.message : 'Failed to update theme' });
  }
});

app.patch('/api/superadmin/themes/:id/toggle-status', requireAuth('superadmin'), async (req, res) => {
  try {
    const existing = Themes.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Theme not found' });
    const theme = Themes.update(existing._id, { enabled: existing.enabled === false });
    res.status(200).json({ success: true, theme });
  } catch (error) {
    console.error('Error toggling theme status:', error);
    res.status(500).json({ message: 'Failed to toggle theme status' });
  }
});

app.delete('/api/superadmin/themes/:id', requireAuth('superadmin'), async (req, res) => {
  try {
    const theme = Themes.findById(req.params.id);
    if (!theme) {
      return res.status(404).json({ message: 'Theme not found' });
    }
    Themes.remove(theme._id);
    // Remove the master posters built on this theme. Posters already saved on doctors are separate copies and stay.
    const deletedCount = PosterTemplates.removeByColors([theme.name, theme.slug].filter(Boolean));
    res.status(200).json({ success: true, message: 'Theme deleted successfully', deletedPosters: deletedCount });
  } catch (error) {
    console.error('Error deleting theme:', error);
    res.status(500).json({ message: 'Failed to delete theme' });
  }
});

/** Default rows for a brand-new database. */
function seedDefaults() {
  if (DoctorFields.count() === 0) {
    console.log('Seeding standard doctor fields...');
    [
      { key: 'name', label: 'Doctor Name', type: 'text', required: true, isStandard: true, enabled: true, order: 1 },
      { key: 'clinicName', label: 'Clinic Name', type: 'text', required: true, isStandard: true, enabled: true, order: 2 },
      { key: 'doctorDegree', label: 'Degree', type: 'text', required: false, isStandard: true, enabled: true, order: 3 },
      { key: 'contactnumber', label: 'Contact Number', type: 'tel', required: true, isStandard: true, enabled: true, order: 4 },
      { key: 'logo', label: 'Doctor Photo / Logo', type: 'file', required: false, isStandard: true, enabled: true, order: 100 },
    ].forEach((field) => DoctorFields.create(field));
  } else if (!DoctorFields.findByKey('logo')) {
    DoctorFields.create({ key: 'logo', label: 'Doctor Photo / Logo', type: 'file', required: false, isStandard: true, enabled: true, order: 100 });
  }

  if (Categories.count() === 0) {
    console.log('Seeding default poster categories...');
    ['Education', 'Festivals', 'Videos'].forEach((name) => Categories.create({ name, enabled: true }));
  }

  if (Themes.count() === 0) {
    console.log('Seeding default poster themes...');
    [
      {
        name: 'Cool Blue',
        slug: 'theme-blue',
        headerBg: '#1a4f8b',
        footerBg: '#143a66',
        accentColor: '#2b6cb0',
        description: 'Professional medical blue',
        cardGlow: 'rgba(26, 79, 139, 0.12)',
      },
      {
        name: 'Warm Red',
        slug: 'theme-warm-red',
        headerBg: '#9c1c4a',
        footerBg: '#7a1540',
        accentColor: '#c0267a',
        description: 'Warm crimson and rose',
        cardGlow: 'rgba(198, 38, 122, 0.12)',
      },
      {
        name: 'Emerald Green',
        slug: 'theme-green',
        headerBg: '#1b5c45',
        footerBg: '#134435',
        accentColor: '#218a62',
        description: 'Natural emerald wellness',
        cardGlow: 'rgba(27, 92, 69, 0.14)',
      },
      {
        name: 'Royal Purple',
        slug: 'theme-purple',
        headerBg: '#4c1d95',
        footerBg: '#2e1065',
        accentColor: '#7c3aed',
        description: 'Soft royal lilac',
        cardGlow: 'rgba(124, 58, 237, 0.14)',
      },
    ].forEach((theme) => Themes.create({ ...theme, enabled: true }));
  }
}

// Serve only the production build, never the repository directory.
app.use('/api', (_req, res) => res.status(404).json({ message: 'API route not found' }));
app.use('/uploads', (_req, res) => res.sendStatus(404));
const DIST_DIR = path.join(PROJECT_DIR, 'dist');
app.use((req, res, next) => {
  if (req.path.split('/').some((part) => part.startsWith('.'))) return res.sendStatus(404);
  next();
});
app.use(express.static(DIST_DIR, { index: 'index.html' }));
app.get('*', (req, res) => {
  if (path.extname(req.path)) return res.sendStatus(404);
  res.sendFile(path.join(DIST_DIR, 'index.html'));
});

const startServer = () => {
  try {
    console.log(`Using SQLite database at ${DB_PATH}`);
    seedDefaults();

    app.listen(PORT, process.env.HOST || '127.0.0.1', () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
};

startServer();
