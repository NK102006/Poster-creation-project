import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import multer from 'multer';
import dotenv from 'dotenv';
import session from 'express-session';
import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import net from 'net';
import path from 'path';

const execFileAsync = promisify(execFile);

dotenv.config();

const app = express();
app.use(session({
  secret: 'Secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
  },
}));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB limit for high-res posters and videos
});

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/posterCreation';

app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ extended: true, limit: '500mb' }));

const UPLOADS_DIR = path.resolve('uploads');
fs.mkdirSync(path.join(UPLOADS_DIR, 'logos'), { recursive: true });
fs.mkdirSync(path.join(UPLOADS_DIR, 'posters'), { recursive: true });
fs.mkdirSync(path.join(UPLOADS_DIR, 'festival_posters'), { recursive: true });
fs.mkdirSync(path.join(UPLOADS_DIR, 'education_posters'), { recursive: true });
fs.mkdirSync(path.join(UPLOADS_DIR, 'videos'), { recursive: true });
app.use('/uploads', express.static(UPLOADS_DIR));

// Schemas & Models
const posterEntrySchema = new mongoose.Schema(
  {
    image: { type: mongoose.Schema.Types.Mixed, required: true },
    downloads: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    kind: { type: String, enum: ['education', 'festival', 'video'], default: 'education' },
    label: { type: String, default: '' },
  },
  { _id: true }
);

function normalizePosterKind(value, imageHint = '') {
  const raw = String(value || '').toLowerCase();
  if (raw === 'festival' || raw === 'video' || raw === 'education') return raw;
  if (raw === 'gk') return 'education';
  const src = String(imageHint || '');
  if (src.includes('.mp4') || src.includes('video')) return 'video';
  return 'education';
}

const doctorSchema = new mongoose.Schema({
  ownerUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  ownerAdmin: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null, index: true },
  name: { type: String, required: true },
  clinicName: { type: String, required: true, trim: true },
  doctorDegree: { type: String, trim: true, default: '' },
  contactnumber: { type: Number, required: true },
  logo: { type: mongoose.Schema.Types.Mixed },
  poster: { type: mongoose.Schema.Types.Mixed }, // latest poster (legacy + convenience)
  posters: { type: [posterEntrySchema], default: [] },
  downloadCount: { type: Number, default: 0 },
  active: { type: Boolean, default: true },
}, { timestamps: true });

const userSchema = new mongoose.Schema({
  empid: { type: mongoose.Schema.Types.Mixed },
  password: { type: String, required: true },
  ownerAdmin: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null, index: true },
}, { strict: false, timestamps: true });

const adminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true },
}, { timestamps: true });

export const Doctor = mongoose.model('Doctor', doctorSchema);
export const User = mongoose.model('User', userSchema);
export const Admin = mongoose.model('Admin', adminSchema);

const SUPERADMIN_USERNAME = 'superadmin';
const SUPERADMIN_PASSWORD = 'superadmin123';

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getAuthFromRequest(req) {
  if (req.session?.auth?.role) return req.session.auth;
  const role = String(req.headers['x-auth-role'] || '').trim();
  const id = String(req.headers['x-auth-id'] || '').trim();
  if (role === 'superadmin' || role === 'admin' || role === 'user') {
    return { role, id: id || null };
  }
  return null;
}

