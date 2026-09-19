import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import multer from 'multer';
import dotenv from 'dotenv';
import session from 'express-session';

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
const doctorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  contactnumber: { type: Number, required: true },
  logo: { type: Buffer },
  poster: { type: Buffer },
}, { timestamps: true });

const userSchema = new mongoose.Schema({
  empid: { type: mongoose.Schema.Types.Mixed },
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

function formatDoctor(doc) {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject() : { ...doc };

  return {
    id: obj._id,
    name: obj.name,
    contactnumber: obj.contactnumber,
    logo: bufferToDataUrl(obj.logo, 'image/png'),
    poster: bufferToDataUrl(obj.poster, 'image/jpeg'),
    createdAt: obj.createdAt,
  };
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
  const { id } = req.body;

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
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      user: { id: user.id || user.empid || id },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, message: 'Server error during login' });
  }
  
});

// Get current/latest doctor profile
app.get('/api/doctors/current', async (req, res) => {
  try {
    const doctor = await Doctor.findOne().sort({ createdAt: -1 });
    if (!doctor) {
      return res.status(404).json({ message: 'No doctor profiles found' });
    }
    return res.status(200).json({ doctor: formatDoctor(doctor) });
  } catch (error) {
    console.error('Error fetching current doctor:', error);
    return res.status(500).json({ message: 'Failed to retrieve doctor profile' });
  }
});

// Get all doctors
app.get('/api/doctors', async (req, res) => {
  try {
    const doctors = await Doctor.find().sort({ createdAt: -1 });
    return res.status(200).json(doctors.map(formatDoctor));
  } catch (error) {
    console.error('Error fetching doctors:', error);
    return res.status(500).json({ message: 'Failed to retrieve doctors' });
  }
});

// Create/update doctor profile and poster with multer file upload
app.post('/api/doctors', upload.any(), async (req, res) => {
  const { name, contactnumber } = req.body;
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

  if (!logo) {
    return res.status(400).json({ success: false, message: 'Doctor logo is required.' });
  }

  try {
    const cleanedContact = Number(String(contactnumber || '').replace(/\D/g, '')) || 9999999999;
    const docData = {
      name: name?.trim() || 'Doctor',
      contactnumber: cleanedContact,
    };

    if (logo) {
      docData.logo = logo;
    } else {
      // Preserve existing logo if only poster was regenerated
      const lastDoc = await Doctor.findOne({ name }).sort({ createdAt: -1 });
      if (lastDoc?.logo) docData.logo = lastDoc.logo;
    }

    if (poster) {
      docData.poster = poster;
    }

    const doctor = new Doctor(docData);
    await doctor.save();
    return res.status(201).json({
      success: true,
      message: 'Doctor profile and poster saved successfully',
      doctor: formatDoctor(doctor),
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

    const doctorColumns = ['id', 'name', 'contactnumber', 'logo', 'poster', null];
    const userColumns = ['id', 'empid', 'name', null];
    const columns = collection === 'doctors' ? doctorColumns : userColumns;
    const sortField = columns[orderCol] && columns[orderCol] !== 'id' ? columns[orderCol] : 'createdAt';
    const sort = { [sortField === 'id' ? 'createdAt' : sortField]: orderDir };

    const filter = {};
    if (searchValue) {
      if (collection === 'doctors') {
        const or = [
          { name: { $regex: searchValue, $options: 'i' } },
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

const startServer = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log(`Connected to MongoDB at ${MONGODB_URI}`);
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    process.exit(1);
  }
};

startServer();
