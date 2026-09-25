import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/posterCreation';

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

const doctorSchema = new mongoose.Schema({
  ownerUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  name: { type: String, required: true },
  clinicName: { type: String, required: true, trim: true },
  doctorDegree: { type: String, trim: true, default: '' },
  contactnumber: { type: Number, required: true },
  logo: { type: mongoose.Schema.Types.Mixed },
  poster: { type: mongoose.Schema.Types.Mixed },
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

async function hashPassword(value) {
  return bcrypt.hash(String(value), 10);
}

userSchema.pre('save', async function hashStoredPassword() {
  if (!this.isModified('password')) return;
  this.password = await hashPassword(this.password);
});

adminSchema.pre('save', async function hashStoredPassword() {
  if (!this.isModified('password')) return;
  this.password = await hashPassword(this.password);
});

const Doctor = mongoose.model('Doctor', doctorSchema);
const User = mongoose.model('User', userSchema);
const Admin = mongoose.model('Admin', adminSchema);

const ADMINS = [
  { username: 'riya', password: 'admin123' },
  { username: 'kabir', password: 'admin123' },
];

const USERS = [
  { empid: '40101', password: 'pass1234', admin: 'riya' },
  { empid: '40102', password: 'pass1234', admin: 'riya' },
  { empid: '50201', password: 'pass1234', admin: 'kabir' },
];

const DOCTORS = [
  {
    ownerEmpid: '40101',
    name: 'Dr. Ananya Shah',
    doctorDegree: 'MBBS, MD',
    clinicName: 'Sunrise Heart Clinic',
    contactnumber: 9876501234,
  },
  {
    ownerEmpid: '40101',
    name: 'Dr. Rohan Mehta',
    doctorDegree: 'MBBS',
    clinicName: 'City Care Hospital',
    contactnumber: 9876501235,
  },
  {
    ownerEmpid: '40102',
    name: 'Dr. Kavya Iyer',
    doctorDegree: 'BDS',
    clinicName: 'Pearl Dental Studio',
    contactnumber: 9876502234,
  },
  {
    ownerEmpid: '50201',
    name: 'Dr. Arjun Patel',
    doctorDegree: 'MBBS, MS',
    clinicName: 'Greenfield Ortho',
    contactnumber: 9876503234,
  },
];

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log(`Connected to ${MONGODB_URI}`);

  const deleted = {
    doctors: (await Doctor.deleteMany({})).deletedCount,
    users: (await User.deleteMany({})).deletedCount,
    admins: (await Admin.deleteMany({})).deletedCount,
  };
  console.log(`Removed ${deleted.admins} admin(s), ${deleted.users} user(s), ${deleted.doctors} doctor(s)`);

  const adminByName = {};
  for (const admin of ADMINS) {
    adminByName[admin.username] = await Admin.create(admin);
  }

  const userByEmpid = {};
  for (const user of USERS) {
    userByEmpid[user.empid] = await User.create({
      empid: user.empid,
      id: user.empid,
      password: user.password,
      ownerAdmin: adminByName[user.admin]._id,
    });
  }

  for (const doctor of DOCTORS) {
    await Doctor.create({
      ownerUser: userByEmpid[doctor.ownerEmpid]._id,
      name: doctor.name,
      doctorDegree: doctor.doctorDegree,
      clinicName: doctor.clinicName,
      contactnumber: doctor.contactnumber,
      posters: [],
      downloadCount: 0,
      active: true,
    });
  }

  console.log(`Added ${ADMINS.length} admin(s), ${USERS.length} user(s), ${DOCTORS.length} doctor(s)`);
  console.log('Logins:');
  console.log('  Superadmin  superadmin / superadmin123');
  console.log('  Admin       riya / admin123');
  console.log('  Admin       kabir / admin123');
  console.log('  Portal      40101 / pass1234');
  console.log('  Portal      40102 / pass1234');
  console.log('  Portal      50201 / pass1234');

  await mongoose.disconnect();
}

seed().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
