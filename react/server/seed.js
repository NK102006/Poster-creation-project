import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/posterCreation';
const UPLOADS_DIR = path.resolve('uploads');

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

const templatePosterSchema = new mongoose.Schema({
  posterlink: { type: String, required: true },
  category: { type: String, default: '' },
  color: { type: String, default: '' },
  month: { type: String, default: '' },
  uploaddate: { type: Date, default: Date.now },
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
const Poster = mongoose.model('Poster', templatePosterSchema);

const COLORS = {
  blue: { top: [227, 241, 252], mid: [31, 111, 159], bar: [18, 64, 138] },
  red: { top: [254, 234, 231], mid: [198, 22, 28], bar: [127, 16, 21] },
  green: { top: [230, 246, 233], mid: [20, 104, 58], bar: [20, 104, 58] },
  purple: { top: [241, 233, 251], mid: [91, 33, 182], bar: [74, 29, 150] },
};

const FONT = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01111', '10000', '10000', '10111', '10001', '10001', '01110'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '10101', '01010'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  '&': ['01100', '10010', '01100', '01110', '10001', '10010', '01101'],
};

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([length, typeBuf, data, crcBuf]);
}

function encodePng(width, height, getPixel) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 3 + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = getPixel(x, y);
      const i = row + 1 + x * 3;
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function drawText(setPixel, text, startX, startY, scale, rgb) {
  let x = startX;
  for (const ch of String(text).toUpperCase()) {
    const glyph = FONT[ch] || FONT[' '];
    for (let gy = 0; gy < 7; gy += 1) {
      for (let gx = 0; gx < 5; gx += 1) {
        if (glyph[gy][gx] !== '1') continue;
        for (let dy = 0; dy < scale; dy += 1) {
          for (let dx = 0; dx < scale; dx += 1) {
            setPixel(x + gx * scale + dx, startY + gy * scale + dy, rgb);
          }
        }
      }
    }
    x += 6 * scale;
  }
}

function makePosterPng({ color = 'blue', title = 'POSTER', subtitle = 'HEALTH TIP' }) {
  const width = 1080;
  const height = 1350;
  const palette = COLORS[color] || COLORS.blue;
  const pixels = new Uint8Array(width * height * 3);

  const setPixel = (x, y, rgb) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = (y * width + x) * 3;
    pixels[i] = rgb[0];
    pixels[i + 1] = rgb[1];
    pixels[i + 2] = rgb[2];
  };

  for (let y = 0; y < height; y += 1) {
    const t = y / (height - 1);
    const bg = [
      Math.round(palette.top[0] + (255 - palette.top[0]) * t * 0.15),
      Math.round(palette.top[1] + (255 - palette.top[1]) * t * 0.08),
      Math.round(palette.top[2] + (255 - palette.top[2]) * t * 0.05),
    ];
    for (let x = 0; x < width; x += 1) setPixel(x, y, bg);
  }

  for (let y = 0; y < 120; y += 1) {
    for (let x = 0; x < width; x += 1) setPixel(x, y, palette.mid);
  }
  for (let y = 1238; y < height; y += 1) {
    for (let x = 0; x < 631; x += 1) setPixel(x, y, palette.bar);
    for (let x = 631; x < width; x += 1) setPixel(x, y, [214, 43, 31]);
  }

  drawText(setPixel, subtitle, 70, 220, 5, palette.mid);
  drawText(setPixel, title, 70, 320, 10, palette.bar);
  drawText(setPixel, 'DUMMY POSTER', 70, 520, 4, [90, 90, 90]);

  return encodePng(width, height, (x, y) => {
    const i = (y * width + x) * 3;
    return [pixels[i], pixels[i + 1], pixels[i + 2]];
  });
}

function makeLogoPng(initials, color = 'blue') {
  const size = 160;
  const palette = COLORS[color] || COLORS.blue;
  const pixels = new Uint8Array(size * size * 3);
  const setPixel = (x, y, rgb) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 3;
    pixels[i] = rgb[0];
    pixels[i + 1] = rgb[1];
    pixels[i + 2] = rgb[2];
  };
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = x - 80;
      const dy = y - 80;
      setPixel(x, y, dx * dx + dy * dy <= 70 * 70 ? palette.mid : [245, 245, 245]);
    }
  }
  drawText(setPixel, initials.slice(0, 2), 38, 58, 6, [255, 255, 255]);
  return encodePng(size, size, (x, y) => {
    const i = (y * size + x) * 3;
    return [pixels[i], pixels[i + 1], pixels[i + 2]];
  });
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function clearSeedFiles(subfolder) {
  const dir = path.join(UPLOADS_DIR, subfolder);
  ensureDir(dir);
  for (const name of fs.readdirSync(dir)) {
    if (name.startsWith('seed-')) fs.unlinkSync(path.join(dir, name));
  }
}

