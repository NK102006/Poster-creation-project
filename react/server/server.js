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
}));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit for high-res posters
});

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/posterCreation';

app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Schemas & Models
const posterEntrySchema = new mongoose.Schema(
  {
    image: { type: Buffer, required: true },
    downloads: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const doctorSchema = new mongoose.Schema({
  ownerUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  name: { type: String, required: true },
  clinicName: { type: String, required: true, trim: true },
  doctorDegree: { type: String, trim: true, default: '' },
  contactnumber: { type: Number, required: true },
  logo: { type: Buffer },
  poster: { type: Buffer }, // latest poster (legacy + convenience)
  posters: { type: [posterEntrySchema], default: [] },
  downloadCount: { type: Number, default: 0 },
  active: { type: Boolean, default: true },
}, { timestamps: true });

const userSchema = new mongoose.Schema({
  empid: { type: mongoose.Schema.Types.Mixed },
  password: { type: String, required: true },
  name: { type: String },
}, { strict: false, timestamps: true });

export const Doctor = mongoose.model('Doctor', doctorSchema);
export const User = mongoose.model('User', userSchema);

// Helper to format doctor document for frontend consumption
function bufferToDataUrl(value, fallbackMime = 'image/png') {
  if (!value) return null;
  if (typeof value === 'string') return value;

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
    }));

    // Legacy single poster fallback for gallery
    if (formatted.posters.length === 0 && formatted.poster) {
      formatted.posters = [
        {
          id: 'legacy',
          image: formatted.poster,
          downloads: downloadCount,
          createdAt: obj.updatedAt || obj.createdAt,
        },
      ];
    }
  }

  return formatted;
}

function formatUser(doc) {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  return {
    id: obj._id,
    empid: obj.empid ?? obj.id ?? null,
    name: obj.name || '',
    createdAt: obj.createdAt,
  };
}

