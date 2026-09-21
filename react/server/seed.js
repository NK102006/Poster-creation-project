/**
 * Seed 30 dummy doctors + 30 dummy users for admin DataTables testing.
 * Usage: npm run seed
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/posterCreation';

const doctorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    clinicName: { type: String, required: true },
    doctorDegree: { type: String, default: '' },
    contactnumber: { type: Number, required: true },
    logo: { type: Buffer },
    poster: { type: Buffer },
  },
  { timestamps: true }
);

const userSchema = new mongoose.Schema(
  {
    empid: { type: mongoose.Schema.Types.Mixed },
    password: { type: String, required: true },
    name: { type: String },
  },
  { strict: false, timestamps: true }
);

const Doctor = mongoose.model('Doctor', doctorSchema);
const User = mongoose.model('User', userSchema);

const FIRST = [
  'Aarav', 'Ananya', 'Rohan', 'Ishita', 'Kabir', 'Meera', 'Vivaan', 'Diya',
  'Arjun', 'Sara', 'Neel', 'Priya', 'Kabir', 'Nisha', 'Dev', 'Aisha',
  'Yash', 'Kiara', 'Rahul', 'Sneha', 'Aman', 'Pooja', 'Harsh', 'Rhea',
  'Kunal', 'Tanya', 'Omar', 'Lina', 'Sam', 'Zara',
];
const LAST = [
  'Patel', 'Shah', 'Mehta', 'Desai', 'Joshi', 'Khan', 'Reddy', 'Nair',
  'Kapoor', 'Malhotra', 'Iyer', 'Banerjee', 'Chopra', 'Singh', 'Gupta',
];

function logoSvg(initials, hue) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="hsl(${hue},45%,28%)"/>
    <stop offset="100%" stop-color="hsl(${hue + 30},50%,42%)"/>
  </linearGradient></defs>
  <circle cx="60" cy="60" r="60" fill="url(#g)"/>
  <text x="60" y="70" text-anchor="middle" font-family="Arial,sans-serif" font-size="36" font-weight="700" fill="#f3ebe0">${initials}</text>
</svg>`);
}

function posterSvg(name, hue) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="360" viewBox="0 0 240 360">
  <rect width="240" height="360" rx="16" fill="hsl(${hue},40%,18%)"/>
  <rect x="20" y="24" width="200" height="120" rx="12" fill="hsl(${hue + 25},55%,55%)"/>
  <circle cx="120" cy="84" r="36" fill="#f3ebe0" opacity="0.9"/>
  <text x="120" y="200" text-anchor="middle" font-family="Georgia,serif" font-size="18" fill="#f3ebe0">${name}</text>
  <text x="120" y="230" text-anchor="middle" font-family="Arial,sans-serif" font-size="12" fill="#c6a46a">MedPortal Poster</text>
  <rect x="40" y="260" width="160" height="10" rx="5" fill="#c6a46a" opacity="0.7"/>
  <rect x="55" y="282" width="130" height="8" rx="4" fill="#f3ebe0" opacity="0.35"/>
</svg>`);
}

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log(`Connected to ${MONGODB_URI}`);

  // Replace prior dummy rows so re-running stays at ~30 test records
  await Doctor.deleteMany({ name: /^Dr\. Dummy / });
  await User.deleteMany({ name: /^Dummy User / });

  const doctors = [];
  for (let i = 0; i < 30; i++) {
    const first = FIRST[i % FIRST.length];
    const last = LAST[i % LAST.length];
    const name = `Dr. Dummy ${first} ${last} ${i + 1}`;
    const initials = `${first[0]}${last[0]}`.toUpperCase();
    const hue = (i * 17) % 360;
    doctors.push({
      name,
      clinicName: `Clinic ${i + 1}`,
      doctorDegree: 'MBBS, MD',
      contactnumber: 9000000000 + i,
      logo: logoSvg(initials, hue),
      poster: posterSvg(name.replace('Dr. Dummy ', ''), hue),
    });
  }
  await Doctor.insertMany(doctors);
  console.log(`Inserted ${doctors.length} dummy doctors`);

  const users = [];
  for (let i = 0; i < 30; i++) {
    users.push({
      empid: 20000 + i,
      id: 20000 + i,
      name: `Dummy User ${i + 1}`,
      password: 'pass1234',
    });
  }
  // Keep a few real login IDs available
  const loginSeeds = [
    { empid: 12345, id: 12345, name: 'Employee One', password: 'pass1234' },
    { empid: 1001, id: 1001, name: 'Employee Two', password: 'pass1234' },
    { empid: 99999, id: 99999, name: 'Demo User', password: 'pass1234' },
  ];
  for (const u of loginSeeds) {
    const exists = await User.findOne({ empid: u.empid });
    if (!exists) {
      await User.create(u);
    } else if (!exists.password) {
      exists.password = u.password;
      await exists.save();
    }
  }
  await User.insertMany(users);
  console.log(`Inserted ${users.length} dummy users`);

  console.log(`Totals → doctors: ${await Doctor.countDocuments()}, users: ${await User.countDocuments()}`);
  await mongoose.disconnect();
  console.log('Seed complete.');
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