function writeUpload(subfolder, filename, buffer) {
  const relativePath = `uploads/${subfolder}/${filename}`;
  fs.writeFileSync(path.join(UPLOADS_DIR, subfolder, filename), buffer);
  return relativePath;
}

const ADMINS = [
  { username: 'riya', password: 'admin123' },
  { username: 'kabir', password: 'admin123' },
  { username: 'meera', password: 'admin123' },
  { username: 'vikram', password: 'admin123' },
];

const USERS = [
  { empid: '40101', password: 'pass1234', admin: 'riya' },
  { empid: '40102', password: 'pass1234', admin: 'riya' },
  { empid: '40103', password: 'pass1234', admin: 'riya' },
  { empid: '50201', password: 'pass1234', admin: 'kabir' },
  { empid: '50202', password: 'pass1234', admin: 'kabir' },
  { empid: '60301', password: 'pass1234', admin: 'meera' },
  { empid: '60302', password: 'pass1234', admin: 'meera' },
  { empid: '70401', password: 'pass1234', admin: 'vikram' },
];

const DOCTORS = [
  { ownerEmpid: '40101', name: 'Dr. Ananya Shah', doctorDegree: 'MBBS, MD', clinicName: 'Sunrise Heart Clinic', contactnumber: 9876501234, color: 'red', initials: 'AS' },
  { ownerEmpid: '40101', name: 'Dr. Rohan Mehta', doctorDegree: 'MBBS', clinicName: 'City Care Hospital', contactnumber: 9876501235, color: 'blue', initials: 'RM' },
  { ownerEmpid: '40101', name: 'Dr. Neha Kulkarni', doctorDegree: 'MBBS, DNB', clinicName: 'Lotus Wellness', contactnumber: 9876501236, color: 'green', initials: 'NK' },
  { ownerEmpid: '40102', name: 'Dr. Kavya Iyer', doctorDegree: 'BDS', clinicName: 'Pearl Dental Studio', contactnumber: 9876502234, color: 'purple', initials: 'KI' },
  { ownerEmpid: '40102', name: 'Dr. Sameer Joshi', doctorDegree: 'MBBS, MD', clinicName: 'Westend Clinic', contactnumber: 9876502235, color: 'blue', initials: 'SJ' },
  { ownerEmpid: '40103', name: 'Dr. Priya Nair', doctorDegree: 'MBBS, MS', clinicName: 'Nair Eye Centre', contactnumber: 9876503234, color: 'green', initials: 'PN' },
  { ownerEmpid: '50201', name: 'Dr. Arjun Patel', doctorDegree: 'MBBS, MS', clinicName: 'Greenfield Ortho', contactnumber: 9876504234, color: 'green', initials: 'AP' },
  { ownerEmpid: '50201', name: 'Dr. Isha Verma', doctorDegree: 'MBBS', clinicName: 'Harmony Clinic', contactnumber: 9876504235, color: 'red', initials: 'IV' },
  { ownerEmpid: '50202', name: 'Dr. Mohit Rao', doctorDegree: 'MD, DM', clinicName: 'Rao Cardio Care', contactnumber: 9876505234, color: 'red', initials: 'MR' },
  { ownerEmpid: '60301', name: 'Dr. Sneha Desai', doctorDegree: 'MBBS, DGO', clinicName: 'Bloom Women Care', contactnumber: 9876506234, color: 'purple', initials: 'SD' },
  { ownerEmpid: '60302', name: 'Dr. Kabir Khan', doctorDegree: 'MBBS, MD', clinicName: 'Northside Clinic', contactnumber: 9876507234, color: 'blue', initials: 'KK' },
  { ownerEmpid: '70401', name: 'Dr. Rhea Kapoor', doctorDegree: 'BAMS', clinicName: 'Ayush Path', contactnumber: 9876508234, color: 'green', initials: 'RK', active: false },
];

