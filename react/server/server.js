import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import multer from 'multer';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
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
  id: { type: mongoose.Schema.Types.Mixed },
  empid: { type: mongoose.Schema.Types.Mixed },
}, { strict: false, timestamps: true });

export const Doctor = mongoose.model('Doctor', doctorSchema);
export const User = mongoose.model('User', userSchema);

// Helper to format doctor document for frontend consumption
function formatDoctor(doc) {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  let logoStr = null;
  if (obj.logo) {
    if (Buffer.isBuffer(obj.logo)) {
      logoStr = `data:image/png;base64,${obj.logo.toString('base64')}`;
    } else if (obj.logo.buffer && Buffer.isBuffer(obj.logo.buffer)) {
      logoStr = `data:image/png;base64,${obj.logo.buffer.toString('base64')}`;
    } else if (typeof obj.logo === 'string') {
      logoStr = obj.logo;
    }
  }

  let posterStr = null;
  if (obj.poster) {
    if (Buffer.isBuffer(obj.poster)) {
      posterStr = `data:image/jpeg;base64,${obj.poster.toString('base64')}`;
    } else if (obj.poster.buffer && Buffer.isBuffer(obj.poster.buffer)) {
      posterStr = `data:image/jpeg;base64,${obj.poster.buffer.toString('base64')}`;
    } else if (typeof obj.poster === 'string') {
      posterStr = obj.poster;
    }
  }

  return {
    id: obj._id,
    name: obj.name,
    contactnumber: obj.contactnumber,
    logo: logoStr,
    poster: posterStr,
    createdAt: obj.createdAt,
  };
}

// Seed default test user and doctor if none exist
async function seedInitialData() {
  try {
    const existingUser = await User.findOne({
      $or: [{ id: 1001 }, { empid: '101' }, { id: '101' }]
    });
    if (!existingUser) {
      await User.create({ id: 1001, empid: '101' });
      console.log('🌱 Seeded default user');
    }

    const doctorCount = await Doctor.countDocuments();
    if (doctorCount === 0) {
      await Doctor.create({
        name: 'Dr. Sarah Jenkins, MD',
        contactnumber: 9876543210,
        logo: null,
      });
      console.log('🌱 Seeded default doctor: Dr. Sarah Jenkins, MD');
    }
  } catch (err) {
    console.warn('⚠️ Seeding check failed (non-critical):', err.message);
  }
}

// Routes
app.post('/api/login', async (req, res) => {
  const { id } = req.body;

  try {
    const numId = Number(id);
    const strId = String(id ?? '').trim();

    if (!strId) {
      return res.status(400).json({ success: false, message: 'Employee ID is required' });
    }

    const user = await User.findOne({
      $or: [
        { id: numId },
        { id: strId },
        { empid: strId },
        { empid: numId },
      ]
    });

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

    await seedInitialData();

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    process.exit(1);
  }
};

startServer();