function requireAuth(...roles) {
  return (req, res, next) => {
    const auth = getAuthFromRequest(req);
    if (!auth || (roles.length && !roles.includes(auth.role))) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    req.auth = auth;
    next();
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
  const value = String(username || '').trim();
  if (!value) return null;
  return Admin.findOne({ username: { $regex: `^${escapeRegex(value)}$`, $options: 'i' } });
}

async function userIdsForAdmin(adminId) {
  if (!mongoose.isValidObjectId(adminId)) return [];
  const users = await User.find({ ownerAdmin: adminId }).select('_id');
  return users.map((user) => user._id);
}

async function doctorQueryForAuth(auth, { adminId } = {}) {
  if (!auth) return { _id: null };
  if (auth.role === 'superadmin') {
    if (adminId) {
      const ids = await userIdsForAdmin(adminId);
      return { $or: [{ ownerUser: { $in: ids } }, { ownerAdmin: adminId }] };
    }
    return {};
  }
  if (auth.role === 'admin') {
    const scopedAdminId = auth.id;
    const ids = await userIdsForAdmin(scopedAdminId);
    return { $or: [{ ownerUser: { $in: ids } }, { ownerAdmin: scopedAdminId }] };
  }
  if (auth.role === 'user') {
    return { ownerUser: auth.id };
  }
  return { _id: null };
}

async function userQueryForAuth(auth, { adminId } = {}) {
  if (!auth) return { _id: null };
  if (auth.role === 'superadmin') {
    return adminId && mongoose.isValidObjectId(adminId) ? { ownerAdmin: adminId } : {};
  }
  if (auth.role === 'admin') {
    return { ownerAdmin: auth.id };
  }
  return { _id: null };
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
    if (String(doctor.ownerAdmin || '') === String(auth.id)) return true;
    if (!doctor.ownerUser) return false;
    const owner = await User.findById(doctor.ownerUser).select('ownerAdmin');
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
      return `${process.env.VITE_API_BASE_URL || `http://localhost:${PORT}`}/${value.replace(/\\/g, '/')}`;
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
    ownerAdmin: obj.ownerAdmin ? String(obj.ownerAdmin) : null,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
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
  const numId = Number(id);
  const queryOr = [
    { id },
    { empid: id },
    { id: String(id) },
    { empid: String(id) },
  ];
  if (!Number.isNaN(numId)) {
    queryOr.push({ id: numId }, { empid: numId });
  }
  return User.findOne({ $or: queryOr });
}

function setAuthSession(req, auth) {
  if (req.session) req.session.auth = auth;
  return auth;
}

// Routes
app.post('/api/login', async (req, res) => {
  const { id, password, username } = req.body;
  const loginId = String(id || username || '').trim();
  const pass = String(password || '');

  if (!loginId || !pass) {
    return res.status(400).json({ success: false, message: 'Employee ID / username and password are required' });
  }

  try {
    if (loginId === SUPERADMIN_USERNAME && pass === SUPERADMIN_PASSWORD) {
      const auth = setAuthSession(req, buildAuthPayload('superadmin'));
      return res.status(200).json({ success: true, message: 'Login successful', user: auth, auth });
    }

    const admin = await findAdminByUsername(loginId);
    if (admin && String(admin.password) === pass) {
      const auth = setAuthSession(req, buildAuthPayload('admin', admin));
      return res.status(200).json({ success: true, message: 'Login successful', user: auth, auth });
    }

    const user = await findUserByLoginId(loginId);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid employee ID or password' });
    }

    const storedPassword = user.password != null ? String(user.password) : '';
    if (!storedPassword || storedPassword !== pass) {
      return res.status(401).json({ success: false, message: 'Invalid employee ID or password' });
    }

    const auth = setAuthSession(req, buildAuthPayload('user', user));
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
  if (req.session) {
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
    const doctor = await Doctor.findOne({ active: { $ne: false } }).sort({ createdAt: -1 });
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
app.get('/api/doctors', async (req, res) => {
  try {
    const auth = getAuthFromRequest(req);
    if (!auth) return res.status(401).json({ message: 'Unauthorized' });

    const q = String(req.query.q || '').trim();
    const includeInactive = String(req.query.includeInactive || '') === 'true';
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, parseInt(req.query.limit) || 10);
    const skip = (page - 1) * limit;
    const filter = {};

    if (!includeInactive) {
      filter.active = { $ne: false };
    }

    if (q) {
      filter.name = { $regex: q, $options: 'i' };
    }

    const [doctors, totalFiltered, total] = await Promise.all([
      Doctor.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Doctor.countDocuments(filter),
      Doctor.countDocuments(includeInactive ? {} : { active: { $ne: false } }),
    ]);

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
app.get('/api/doctors/:id', async (req, res) => {
  try {
    const auth = getAuthFromRequest(req);
    if (!auth) return res.status(401).json({ message: 'Unauthorized' });
    const doctor = await Doctor.findById(req.params.id);
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
    const doctor = await Doctor.findById(req.params.id);
    if (!doctor) return res.status(404).json({ message: 'Doctor not found' });

    const { name, contactnumber, clinicName, doctorDegree, active } = req.body;
    let logoFile = req.files?.find((f) => f.fieldname === 'logo');
    let logoBuffer = logoFile?.buffer || null;
    let originalName = logoFile?.originalname || '';

    if (!logoBuffer && req.body.logo && typeof req.body.logo === 'string' && req.body.logo.startsWith('data:')) {
      logoBuffer = Buffer.from(req.body.logo.replace(/^data:image\/\w+;base64,/, ''), 'base64');
    }

    if (name != null) doctor.name = String(name).trim() || doctor.name;
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
    if (contactnumber != null) {
      doctor.contactnumber =
        Number(String(contactnumber).replace(/\D/g, '')) || doctor.contactnumber;
    }
    if (active != null) doctor.active = String(active) !== 'false' && active !== false;
    
    if (logoBuffer) {
      doctor.logo = await saveFile(logoBuffer, originalName, 'logos');
    }

    await doctor.save();
    return res.status(200).json({
      success: true,
      message: 'Doctor updated',
      doctor: formatDoctor(doctor, { includePosters: true }),
    });
  } catch (error) {
    console.error('Error updating doctor:', error);
    return res.status(500).json({ message: 'Failed to update doctor' });
  }
});

// Deactivate / reactivate doctor
app.patch('/api/doctors/:id/status', async (req, res) => {
  try {
    const active = req.body?.active !== false && String(req.body?.active) !== 'false';
    const doctor = await Doctor.findByIdAndUpdate(
      req.params.id,
      { active },
      { new: true }
    );
    if (!doctor) return res.status(404).json({ message: 'Doctor not found' });
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
    const doctor = await Doctor.findByIdAndDelete(req.params.id);
    if (!doctor) return res.status(404).json({ message: 'Doctor not found' });
    return res.status(200).json({ success: true, message: 'Doctor removed' });
  } catch (error) {
    console.error('Error deleting doctor:', error);
    return res.status(500).json({ message: 'Failed to delete doctor' });
  }
});

// Record a poster download for a doctor
app.post('/api/doctors/:id/download', async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.id);
    if (!doctor) return res.status(404).json({ message: 'Doctor not found' });

    const posterId = req.body?.posterId;
    doctor.downloadCount = (Number(doctor.downloadCount) || 0) + 1;

    if (posterId && Array.isArray(doctor.posters)) {
      const entry = doctor.posters.id(posterId);
      if (entry) entry.downloads = (Number(entry.downloads) || 0) + 1;
    } else if (Array.isArray(doctor.posters) && doctor.posters.length > 0) {
      const last = doctor.posters[doctor.posters.length - 1];
      last.downloads = (Number(last.downloads) || 0) + 1;
    }

    await doctor.save();
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

  // Also support base64 fallback if sent in body
  if (!logoBuffer && req.body.logo && typeof req.body.logo === 'string' && req.body.logo.startsWith('data:')) {
    const base64Data = req.body.logo.replace(/^data:image\/\w+;base64,/, '');
    logoBuffer = Buffer.from(base64Data, 'base64');
  }

  if (!posterBuffer && req.body.poster && typeof req.body.poster === 'string' && req.body.poster.startsWith('data:')) {
    const base64Data = req.body.poster.replace(/^data:image\/\w+;base64,/, '');
    posterBuffer = Buffer.from(base64Data, 'base64');
  }

  if (!String(clinicName || '').trim()) {
    return res.status(400).json({ success: false, message: 'Clinic/Hospital name is required.' });
  }

  if (!String(doctorDegree || '').trim()) {
    return res.status(400).json({ success: false, message: "Doctor's degree is required." });
  }

  try {
    const cleanedContact = Number(String(contactnumber || '').replace(/\D/g, '')) || 9999999999;
    const cleanedDegree = String(doctorDegree).trim();

    if (cleanedContact !== 9999999999) {
      const existingDoc = await Doctor.findOne({ contactnumber: cleanedContact });
      if (existingDoc && (!doctorId || String(existingDoc._id) !== String(doctorId))) {
         return res.status(400).json({ success: false, message: 'This mobile number already exists' });
      }
    }

    // Update existing doctor when doctorId is provided
    if (doctorId) {
      const doctor = await Doctor.findById(doctorId);
      if (!doctor) {
        return res.status(404).json({ success: false, message: 'Doctor not found' });
      }

      doctor.name = name?.trim() || doctor.name;
      doctor.clinicName = String(clinicName).trim();
      doctor.doctorDegree = cleanedDegree;
      doctor.contactnumber = cleanedContact;
      if (logoBuffer) doctor.logo = await saveFile(logoBuffer, logoName, 'logos');

      if (posterBuffer) {
        let posterSubfolder = 'posters';
        if (posterKind === 'festival') posterSubfolder = 'festival_posters';
        else if (posterKind === 'gk') posterSubfolder = 'education_posters';
        else if (posterKind === 'video') posterSubfolder = 'videos';

        const posterPath = await saveFile(posterBuffer, posterName, posterSubfolder);
        doctor.poster = posterPath;
        doctor.posters = doctor.posters || [];
        doctor.posters.push({
          image: posterPath,
          downloads: countDownload ? 1 : 0,
          createdAt: new Date(),
          kind: posterKind,
          label: posterLabel,
        });
        if (countDownload) {
          doctor.downloadCount = (Number(doctor.downloadCount) || 0) + 1;
        }
      }

      await doctor.save();
      return res.status(200).json({
        success: true,
        message: 'Doctor profile and poster saved successfully',
        doctor: formatDoctor(doctor, { includePosters: true }),
      });
    }

    if (!logoBuffer) {
      return res.status(400).json({ success: false, message: 'Doctor logo is required.' });
    }
    
    const logoPath = await saveFile(logoBuffer, logoName, 'logos');

    let ownerUser = mongoose.isValidObjectId(ownerUserId) ? ownerUserId : null;
    let ownerAdmin = null;
    if (req.auth?.role === 'user') {
      ownerUser = req.auth.id;
      const creator = await User.findById(req.auth.id).select('ownerAdmin');
      ownerAdmin = creator?.ownerAdmin || null;
    } else if (req.auth?.role === 'admin') {
      ownerAdmin = req.auth.id;
      if (ownerUser) {
        const assigned = await User.findById(ownerUser).select('ownerAdmin');
        if (!assigned || String(assigned.ownerAdmin || '') !== String(req.auth.id)) {
          ownerUser = null;
        }
      }
    } else if (ownerUser) {
      const assigned = await User.findById(ownerUser).select('ownerAdmin');
      ownerAdmin = assigned?.ownerAdmin || null;
    }

    const docData = {
      ownerUser,
      ownerAdmin,
      name: name?.trim() || 'Doctor',
      clinicName: String(clinicName).trim(),
      doctorDegree: cleanedDegree,
      contactnumber: cleanedContact,
      logo: logoPath,
      active: true,
      posters: [],
      downloadCount: 0,
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
        },
      ];
      docData.downloadCount = countDownload ? 1 : 0;
    }

    const doctor = new Doctor(docData);
    await doctor.save();
    return res.status(201).json({
      success: true,
      message: 'Doctor profile and poster saved successfully',
      doctor: formatDoctor(doctor, { includePosters: true }),
    });
  } catch (error) {
    console.error('Error saving doctor and poster:', error);
    return res.status(500).json({ message: 'Failed to save doctor and poster', error: error.message });
  }
});

async function doctorCountsByUser(userIds) {
  const match = userIds ? { ownerUser: { $in: userIds } } : { ownerUser: { $ne: null } };
  const doctorCounts = await Doctor.aggregate([
    { $match: match },
    { $group: { _id: '$ownerUser', count: { $sum: 1 } } },
  ]);
  return new Map(doctorCounts.map((item) => [String(item._id), item.count]));
}

async function listUsersForAuth(auth, { adminId } = {}) {
  const filter = await userQueryForAuth(auth, { adminId });
  const users = await User.find(filter).sort({ createdAt: -1 });
  const counts = await doctorCountsByUser(users.map((user) => user._id));
  const adminIds = [...new Set(users.map((user) => user.ownerAdmin).filter(Boolean).map(String))];
  const admins = adminIds.length
    ? await Admin.find({ _id: { $in: adminIds } }).select('username')
    : [];
  const adminNameById = new Map(admins.map((admin) => [String(admin._id), admin.username]));
  return users.map((user) => formatUser(user, {
    doctorCount: counts.get(String(user._id)) || 0,
    adminUsername: user.ownerAdmin ? adminNameById.get(String(user.ownerAdmin)) || null : null,
  }));
}

async function createUserUnderAdmin(adminId, { empid, password }) {
  const cleanEmpid = String(empid || '').trim();
  const cleanPassword = String(password || '');
  if (!cleanEmpid || !cleanPassword) {
    const error = new Error('Employee ID and password are required');
    error.status = 400;
    throw error;
  }
  const user = await User.create({
    empid: cleanEmpid,
    id: cleanEmpid,
    password: cleanPassword,
    ownerAdmin: adminId,
  });
  return formatUser(user, { doctorCount: 0 });
}

async function updateUserRecord(user, { empid, password, ownerAdmin }) {
  if (empid != null) {
    const cleanEmpid = String(empid).trim();
    if (!cleanEmpid) {
      const error = new Error('Employee ID is required');
      error.status = 400;
      throw error;
    }
    user.empid = cleanEmpid;
    user.id = cleanEmpid;
  }
  if (password != null && String(password).trim()) {
    user.password = String(password);
  }
  if (ownerAdmin !== undefined) {
    user.ownerAdmin = mongoose.isValidObjectId(ownerAdmin) ? ownerAdmin : null;
  }
  await user.save();
  return formatUser(user);
}

async function deleteUserAndDoctors(userId) {
  await Doctor.deleteMany({ ownerUser: userId });
  await User.findByIdAndDelete(userId);
}

const ADMIN_CSV_HEADERS = ['id', 'username', 'password', 'createdAt', 'updatedAt'];
const USER_CSV_HEADERS = ['id', 'empid', 'password', 'ownerAdmin', 'createdAt', 'updatedAt'];
const DOCTOR_CSV_HEADERS = [
  'id', 'name', 'clinicName', 'doctorDegree', 'contactnumber',
  'logo', 'poster', 'posters', 'downloadCount', 'active',
  'createdAt', 'updatedAt', 'ownerUser', 'ownerAdmin',
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
    image: poster?.image || '',
    downloads: Number(poster?.downloads) || 0,
    createdAt: parseCsvDate(poster?.createdAt) || undefined,
    kind: normalizePosterKind(poster?.kind, poster?.image),
    label: poster?.label || '',
  })).filter((poster) => poster.image);
}