// Routes
app.post('/api/login', async (req, res) => {
  const { id, password } = req.body;

  if (!id || !password) {
    return res.status(400).json({ success: false, message: 'Employee ID and password are required' });
  }

  try {
    const numId = Number(id);
    const queryOr = [
      { id: id },
      { empid: id },
      { id: String(id) },
      { empid: String(id) }
    ];

    if (!isNaN(numId)) {
      queryOr.push({ id: numId }, { empid: numId });
    }

    const user = await User.findOne({ $or: queryOr });

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid employee ID or password' });
    }

    const storedPassword = user.password != null ? String(user.password) : '';
    if (!storedPassword || storedPassword !== String(password)) {
      return res.status(401).json({ success: false, message: 'Invalid employee ID or password' });
    }

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      user: {
        id: String(user._id),
        empid: user.empid ?? user.id ?? id,
        name: user.name || '',
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, message: 'Server error during login' });
  }
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
    const q = String(req.query.q || '').trim();
    const includeInactive = String(req.query.includeInactive || '') === 'true';
    const filter = {};

    if (!includeInactive) {
      filter.active = { $ne: false };
    }

    if (q) {
      filter.name = { $regex: q, $options: 'i' };
    }

    const [doctors, total] = await Promise.all([
      Doctor.find(filter).sort({ createdAt: -1 }),
      Doctor.countDocuments(includeInactive ? {} : { active: { $ne: false } }),
    ]);

    return res.status(200).json({
      total,
      count: doctors.length,
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
    const doctor = await Doctor.findById(req.params.id);
    if (!doctor) return res.status(404).json({ message: 'Doctor not found' });
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
    let logo = req.files?.find((f) => f.fieldname === 'logo')?.buffer || null;
    if (!logo && req.body.logo && typeof req.body.logo === 'string' && req.body.logo.startsWith('data:')) {
      logo = Buffer.from(req.body.logo.replace(/^data:image\/\w+;base64,/, ''), 'base64');
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
    if (logo) doctor.logo = logo;

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
app.post('/api/doctors', upload.any(), async (req, res) => {
  const { name, contactnumber, clinicName, doctorDegree, doctorId, ownerUserId } = req.body;
  const countDownload = String(req.body.countDownload || '') === 'true';
  let logo = req.files?.find((f) => f.fieldname === 'logo')?.buffer || null;
  let poster = req.files?.find((f) => f.fieldname === 'poster')?.buffer || null;

  // Also support base64 fallback if sent in body
  if (!logo && req.body.logo && typeof req.body.logo === 'string' && req.body.logo.startsWith('data:')) {
    const base64Data = req.body.logo.replace(/^data:image\/\w+;base64,/, '');
    logo = Buffer.from(base64Data, 'base64');
  }

  if (!poster && req.body.poster && typeof req.body.poster === 'string' && req.body.poster.startsWith('data:')) {
    const base64Data = req.body.poster.replace(/^data:image\/\w+;base64,/, '');
    poster = Buffer.from(base64Data, 'base64');
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
      if (logo) doctor.logo = logo;

      if (poster) {
        doctor.poster = poster;
        doctor.posters = doctor.posters || [];
        doctor.posters.push({
          image: poster,
          downloads: countDownload ? 1 : 0,
          createdAt: new Date(),
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

    if (!logo) {
      return res.status(400).json({ success: false, message: 'Doctor logo is required.' });
    }

    const docData = {
      ownerUser: mongoose.isValidObjectId(ownerUserId) ? ownerUserId : null,
      name: name?.trim() || 'Doctor',
      clinicName: String(clinicName).trim(),
      doctorDegree: cleanedDegree,
      contactnumber: cleanedContact,
      logo,
      active: true,
      posters: [],
      downloadCount: 0,
    };

    if (poster) {
      docData.poster = poster;
      docData.posters = [
        {
          image: poster,
          downloads: countDownload ? 1 : 0,
          createdAt: new Date(),
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

// --- Admin Routes ---
const models = {
  doctors: Doctor,
  users: User
};

app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'admin123') {
    return res.status(200).json({ success: true, message: 'Admin login successful' });
  }
  return res.status(401).json({ success: false, message: 'Invalid admin credentials' });
});

app.post('/api/super-admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'superadmin' && password === 'superadmin123') {
    return res.status(200).json({ success: true, message: 'Super admin login successful' });
  }
  return res.status(401).json({ success: false, message: 'Invalid super admin credentials' });
});

app.get('/api/super-admin/users', async (_req, res) => {
  try {
    const users = await User.aggregate([
      {
        $lookup: {
          from: Doctor.collection.name,
          localField: '_id',
          foreignField: 'ownerUser',
          as: 'doctors',
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $project: {
          password: 0,
          doctors: 0,
        },
      },
    ]);
    const doctorCounts = await Doctor.aggregate([
      { $match: { ownerUser: { $ne: null } } },
      { $group: { _id: '$ownerUser', count: { $sum: 1 } } },
    ]);
    const countByUser = new Map(doctorCounts.map((item) => [String(item._id), item.count]));
    return res.json({
      users: users.map((user) => ({
        ...formatUser(user),
        doctorCount: countByUser.get(String(user._id)) || 0,
      })),
    });
  } catch (error) {
    console.error('Error fetching super admin users:', error);
    return res.status(500).json({ message: 'Failed to retrieve users' });
  }
});

app.get('/api/super-admin/users/:userId/doctors', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }
    const [user, doctors] = await Promise.all([
      User.findById(req.params.userId),
      Doctor.find({ ownerUser: req.params.userId }).sort({ createdAt: -1 }),
    ]);
    if (!user) return res.status(404).json({ message: 'User not found' });
    return res.json({ user: formatUser(user), doctors: doctors.map((doctor) => formatDoctor(doctor, { light: true })) });
  } catch (error) {
    console.error('Error fetching user doctors:', error);
    return res.status(500).json({ message: 'Failed to retrieve doctors' });
  }
});

app.get('/api/super-admin/users/:userId/doctors/:doctorId', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.userId) || !mongoose.isValidObjectId(req.params.doctorId)) {
      return res.status(400).json({ message: 'Invalid user or doctor ID' });
    }
    const doctor = await Doctor.findOne({ _id: req.params.doctorId, ownerUser: req.params.userId });
    if (!doctor) return res.status(404).json({ message: 'Doctor not found for this user' });
    return res.json({ doctor: formatDoctor(doctor, { includePosters: true }) });
  } catch (error) {
    console.error('Error fetching super admin doctor:', error);
    return res.status(500).json({ message: 'Failed to retrieve doctor' });
  }
});

app.get('/api/admin/collections/:collection', async (req, res) => {
  try {
    const Model = models[req.params.collection];
    if (!Model) return res.status(404).json({ message: 'Collection not found' });
    
    const docs = await Model.find().sort({ createdAt: -1 });
    if (req.params.collection === 'doctors') {
      return res.status(200).json(docs.map(formatDoctor));
    }
    return res.status(200).json(docs.map(formatUser));
  } catch (err) {
    res.status(500).json({ message: 'Error fetching collection', error: err.message });
  }
});

// DataTables server-side processing endpoint
app.get('/api/admin/datatables/:collection', async (req, res) => {
  try {
    const collection = req.params.collection;
    const Model = models[collection];
    if (!Model) return res.status(404).json({ message: 'Collection not found' });

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
    const userColumns = ['id', 'empid', 'name', null];
    const columns = collection === 'doctors' ? doctorColumns : userColumns;
    const sortField = columns[orderCol] && columns[orderCol] !== 'id' ? columns[orderCol] : 'createdAt';
    const sort = { [sortField === 'id' ? 'createdAt' : sortField]: orderDir };

    const filter = {};
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
          { name: { $regex: searchValue, $options: 'i' } },
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

    const recordsTotal = await Model.countDocuments();
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

app.post('/api/admin/collections/:collection', async (req, res) => {
  try {
    const Model = models[req.params.collection];
    if (!Model) return res.status(404).json({ message: 'Collection not found' });
    
    const createData = { ...req.body };
    if (req.params.collection === 'doctors') {
      if (createData.logo && typeof createData.logo === 'string' && createData.logo.startsWith('data:')) {
        createData.logo = Buffer.from(createData.logo.replace(/^data:image\/\w+;base64,/, ''), 'base64');
      }
      if (createData.poster && typeof createData.poster === 'string' && createData.poster.startsWith('data:')) {
        createData.poster = Buffer.from(createData.poster.replace(/^data:image\/\w+;base64,/, ''), 'base64');
      }
    }

    const doc = new Model(createData);
    await doc.save();
    res.status(201).json({ success: true, data: req.params.collection === 'doctors' ? formatDoctor(doc) : doc });
  } catch (err) {
    res.status(500).json({ message: 'Error creating document', error: err.message });
  }
});

app.put('/api/admin/collections/:collection/:id', async (req, res) => {
  try {
    const Model = models[req.params.collection];
    if (!Model) return res.status(404).json({ message: 'Collection not found' });
    
    const updateData = { ...req.body };
    if (req.params.collection === 'doctors') {
      if (updateData.logo && typeof updateData.logo === 'string' && updateData.logo.startsWith('data:')) {
        updateData.logo = Buffer.from(updateData.logo.replace(/^data:image\/\w+;base64,/, ''), 'base64');
      }
      if (updateData.poster && typeof updateData.poster === 'string' && updateData.poster.startsWith('data:')) {
        updateData.poster = Buffer.from(updateData.poster.replace(/^data:image\/\w+;base64,/, ''), 'base64');
      }
    }

    const doc = await Model.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!doc) return res.status(404).json({ message: 'Document not found' });
    
    res.status(200).json({ success: true, data: req.params.collection === 'doctors' ? formatDoctor(doc) : doc });
  } catch (err) {
    res.status(500).json({ message: 'Error updating document', error: err.message });
  }
});

app.delete('/api/admin/collections/:collection/:id', async (req, res) => {
  try {
    const Model = models[req.params.collection];
    if (!Model) return res.status(404).json({ message: 'Collection not found' });
    
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
