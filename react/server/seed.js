/**
 * Seed 5 dummy users + 20 dummy doctors (with posters) for Super Admin testing.
 * Usage: npm run seed
 */
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/posterCreation';
const UPLOADS_DIR = path.resolve('uploads');
const SAMPLE_VIDEO = path.resolve('../src/assets/Science_city_launch_video.mp4');

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
  name: { type: String },
}, { strict: false, timestamps: true });

const Doctor = mongoose.models.Doctor || mongoose.model('Doctor', doctorSchema);
const User = mongoose.models.User || mongoose.model('User', userSchema);

const FIRST = [
  'Aarav', 'Ananya', 'Rohan', 'Ishita', 'Kabir', 'Meera', 'Vivaan', 'Diya',
  'Arjun', 'Sara', 'Neel', 'Priya', 'Dev', 'Aisha', 'Yash', 'Kiara',
  'Rahul', 'Sneha', 'Aman', 'Pooja',
];
const LAST = [
  'Patel', 'Shah', 'Mehta', 'Desai', 'Joshi', 'Khan', 'Reddy', 'Nair',
  'Kapoor', 'Malhotra',
];
const DEGREES = ['MBBS', 'MBBS, MD', 'MBBS, MS', 'BDS', 'BAMS'];
const CLINICS = [
  'City Care Clinic', 'Hope Health Center', 'Sunrise Hospital', 'Green Leaf Clinic',
  'Lotus Medical', 'Harmony Hospital', 'Pearl Health', 'Nova Care',
];
const POSTER_SETS = [
  [
    { kind: 'education', label: 'Hypertension Risk Factors' },
    { kind: 'festival', label: 'Diwali Wellness' },
  ],
  [
    { kind: 'education', label: 'Heart Health Basics' },
    { kind: 'education', label: 'Diabetes Awareness' },
    { kind: 'video', label: 'Clinic Intro Video' },
  ],
  [
    { kind: 'festival', label: 'New Year Health' },
    { kind: 'education', label: 'Blood Pressure Check' },
    { kind: 'festival', label: 'Holi Healthy Living' },
    { kind: 'video', label: 'Treatment Overview' },
  ],
];

function logoSvg(initials, hue) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="hsl(${hue},45%,28%)"/>
    <stop offset="100%" stop-color="hsl(${hue + 30},50%,42%)"/>
  </linearGradient></defs>
  <circle cx="120" cy="120" r="120" fill="url(#g)"/>
  <text x="120" y="138" text-anchor="middle" font-family="Arial,sans-serif" font-size="64" font-weight="700" fill="#f3ebe0">${initials}</text>
</svg>`);
}

function posterSvg(title, kind, hue) {
  const accent = kind === 'festival' ? 'hsl(32,80%,58%)' : kind === 'video' ? 'hsl(350,70%,48%)' : 'hsl(200,60%,48%)';
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="736" height="736" viewBox="0 0 736 736">
  <rect width="736" height="736" fill="hsl(${hue},38%,92%)"/>
  <rect y="620" width="736" height="116" fill="hsl(${hue},45%,24%)"/>
  <text x="40" y="90" font-family="Arial,sans-serif" font-size="22" fill="hsl(${hue},40%,30%)">${kind.toUpperCase()}</text>
  <text x="40" y="180" font-family="Georgia,serif" font-size="42" fill="hsl(${hue},45%,18%)">${title}</text>
  <rect x="40" y="220" width="280" height="12" rx="6" fill="${accent}"/>
  <circle cx="560" cy="320" r="140" fill="${accent}" opacity="0.35"/>
  <text x="40" y="688" font-family="Arial,sans-serif" font-size="24" fill="#ffffff">MedPortal Dummy Poster</text>
</svg>`);
}

async function writeUpload(buffer, subfolder, ext) {
  await fs.promises.mkdir(path.join(UPLOADS_DIR, subfolder), { recursive: true });
  const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
  const relativePath = `uploads/${subfolder}/${filename}`;
  await fs.promises.writeFile(path.join(UPLOADS_DIR, subfolder, filename), buffer);
  return relativePath;
}

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log(`Connected to ${MONGODB_URI}`);

  await Doctor.deleteMany({ name: /^Dr\. Dummy / });
  await User.deleteMany({ name: /^Dummy User / });

  const users = [];
  for (let i = 0; i < 5; i += 1) {
    users.push({
      empid: 30100 + i,
      id: 30100 + i,
      name: `Dummy User ${i + 1}`,
      password: 'pass1234',
    });
  }
  const createdUsers = await User.insertMany(users);
  console.log(`Inserted ${createdUsers.length} dummy users (empid 30100–30104, password pass1234)`);

  const hasSampleVideo = fs.existsSync(SAMPLE_VIDEO);
  const doctors = [];

  for (let i = 0; i < 20; i += 1) {
    const first = FIRST[i];
    const last = LAST[i % LAST.length];
    const name = `Dr. Dummy ${first} ${last}`;
    const initials = `${first[0]}${last[0]}`.toUpperCase();
    const hue = (i * 17) % 360;
    const owner = createdUsers[i % createdUsers.length];
    const posterDefs = POSTER_SETS[i % POSTER_SETS.length];

    const logo = await writeUpload(logoSvg(initials, hue), 'logos', '.svg');
    const posters = [];

    for (const def of posterDefs) {
      let image;
      if (def.kind === 'video' && hasSampleVideo) {
        image = await writeUpload(await fs.promises.readFile(SAMPLE_VIDEO), 'posters', '.mp4');
      } else {
        image = await writeUpload(posterSvg(def.label, def.kind, hue), 'posters', '.svg');
      }
      posters.push({
        image,
        downloads: (i % 4) + 1,
        createdAt: new Date(),
        kind: def.kind,
        label: def.label,
      });
    }

    doctors.push({
      ownerUser: owner._id,
      name,
      clinicName: CLINICS[i % CLINICS.length],
      doctorDegree: DEGREES[i % DEGREES.length],
      contactnumber: 9100000000 + i,
      logo,
      poster: posters[posters.length - 1].image,
      posters,
      downloadCount: posters.reduce((sum, poster) => sum + poster.downloads, 0),
      active: true,
    });
  }

  await Doctor.insertMany(doctors);
  console.log(`Inserted ${doctors.length} dummy doctors with posters`);
  console.log(`Totals → doctors: ${await Doctor.countDocuments()}, users: ${await User.countDocuments()}`);
  await mongoose.disconnect();
  console.log('Seed complete.');
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