function doctorPhoneQuery(contactnumber) {
  const raw = String(contactnumber ?? '').trim();
  const num = parseContactNumber(raw);
  const options = [];
  if (raw) options.push({ contactnumber: raw });
  if (num != null) options.push({ contactnumber: num });
  return options.length ? { $or: options } : { _id: null };
}

function applyTimestamps(doc, row) {
  const createdAt = parseCsvDate(row.createdAt);
  const updatedAt = parseCsvDate(row.updatedAt);
  if (createdAt) doc.createdAt = createdAt;
  if (updatedAt) doc.updatedAt = updatedAt;
}

function applyDoctorImportFields(doctor, row, { ownerUser, ownerAdmin }) {
  doctor.name = String(row.name || '').trim();
  doctor.clinicName = String(row.clinicName || '').trim();
  doctor.doctorDegree = String(row.doctorDegree || '').trim();
  doctor.contactnumber = parseContactNumber(row.contactnumber);
  doctor.logo = String(row.logo || '').trim() || null;
  doctor.poster = String(row.poster || '').trim() || null;
  doctor.posters = parsePostersCell(row.posters);
  doctor.downloadCount = String(row.downloadCount ?? '').trim() === ''
    ? 0
    : Number(row.downloadCount) || 0;
  doctor.active = parseCsvActive(row.active);
  doctor.ownerUser = ownerUser;
  doctor.ownerAdmin = ownerAdmin;
  applyTimestamps(doctor, row);
}