const MASTER_POSTERS = [
  { title: 'HYDRATION', subtitle: 'HEALTH TIP', category: 'Education', color: 'blue', month: 'September' },
  { title: 'SLEEP WELL', subtitle: 'HEALTH TIP', category: 'Education', color: 'purple', month: 'September' },
  { title: 'NUTRITION', subtitle: 'HEALTH TIP', category: 'Education', color: 'green', month: 'September' },
  { title: 'MOVE MORE', subtitle: 'HEALTH TIP', category: 'Education', color: 'red', month: 'September' },
  { title: 'BLOOD PRESSURE', subtitle: 'SILENT THREAT', category: 'Education', color: 'blue', month: 'September' },
  { title: 'STRESS CARE', subtitle: 'MIND HEALTH', category: 'Education', color: 'purple', month: 'October' },
  { title: 'HEART CARE', subtitle: 'CARDIO TIP', category: 'Education', color: 'red', month: 'October' },
  { title: 'DIABETES', subtitle: 'DAILY CARE', category: 'Education', color: 'green', month: 'October' },
  { title: 'GANESH', subtitle: 'FESTIVAL', category: 'Festival', color: 'orange', month: 'September' },
  { title: 'NAVRATRI', subtitle: 'FESTIVAL', category: 'Festival', color: 'purple', month: 'September' },
  { title: 'DIWALI', subtitle: 'FESTIVAL', category: 'Festival', color: 'red', month: 'October' },
  { title: 'CHRISTMAS', subtitle: 'FESTIVAL', category: 'Festival', color: 'green', month: 'December' },
  { title: 'HOLI', subtitle: 'FESTIVAL', category: 'Festival', color: 'purple', month: 'March' },
  { title: 'NEW YEAR', subtitle: 'FESTIVAL', category: 'Festival', color: 'blue', month: 'January' },
  { title: 'CLINIC REEL', subtitle: 'VIDEO STILL', category: 'Video', color: 'blue', month: 'September' },
  { title: 'CAMP INVITE', subtitle: 'VIDEO STILL', category: 'Video', color: 'red', month: 'October' },
];

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log(`Connected to ${MONGODB_URI}`);

  for (const folder of ['master_posters', 'education_posters', 'festival_posters', 'posters', 'logos']) {
    clearSeedFiles(folder);
  }

  const deleted = {
    posters: (await Poster.deleteMany({})).deletedCount,
    doctors: (await Doctor.deleteMany({})).deletedCount,
    users: (await User.deleteMany({})).deletedCount,
    admins: (await Admin.deleteMany({})).deletedCount,
  };
  console.log(
    `Removed ${deleted.admins} admin(s), ${deleted.users} user(s), ${deleted.doctors} doctor(s), ${deleted.posters} poster(s)`
  );

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

  const masterDocs = [];
  MASTER_POSTERS.forEach((item, index) => {
    const color = COLORS[item.color] ? item.color : 'blue';
    const filename = `seed-master-${String(index + 1).padStart(2, '0')}.png`;
    const posterlink = writeUpload(
      'master_posters',
      filename,
      makePosterPng({ color, title: item.title, subtitle: item.subtitle })
    );
    masterDocs.push({
      posterlink,
      category: item.category,
      color,
      month: item.month,
      uploaddate: new Date(2026, 8, 1 + index),
    });
  });
  await Poster.insertMany(masterDocs);

  for (const [index, doctor] of DOCTORS.entries()) {
    const logo = writeUpload(
      'logos',
      `seed-logo-${index + 1}.png`,
      makeLogoPng(doctor.initials, doctor.color)
    );
    const posterKind = index % 3 === 0 ? 'festival' : 'education';
    const folder = posterKind === 'festival' ? 'festival_posters' : 'education_posters';
    const posterA = writeUpload(
      folder,
      `seed-doc-${index + 1}a.png`,
      makePosterPng({
        color: doctor.color,
        title: posterKind === 'festival' ? 'FESTIVE WISH' : 'DAILY CARE',
        subtitle: doctor.clinicName.toUpperCase().slice(0, 18),
      })
    );
    const posterB = writeUpload(
      folder,
      `seed-doc-${index + 1}b.png`,
      makePosterPng({
        color: doctor.color,
        title: doctor.initials,
        subtitle: 'CLINIC POSTER',
      })
    );

    await Doctor.create({
      ownerUser: userByEmpid[doctor.ownerEmpid]._id,
      name: doctor.name,
      doctorDegree: doctor.doctorDegree,
      clinicName: doctor.clinicName,
      contactnumber: doctor.contactnumber,
      logo,
      poster: posterB,
      posters: [
        { image: posterA, downloads: 2 + index, kind: posterKind, label: `${doctor.name} 1` },
        { image: posterB, downloads: 1, kind: 'education', label: `${doctor.name} 2` },
      ],
      downloadCount: 3 + index,
      active: doctor.active !== false,
    });
  }

  console.log(
    `Added ${ADMINS.length} admin(s), ${USERS.length} user(s), ${DOCTORS.length} doctor(s), ${MASTER_POSTERS.length} master poster(s)`
  );
  console.log('Logins:');
  console.log('  Superadmin  superadmin / superadmin123');
  console.log('  Admin       riya / admin123');
  console.log('  Admin       kabir / admin123');
  console.log('  Admin       meera / admin123');
  console.log('  Admin       vikram / admin123');
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