// --- Auth for staff pages ---
app.post('/api/superadmin/login', (req, res) => {
  const { username, password } = req.body || {};
  if (String(username || '').trim() === SUPERADMIN_USERNAME && String(password || '') === SUPERADMIN_PASSWORD) {
    const auth = setAuthSession(req, buildAuthPayload('superadmin'));
    return res.status(200).json({ success: true, message: 'Superadmin login successful', auth });
  }
  return res.status(401).json({ success: false, message: 'Invalid superadmin credentials' });
});

app.post('/api/super-admin/login', (req, res) => {
  const { username, password } = req.body || {};
  if (String(username || '').trim() === SUPERADMIN_USERNAME && String(password || '') === SUPERADMIN_PASSWORD) {
    const auth = setAuthSession(req, buildAuthPayload('superadmin'));
    return res.status(200).json({ success: true, message: 'Superadmin login successful', auth });
  }
  return res.status(401).json({ success: false, message: 'Invalid superadmin credentials' });
});

app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body || {};
  const loginId = String(username || '').trim();
  const pass = String(password || '');
  if (loginId === SUPERADMIN_USERNAME && pass === SUPERADMIN_PASSWORD) {
    const auth = setAuthSession(req, buildAuthPayload('superadmin'));
    return res.status(200).json({ success: true, message: 'Login successful', auth });
  }
  try {
    const admin = await findAdminByUsername(loginId);
    if (!admin || String(admin.password) !== pass) {
      return res.status(401).json({ success: false, message: 'Invalid admin credentials' });
    }
    const auth = setAuthSession(req, buildAuthPayload('admin', admin));
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
  if (loginId === SUPERADMIN_USERNAME && pass === SUPERADMIN_PASSWORD) {
    const auth = setAuthSession(req, buildAuthPayload('superadmin'));
    return res.status(200).json({ success: true, message: 'Login successful', auth });
  }
  try {
    const admin = await findAdminByUsername(loginId);
    if (admin && String(admin.password) === pass) {
      const auth = setAuthSession(req, buildAuthPayload('admin', admin));
      return res.status(200).json({ success: true, message: 'Login successful', auth });
    }
    const user = await findUserByLoginId(loginId);
    if (user && String(user.password || '') === pass) {
      const auth = setAuthSession(req, buildAuthPayload('user', user));
      return res.status(200).json({ success: true, message: 'Login successful', auth });
    }
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  } catch (error) {
    console.error('Userpanel login error:', error);
    return res.status(500).json({ success: false, message: 'Server error during login' });
  }
});

// --- Superadmin: admins ---
app.get('/api/superadmin/admins', requireAuth('superadmin'), async (_req, res) => {
  try {
    const admins = await Admin.find().sort({ createdAt: -1 });
    const counts = await User.aggregate([
      { $match: { ownerAdmin: { $ne: null } } },
      { $group: { _id: '$ownerAdmin', count: { $sum: 1 } } },
    ]);
    const countByAdmin = new Map(counts.map((item) => [String(item._id), item.count]));
    return res.json({
      admins: admins.map((admin) => formatAdmin(admin, {
        userCount: countByAdmin.get(String(admin._id)) || 0,
      })),
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
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }
    const existing = await findAdminByUsername(username);
    if (existing) return res.status(409).json({ message: 'Admin username already exists' });
    const admin = await Admin.create({ username, password });
    return res.status(201).json({ success: true, admin: formatAdmin(admin, { userCount: 0 }) });
  } catch (error) {
    console.error('Error creating admin:', error);
    return res.status(500).json({ message: 'Failed to create admin' });
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
        if (id && mongoose.isValidObjectId(id)) {
          admin = await Admin.findById(id);
        }
        if (!admin) {
          admin = await findAdminByUsername(username);
        }

        if (admin) {
          const taken = await findAdminByUsername(username);
          if (taken && String(taken._id) !== String(admin._id)) {
            throw Object.assign(new Error('Admin username already exists'), { status: 409 });
          }
          admin.username = username;
          if (password.trim()) admin.password = password;
          applyTimestamps(admin, row);
          await admin.save();
          updated += 1;
        } else {
          if (!password.trim()) {
            throw Object.assign(new Error('Password is required for a new admin'), { status: 400 });
          }
          const createdAt = parseCsvDate(row.createdAt);
          const updatedAt = parseCsvDate(row.updatedAt);
          await Admin.create({
            username,
            password,
            ...(createdAt ? { createdAt } : {}),
            ...(updatedAt ? { updatedAt } : {}),
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
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid admin ID' });
    }
    const admin = await Admin.findById(req.params.id);
    if (!admin) return res.status(404).json({ message: 'Admin not found' });
    if (req.body?.username != null) {
      const username = String(req.body.username).trim();
      if (!username) return res.status(400).json({ message: 'Username is required' });
      const existing = await findAdminByUsername(username);
      if (existing && String(existing._id) !== String(admin._id)) {
        return res.status(409).json({ message: 'Admin username already exists' });
      }
      admin.username = username;
    }
    if (req.body?.password != null && String(req.body.password).trim()) {
      admin.password = String(req.body.password);
    }
    await admin.save();
    return res.json({ success: true, admin: formatAdmin(admin) });
  } catch (error) {
    console.error('Error updating admin:', error);
    return res.status(500).json({ message: 'Failed to update admin' });
  }
});

app.delete('/api/superadmin/admins/:id', requireAuth('superadmin'), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid admin ID' });
    }
    const admin = await Admin.findById(req.params.id);
    if (!admin) return res.status(404).json({ message: 'Admin not found' });
    const users = await User.find({ ownerAdmin: admin._id }).select('_id');
    const userIds = users.map((user) => user._id);
    await Doctor.deleteMany({ $or: [{ ownerAdmin: admin._id }, { ownerUser: { $in: userIds } }] });
    await User.deleteMany({ ownerAdmin: admin._id });
    await Admin.findByIdAndDelete(admin._id);
    return res.json({ success: true, message: 'Admin deleted' });
  } catch (error) {
    console.error('Error deleting admin:', error);
    return res.status(500).json({ message: 'Failed to delete admin' });
  }
});

app.get('/api/superadmin/admins/:adminId/users', requireAuth('superadmin'), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.adminId)) {
      return res.status(400).json({ message: 'Invalid admin ID' });
    }
    const admin = await Admin.findById(req.params.adminId);
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
    if (!mongoose.isValidObjectId(req.params.adminId)) {
      return res.status(400).json({ message: 'Invalid admin ID' });
    }
    const admin = await Admin.findById(req.params.adminId);
    if (!admin) return res.status(404).json({ message: 'Admin not found' });
    const user = await createUserUnderAdmin(admin._id, req.body || {});
    return res.status(201).json({ success: true, user });
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message || 'Failed to create user' });
  }
});

app.post('/api/superadmin/admins/:adminId/users/import', requireAuth('superadmin'), upload.single('file'), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.adminId)) {
      return res.status(400).json({ message: 'Invalid admin ID' });
    }
    const admin = await Admin.findById(req.params.adminId);
    if (!admin) return res.status(404).json({ message: 'Admin not found' });
    if (!req.file?.buffer) {
      return res.status(400).json({ message: 'CSV file is required' });
    }

    const { headers, records } = parseCsvText(req.file.buffer.toString('utf8'));
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
        if (id && mongoose.isValidObjectId(id)) {
          user = await User.findById(id);
        }
        if (!user) {
          user = await findUserByLoginId(empid);
        }

        if (user) {
          await updateUserRecord(user, { empid, password, ownerAdmin: admin._id });
          applyTimestamps(user, row);
          await user.save();
          updated += 1;
        } else {
          if (!password.trim()) {
            throw Object.assign(new Error('Password is required for a new employee'), { status: 400 });
          }
          const createdAt = parseCsvDate(row.createdAt);
          const updatedAt = parseCsvDate(row.updatedAt);
          await User.create({
            empid,
            id: empid,
            password,
            ownerAdmin: admin._id,
            ...(createdAt ? { createdAt } : {}),
            ...(updatedAt ? { updatedAt } : {}),
          });
          created += 1;
        }
      } catch (error) {
        errors.push({ row: rowNumber, message: error.message || 'Failed to import employee' });
      }
    }

    return res.json({ success: true, created, updated, errors });
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message || 'Failed to import employees' });
  }
});

app.put('/api/superadmin/admins/:adminId/users/:userId', requireAuth('superadmin'), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.adminId) || !mongoose.isValidObjectId(req.params.userId)) {
      return res.status(400).json({ message: 'Invalid admin or user ID' });
    }
    const user = await User.findOne({ _id: req.params.userId, ownerAdmin: req.params.adminId });
    if (!user) return res.status(404).json({ message: 'User not found for this admin' });
    const updated = await updateUserRecord(user, req.body || {});
    return res.json({ success: true, user: updated });
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message || 'Failed to update user' });
  }
});

app.delete('/api/superadmin/admins/:adminId/users/:userId', requireAuth('superadmin'), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.adminId) || !mongoose.isValidObjectId(req.params.userId)) {
      return res.status(400).json({ message: 'Invalid admin or user ID' });
    }
    const user = await User.findOne({ _id: req.params.userId, ownerAdmin: req.params.adminId });
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
    if (!mongoose.isValidObjectId(req.params.adminId) || !mongoose.isValidObjectId(req.params.userId)) {
      return res.status(400).json({ message: 'Invalid admin or user ID' });
    }
    const user = await User.findOne({ _id: req.params.userId, ownerAdmin: req.params.adminId });
    if (!user) return res.status(404).json({ message: 'User not found for this admin' });
    const doctors = await Doctor.find({ ownerUser: user._id }).sort({ createdAt: -1 });
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
    if (!mongoose.isValidObjectId(req.params.adminId) || !mongoose.isValidObjectId(req.params.userId) || !mongoose.isValidObjectId(req.params.doctorId)) {
      return res.status(400).json({ message: 'Invalid id' });
    }
    const user = await User.findOne({ _id: req.params.userId, ownerAdmin: req.params.adminId });
    if (!user) return res.status(404).json({ message: 'User not found for this admin' });
    const doctor = await Doctor.findOne({ _id: req.params.doctorId, ownerUser: user._id });
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

app.post('/api/admin/users', requireAuth('superadmin', 'admin'), async (req, res) => {
  try {
    const requestedAdmin = req.body?.ownerAdmin || req.query.adminId;
    const adminId = req.auth.role === 'admin' ? req.auth.id : requestedAdmin;
    if (!mongoose.isValidObjectId(adminId)) {
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
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }
    const user = await User.findById(req.params.id);
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
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }
    const user = await User.findById(req.params.id);
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
    if (!mongoose.isValidObjectId(req.params.userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }
    const user = await User.findById(req.params.userId);
    if (!user || !(await assertUserInScope(req.auth, user))) {
      return res.status(404).json({ message: 'User not found' });
    }
    const doctors = await Doctor.find({ ownerUser: user._id }).sort({ createdAt: -1 });
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
    if (!mongoose.isValidObjectId(req.params.userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }
    const user = await User.findById(req.params.userId);
    if (!user || !(await assertUserInScope(req.auth, user))) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (!req.file?.buffer) {
      return res.status(400).json({ message: 'CSV file is required' });
    }

    const { headers, records } = parseCsvText(req.file.buffer.toString('utf8'));
    assertCsvHeaders(headers, DOCTOR_CSV_HEADERS);

    const ownerUser = user._id;
    const ownerAdmin = user.ownerAdmin || (req.auth.role === 'admin' ? req.auth.id : null);
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
        if (id && mongoose.isValidObjectId(id)) {
          doctor = await Doctor.findById(id);
        }
        if (!doctor) {
          doctor = await Doctor.findOne(doctorPhoneQuery(row.contactnumber));
        }
        if (doctor && req.auth.role === 'admin' && !(await canAccessDoctor(req.auth, doctor))) {
          throw Object.assign(new Error('Doctor is outside your scope'), { status: 403 });
        }

        if (doctor) {
          applyDoctorImportFields(doctor, row, { ownerUser, ownerAdmin });
          await doctor.save();
          updated += 1;
        } else {
          const createdAt = parseCsvDate(row.createdAt);
          const updatedAt = parseCsvDate(row.updatedAt);
          const doc = new Doctor({
            name,
            clinicName,
            doctorDegree: String(row.doctorDegree || '').trim(),
            contactnumber,
            logo: String(row.logo || '').trim() || null,
            poster: String(row.poster || '').trim() || null,
            posters: parsePostersCell(row.posters),
            downloadCount: String(row.downloadCount ?? '').trim() === '' ? 0 : Number(row.downloadCount) || 0,
            active: parseCsvActive(row.active),
            ownerUser,
            ownerAdmin,
            ...(createdAt ? { createdAt } : {}),
            ...(updatedAt ? { updatedAt } : {}),
          });
          await doc.save();
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
    if (!mongoose.isValidObjectId(req.params.userId) || !mongoose.isValidObjectId(req.params.doctorId)) {
      return res.status(400).json({ message: 'Invalid user or doctor ID' });
    }
    const user = await User.findById(req.params.userId);
    if (!user || !(await assertUserInScope(req.auth, user))) {
      return res.status(404).json({ message: 'User not found' });
    }
    const doctor = await Doctor.findOne({ _id: req.params.doctorId, ownerUser: user._id });
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
    if (!mongoose.isValidObjectId(req.params.userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }
    const user = await User.findById(req.params.userId);
    if (!user || !(await assertUserInScope(req.auth, user))) {
      return res.status(404).json({ message: 'User not found' });
    }
    const doctors = await Doctor.find({ ownerUser: user._id }).sort({ createdAt: -1 });
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
    if (!mongoose.isValidObjectId(req.params.userId) || !mongoose.isValidObjectId(req.params.doctorId)) {
      return res.status(400).json({ message: 'Invalid user or doctor ID' });
    }
    const user = await User.findById(req.params.userId);
    if (!user || !(await assertUserInScope(req.auth, user))) {
      return res.status(404).json({ message: 'User not found' });
    }
    const doctor = await Doctor.findOne({ _id: req.params.doctorId, ownerUser: user._id });
    if (!doctor) return res.status(404).json({ message: 'Doctor not found for this user' });
    return res.json({ doctor: formatDoctor(doctor, { includePosters: true }) });
  } catch (error) {
    console.error('Error fetching doctor:', error);
    return res.status(500).json({ message: 'Failed to retrieve doctor' });
  }
});

const models = {
  doctors: Doctor,
  users: User,
};

async function scopedCollectionFilter(auth, collection) {
  if (collection === 'doctors') return doctorQueryForAuth(auth);
  if (collection === 'users') return userQueryForAuth(auth);
  return { _id: null };
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
    const Model = models[req.params.collection];
    if (!Model) return res.status(404).json({ message: 'Collection not found' });
    
    const scope = await scopedCollectionFilter(req.auth, req.params.collection);
    const docs = await Model.find(scope).sort({ createdAt: -1 });
    if (req.params.collection === 'doctors') {
      return res.status(200).json(docs.map(d => formatDoctor(d, { includePosters: true })));
    }
    return res.status(200).json(docs.map(formatUser));
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
    const Model = models[collection];
    if (!Model) return res.status(404).json({ message: 'Collection not found' });
    const scope = await scopedCollectionFilter(req.auth, collection);

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
        ? -1
        : 1;

    const doctorColumns = ['id', 'name', 'clinicName', 'contactnumber', 'logo', 'poster', null];
    const userColumns = ['id', 'empid', null];
    const columns = collection === 'doctors' ? doctorColumns : userColumns;
    const sortField = columns[orderCol] && columns[orderCol] !== 'id' ? columns[orderCol] : 'createdAt';
    const sort = { [sortField === 'id' ? 'createdAt' : sortField]: orderDir };

    const filter = { ...scope };
    if (searchValue) {
      if (collection === 'doctors') {
        const or = [
          { name: { $regex: searchValue, $options: 'i' } },
          { clinicName: { $regex: searchValue, $options: 'i' } },
        ];
        const asNumber = Number(searchValue.replace(/\D/g, ''));
        if (!Number.isNaN(asNumber) && searchValue.replace(/\D/g, '').length > 0) {
          or.push({ contactnumber: asNumber });
        }
        if (/^[a-f\d]{24}$/i.test(searchValue)) {
          or.push({ _id: searchValue });
        }
        filter.$or = or;
      } else {
        const or = [
          { empid: { $regex: searchValue, $options: 'i' } },
        ];
        const asNumber = Number(searchValue);
        if (!Number.isNaN(asNumber)) {
          or.push({ empid: asNumber });
          or.push({ id: asNumber });
        }
        filter.$or = or;
      }
    }

    const recordsTotal = await Model.countDocuments(scope);
    const recordsFiltered = await Model.countDocuments(filter);
    const docs = await Model.find(filter)
      .sort(sortField === 'createdAt' && orderCol === 0 ? { createdAt: -1 } : sort)
      .skip(start)
      .limit(length);

    const data =
      collection === 'doctors' ? docs.map(formatDoctor) : docs.map(formatUser);

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
    const Model = models[req.params.collection];
    if (!Model) return res.status(404).json({ message: 'Collection not found' });
    
    const createData = { ...req.body };
    if (req.params.collection === 'doctors') {
      if (createData.contactnumber) {
         const cleanedContact = Number(String(createData.contactnumber).replace(/\D/g, ''));
         if (cleanedContact && cleanedContact !== 9999999999) {
           const existingDoc = await Doctor.findOne({ contactnumber: cleanedContact });
           if (existingDoc) {
             return res.status(400).json({ message: 'This mobile number already exists for another doctor.' });
           }
         }
      }

      if (!createData.logo) {
        return res.status(400).json({ message: 'Doctor logo is required.' });
      }

      if (createData.logo && typeof createData.logo === 'string' && createData.logo.startsWith('data:')) {
        const logoBuffer = Buffer.from(createData.logo.replace(/^data:image\/\w+;base64,/, ''), 'base64');
        createData.logo = await saveFile(logoBuffer, null, 'logos');
      }
      if (createData.poster && typeof createData.poster === 'string' && createData.poster.startsWith('data:')) {
        const posterBuffer = Buffer.from(createData.poster.replace(/^data:image\/\w+;base64,/, ''), 'base64');
        createData.poster = await saveFile(posterBuffer, null, 'posters');
        createData.posters = [{
          image: createData.poster,
          downloads: 0,
          createdAt: new Date()
        }];
      }
    }

    if (req.params.collection === 'doctors' && req.auth.role === 'admin') {
      createData.ownerAdmin = req.auth.id;
    }
    if (req.params.collection === 'doctors' && req.auth.role === 'user') {
      createData.ownerUser = req.auth.id;
      const creator = await User.findById(req.auth.id).select('ownerAdmin');
      createData.ownerAdmin = creator?.ownerAdmin || null;
    }
    if (req.params.collection === 'users' && req.auth.role === 'admin') {
      createData.ownerAdmin = req.auth.id;
    }

    const doc = new Model(createData);
    await doc.save();
    res.status(201).json({ success: true, data: req.params.collection === 'doctors' ? formatDoctor(doc) : doc });
  } catch (err) {
    res.status(500).json({ message: 'Error creating document', error: err.message });
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
    const Model = models[req.params.collection];
    if (!Model) return res.status(404).json({ message: 'Collection not found' });
    
    const updateData = { ...req.body };
    if (req.params.collection === 'doctors') {
      if (updateData.contactnumber) {
         const cleanedContact = Number(String(updateData.contactnumber).replace(/\D/g, ''));
         if (cleanedContact && cleanedContact !== 9999999999) {
           const existingDoc = await Doctor.findOne({ contactnumber: cleanedContact });
           if (existingDoc && String(existingDoc._id) !== String(req.params.id)) {
             return res.status(400).json({ message: 'This mobile number already exists for another doctor.' });
           }
         }
      }

      if (updateData.hasOwnProperty('logo') && !updateData.logo) {
        return res.status(400).json({ message: 'Doctor logo is required.' });
      }

      if (updateData.logo && typeof updateData.logo === 'string' && updateData.logo.startsWith('data:')) {
        const logoBuffer = Buffer.from(updateData.logo.replace(/^data:image\/\w+;base64,/, ''), 'base64');
        updateData.logo = await saveFile(logoBuffer, null, 'logos');
      }
      if (updateData.poster && typeof updateData.poster === 'string' && updateData.poster.startsWith('data:')) {
        const posterBuffer = Buffer.from(updateData.poster.replace(/^data:image\/\w+;base64,/, ''), 'base64');
        updateData.poster = await saveFile(posterBuffer, null, 'posters');
      }
    }

    const existing = await Model.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Document not found' });
    if (req.params.collection === 'doctors' && !(await canAccessDoctor(req.auth, existing))) {
      return res.status(404).json({ message: 'Document not found' });
    }
    if (req.params.collection === 'users' && !(await assertUserInScope(req.auth, existing))) {
      return res.status(404).json({ message: 'Document not found' });
    }

    const doc = await Model.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!doc) return res.status(404).json({ message: 'Document not found' });
    
    res.status(200).json({ success: true, data: req.params.collection === 'doctors' ? formatDoctor(doc) : doc });
  } catch (err) {
    res.status(500).json({ message: 'Error updating document', error: err.message });
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
    const Model = models[req.params.collection];
    if (!Model) return res.status(404).json({ message: 'Collection not found' });
    
    const existing = await Model.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Document not found' });
    if (req.params.collection === 'doctors' && !(await canAccessDoctor(req.auth, existing))) {
      return res.status(404).json({ message: 'Document not found' });
    }
    if (req.params.collection === 'users' && !(await assertUserInScope(req.auth, existing))) {
      return res.status(404).json({ message: 'Document not found' });
    }

    const doc = await Model.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Document not found' });
    
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isPortOpen(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host }, () => {
      socket.end();
      resolve(true);
    });
    socket.on('error', () => resolve(false));
    socket.setTimeout(800, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function tryBrewStart() {
  const formulas = [
    'mongodb-community',
    'mongodb-community@8.0',
    'mongodb-community@7.0',
    'mongodb-community@6.0',
    'mongodb/brew/mongodb-community',
  ];
  for (const formula of formulas) {
    try {
      await execFileAsync('brew', ['services', 'start', formula], { timeout: 20000 });
      console.log(`Started MongoDB via brew services (${formula})`);
      return true;
    } catch {
      // try next formula
    }
  }
  return false;
}

async function trySpawnMongod() {
  const candidates = [
    '/usr/local/var/mongodb',
    '/opt/homebrew/var/mongodb',
    path.join(process.env.HOME || '', 'data', 'db'),
  ];
  const dbpath = candidates.find((p) => {
    try {
      return fs.existsSync(p);
    } catch {
      return false;
    }
  }) || candidates[0];

  try {
    fs.mkdirSync(dbpath, { recursive: true });
  } catch {
    // ignore
  }

  const logDir = path.dirname(dbpath);
  const logpath = path.join(logDir, 'mongod.log');

  return new Promise((resolve) => {
    const child = spawn(
      'mongod',
      ['--dbpath', dbpath, '--bind_ip', '127.0.0.1', '--port', '27017'],
      { detached: true, stdio: 'ignore' }
    );
    child.unref();
    console.log(`Spawned mongod with --dbpath ${dbpath}`);
    resolve(true);
  });
}

async function ensureMongoRunning() {
  if (await isPortOpen(27017)) {
    console.log('MongoDB already running on port 27017');
    return;
  }

  console.log('MongoDB not detected — attempting to start automatically...');
  const brewOk = await tryBrewStart();
  if (!brewOk) {
    await trySpawnMongod();
  }

  for (let i = 0; i < 20; i++) {
    await sleep(500);
    if (await isPortOpen(27017)) {
      console.log('MongoDB is ready');
      return;
    }
  }

  throw new Error(
    'Could not start MongoDB automatically. Install/start it manually, then retry.'
  );
}

const startServer = async () => {
  try {
    await ensureMongoRunning();
    await mongoose.connect(MONGODB_URI);
    console.log(`Connected to MongoDB at ${MONGODB_URI}`);

    // Backfill passwords for older user records so login keeps working
    const passwordBackfill = await User.updateMany(
      { $or: [{ password: { $exists: false } }, { password: null }, { password: '' }] },
      { $set: { password: 'pass1234' } }
    );
    if (passwordBackfill.modifiedCount) {
      console.log(`Backfilled password for ${passwordBackfill.modifiedCount} user(s)`);
    }

    // Backfill clinic name for older doctor records
    const clinicBackfill = await Doctor.updateMany(
      { $or: [{ clinicName: { $exists: false } }, { clinicName: null }, { clinicName: '' }] },
      { $set: { clinicName: 'Clinic' } }
    );
    if (clinicBackfill.modifiedCount) {
      console.log(`Backfilled clinicName for ${clinicBackfill.modifiedCount} doctor(s)`);
    }

    const degreeBackfill = await Doctor.updateMany(
      { $or: [{ doctorDegree: { $exists: false } }, { doctorDegree: null }] },
      { $set: { doctorDegree: '' } }
    );
    if (degreeBackfill.modifiedCount) {
      console.log(`Backfilled doctorDegree for ${degreeBackfill.modifiedCount} doctor(s)`);
    }

    const activeBackfill = await Doctor.updateMany(
      { active: { $exists: false } },
      { $set: { active: true } }
    );
    if (activeBackfill.modifiedCount) {
      console.log(`Backfilled active flag for ${activeBackfill.modifiedCount} doctor(s)`);
    }

    const downloadBackfill = await Doctor.updateMany(
      { downloadCount: { $exists: false } },
      { $set: { downloadCount: 0 } }
    );
    if (downloadBackfill.modifiedCount) {
      console.log(`Backfilled downloadCount for ${downloadBackfill.modifiedCount} doctor(s)`);
    }

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    process.exit(1);
  }
};

startServer();
