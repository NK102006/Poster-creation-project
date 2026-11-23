// src/components/Poster.jsx
// Dynamic clinical poster template + high-res canvas renderer

export const POSTER_THEMES = [
  {
    id: 'theme-blue',
    name: 'Cool Blue',
    description: 'Professional medical blue',
    headerBg: '#1a4f8b',
    accentColor: '#2b6cb0',
    highlight: '#1d6fb8',
    badgeBg: '#1a4f8b',
    badgeText: '#ffffff',
    cardGlow: 'rgba(26, 79, 139, 0.12)',
    footerBg: '#143a66',
    footerAccent: '#3b82c4',
    textTitle: '#1a3a66',
    bgGradient: 'linear-gradient(160deg, #f4f9fd 0%, #e4f0fa 40%, #f7ebf2 100%)',
    bgStart: '#f5fafd',
    bgMid: '#e5f1fa',
    bgEnd: '#f8ecf3',
    wash: 'rgba(214, 120, 168, 0.35)',
    washSecondary: 'rgba(120, 170, 220, 0.28)',
    softLeaf: 'rgba(72, 145, 110, 0.32)',
    scriptColor: '#1a4f8b',
    ribbon: 'rgba(214, 120, 168, 0.28)',
  },
  {
    id: 'theme-warm-red',
    name: 'Warm Red',
    description: 'Warm crimson and rose',
    headerBg: '#9c1c4a',
    accentColor: '#c0267a',
    highlight: '#d63384',
    badgeBg: '#9c1c4a',
    badgeText: '#ffffff',
    cardGlow: 'rgba(198, 38, 122, 0.12)',
    footerBg: '#7a1540',
    footerAccent: '#e85a9b',
    textTitle: '#1f2a5a',
    bgGradient: 'linear-gradient(160deg, #f3f8fc 0%, #eef4fb 35%, #fbe9f1 100%)',
    bgStart: '#f4f8fc',
    bgMid: '#eef3fa',
    bgEnd: '#fce8f1',
    wash: 'rgba(232, 120, 170, 0.42)',
    washSecondary: 'rgba(150, 185, 230, 0.25)',
    softLeaf: 'rgba(72, 145, 110, 0.3)',
    scriptColor: '#1f2a5a',
    ribbon: 'rgba(232, 140, 180, 0.35)',
  },
  {
    id: 'theme-green',
    name: 'Emerald Green',
    description: 'Natural emerald wellness',
    headerBg: '#1b5c45',
    accentColor: '#218a62',
    highlight: '#1f7a58',
    badgeBg: '#1b5c45',
    badgeText: '#ffffff',
    cardGlow: 'rgba(27, 92, 69, 0.14)',
    footerBg: '#134435',
    footerAccent: '#34b386',
    textTitle: '#134435',
    bgGradient: 'linear-gradient(160deg, #f3faf6 0%, #e5f3ec 45%, #eef6f1 100%)',
    bgStart: '#f4fbf7',
    bgMid: '#e6f4ed',
    bgEnd: '#eef7f2',
    wash: 'rgba(80, 170, 130, 0.32)',
    washSecondary: 'rgba(140, 200, 180, 0.22)',
    softLeaf: 'rgba(45, 120, 90, 0.34)',
    scriptColor: '#134435',
    ribbon: 'rgba(80, 170, 130, 0.28)',
  },
  {
    id: 'theme-purple',
    name: 'Royal Purple',
    description: 'Soft royal lilac',
    headerBg: '#4c1d95',
    accentColor: '#7c3aed',
    highlight: '#9333ea',
    badgeBg: '#4c1d95',
    badgeText: '#ffffff',
    cardGlow: 'rgba(124, 58, 237, 0.14)',
    footerBg: '#2e1065',
    footerAccent: '#a78bfa',
    textTitle: '#2e1065',
    bgGradient: 'linear-gradient(160deg, #f7f4ff 0%, #efe9ff 45%, #f8ebf5 100%)',
    bgStart: '#f8f5ff',
    bgMid: '#efe9ff',
    bgEnd: '#f9ecf6',
    wash: 'rgba(180, 130, 230, 0.35)',
    washSecondary: 'rgba(210, 160, 220, 0.25)',
    softLeaf: 'rgba(72, 145, 110, 0.28)',
    scriptColor: '#2e1065',
    ribbon: 'rgba(180, 130, 230, 0.3)',
  },
];

export const POSTER_THERAPIES = [
  {
    id: 'infertility',
    name: 'Infertility',
    badge: 'INFERTILITY',
    therapyLabel: 'Infertility Treatment',
    icon: '🌸',
    title: 'Hope Grows Here',
    subtitle: 'Expert Care in Infertility Treatment',
    pillars: 'Science | Compassion | New Beginnings',
    features: [
      { label: 'Personalized Treatment Plans', color: '#e85a9b' },
      { label: 'Advanced Fertility Solutions', color: '#8b5cf6' },
      { label: 'Support at Every Step', color: '#34a06c' },
    ],
    quote: 'Because every family has a story worth waiting for',
    recommendedTheme: 'theme-warm-red',
  },
  {
    id: 'diabetes',
    name: 'Diabetes',
    badge: 'DIABETES',
    therapyLabel: 'Diabetes Care',
    icon: '🩸',
    title: 'Balance for Life',
    subtitle: 'Expert Care in Diabetes Care',
    pillars: 'Monitoring | Guidance | Wellness',
    features: [
      { label: 'Personalized Care Plans', color: '#3b82c4' },
      { label: 'Advanced Monitoring', color: '#6366f1' },
      { label: 'Support at Every Step', color: '#34a06c' },
    ],
    quote: 'Small daily choices create lasting health',
    recommendedTheme: 'theme-blue',
  },
  {
    id: 'cardio',
    name: 'Cardio',
    badge: 'CARDIO',
    therapyLabel: 'Cardiac Care',
    icon: '❤️',
    title: 'Stronger Heart Days',
    subtitle: 'Expert Care in Cardiac Care',
    pillars: 'Prevention | Care | Recovery',
    features: [
      { label: 'Heart Health Guidance', color: '#e85a9b' },
      { label: 'Advanced Cardiac Care', color: '#ef4444' },
      { label: 'Support at Every Step', color: '#34a06c' },
    ],
    quote: 'Every healthy beat builds a brighter tomorrow',
    recommendedTheme: 'theme-warm-red',
  },
  {
    id: 'hypertension',
    name: 'Hypertension',
    badge: 'HYPERTENSION',
    therapyLabel: 'Blood Pressure Care',
    icon: '🩺',
    title: 'Steady Pressure Care',
    subtitle: 'Expert Care in Blood Pressure Care',
    pillars: 'Awareness | Control | Longevity',
    features: [
      { label: 'Pressure Control Plans', color: '#218a62' },
      { label: 'Lifestyle Guidance', color: '#0ea5e9' },
      { label: 'Support at Every Step', color: '#34a06c' },
    ],
    quote: 'Calm days begin with steady care',
    recommendedTheme: 'theme-green',
  },
];

export const DEFAULT_DOCTOR_LOGO = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 520" width="400" height="520">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#d9e7f5"/>
      <stop offset="100%" stop-color="#f3d6e4"/>
    </linearGradient>
  </defs>
  <rect width="400" height="520" fill="url(#g)"/>
  <circle cx="200" cy="190" r="78" fill="#c5d4e4"/>
  <ellipse cx="200" cy="390" rx="120" ry="140" fill="#b7c8db"/>
</svg>
`)}`;

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = String(text).split(' ');
  let line = '';
  let currentY = y;
  const lines = [];

  for (let n = 0; n < words.length; n++) {
    const testLine = `${line}${words[n]} `;
    if (ctx.measureText(testLine).width > maxWidth && n > 0) {
      lines.push(line.trim());
      line = `${words[n]} `;
    } else {
      line = testLine;
    }
  }
  lines.push(line.trim());

  lines.forEach((l, i) => {
    ctx.fillText(l, x, currentY + i * lineHeight);
  });

  return lines.length * lineHeight;
}

function drawSoftLeaf(ctx, x, y, scale, color, rotation = -0.4) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.scale(scale, scale);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(26, -20, 58, -10, 68, 20);
  ctx.bezierCurveTo(42, 24, 16, 18, 0, 0);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(8, 4);
  ctx.quadraticCurveTo(34, 2, 58, 16);
  ctx.stroke();
  ctx.restore();
}

function drawWatercolorBlob(ctx, x, y, rx, ry, color) {
  ctx.save();
  const g = ctx.createRadialGradient(x, y, 10, x, y, Math.max(rx, ry));
  g.addColorStop(0, color);
  g.addColorStop(0.55, color.replace(/[\d.]+\)$/, (a) => `${Math.max(0, parseFloat(a) * 0.45)})`));
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCoverImage(ctx, img, x, y, w, h) {
  const scale = Math.max(w / img.width, h / img.height) * 1.02;
  const drawW = img.width * scale;
  const drawH = img.height * scale;
  const dx = x + (w - drawW) / 2;
  const dy = y + (h - drawH) * 0.08;
  ctx.drawImage(img, dx, dy, drawW, drawH);
}

/**
 * Soft feathered portrait: no hard box — fades into the poster wash.
 */
function drawBlendedPortrait(ctx, img, x, y, w, h) {
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  const o = off.getContext('2d');

  drawCoverImage(o, img, 0, 0, w, h);

  // Build soft alpha mask on a second canvas
  const mask = document.createElement('canvas');
  mask.width = w;
  mask.height = h;
  const m = mask.getContext('2d');

  // Soft vertical body silhouette
  const body = m.createRadialGradient(w * 0.52, h * 0.38, w * 0.12, w * 0.5, h * 0.42, h * 0.62);
  body.addColorStop(0, 'rgba(0,0,0,1)');
  body.addColorStop(0.55, 'rgba(0,0,0,0.98)');
  body.addColorStop(0.82, 'rgba(0,0,0,0.55)');
  body.addColorStop(1, 'rgba(0,0,0,0)');
  m.fillStyle = body;
  m.fillRect(0, 0, w, h);

  // Extra soft left blend into copy area
  const left = m.createLinearGradient(0, 0, w * 0.28, 0);
  left.addColorStop(0, 'rgba(0,0,0,0)');
  left.addColorStop(0.45, 'rgba(0,0,0,0.55)');
  left.addColorStop(1, 'rgba(0,0,0,1)');
  m.globalCompositeOperation = 'destination-in';
  m.fillStyle = left;
  m.fillRect(0, 0, w, h);

  // Soft bottom fade under name card
  m.globalCompositeOperation = 'destination-in';
  const bottom = m.createLinearGradient(0, h * 0.62, 0, h);
  bottom.addColorStop(0, 'rgba(0,0,0,1)');
  bottom.addColorStop(0.55, 'rgba(0,0,0,0.85)');
  bottom.addColorStop(1, 'rgba(0,0,0,0)');
  m.fillStyle = bottom;
  m.fillRect(0, 0, w, h);

  // Soft top fade
  m.globalCompositeOperation = 'destination-in';
  const top = m.createLinearGradient(0, 0, 0, h * 0.18);
  top.addColorStop(0, 'rgba(0,0,0,0)');
  top.addColorStop(1, 'rgba(0,0,0,1)');
  m.fillStyle = top;
  m.fillRect(0, 0, w, h);

  // Apply mask to portrait
  o.globalCompositeOperation = 'destination-in';
  o.drawImage(mask, 0, 0);

  ctx.drawImage(off, x, y);
}

function drawFeatureIcon(ctx, x, y, color, index) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, 34, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 22px "Segoe UI", Tahoma, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const glyphs = ['♡', '🔬', '👥'];
  ctx.fillText(glyphs[index] || '✦', x, y + 1);
  ctx.restore();
}

/**
 * High-resolution canvas renderer — reference-style clinical poster (1200 x 1500)
 */
export async function renderPosterToCanvas(
  canvas,
  { themeId, therapyId, doctor, customTitle, dateText }
) {
  const theme = POSTER_THEMES.find((t) => t.id === themeId) || POSTER_THEMES[0];
  const therapy = POSTER_THERAPIES.find((t) => t.id === therapyId) || POSTER_THERAPIES[0];

  const headline = customTitle || therapy.title;
  const therapyLabel = therapy.therapyLabel || therapy.name;
  const dateStr =
    dateText ||
    new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

  const width = 1200;
  const height = 1500;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // ---- Background atmosphere ----
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  const grad = ctx.createLinearGradient(0, 0, width * 0.15, height);
  grad.addColorStop(0, theme.bgStart);
  grad.addColorStop(0.4, theme.bgMid || theme.bgStart);
  grad.addColorStop(1, theme.bgEnd);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Watercolor washes (restored poster atmosphere)
  drawWatercolorBlob(ctx, width * 0.78, height * 0.38, 340, 420, theme.wash);
  drawWatercolorBlob(ctx, width * 0.7, height * 0.55, 260, 300, theme.washSecondary || theme.wash);
  drawWatercolorBlob(ctx, width * 0.2, height * 0.82, 220, 160, theme.washSecondary || theme.wash);
  drawWatercolorBlob(ctx, width * 0.88, height * 0.16, 160, 120, theme.washSecondary || theme.wash);

  // Botanical leaves
  drawSoftLeaf(ctx, 48, height - 290, 2.4, theme.softLeaf, -0.5);
  drawSoftLeaf(ctx, 120, height - 240, 1.7, theme.softLeaf, 0.35);
  drawSoftLeaf(ctx, width - 70, 150, 1.8, theme.softLeaf, 0.7);
  drawSoftLeaf(ctx, width - 140, height - 220, 2.0, theme.softLeaf, -0.25);
  drawSoftLeaf(ctx, 40, 180, 1.3, theme.softLeaf, 0.9);

  // ---- Header ----
  ctx.save();
  drawRoundedRect(ctx, 72, 64, 36, 36, 9);
  ctx.fillStyle = theme.accentColor;
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.2;
  drawRoundedRect(ctx, 81, 73, 18, 16, 3);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(81, 78.5);
  ctx.lineTo(99, 78.5);
  ctx.moveTo(86, 70);
  ctx.lineTo(86, 75);
  ctx.moveTo(94, 70);
  ctx.lineTo(94, 75);
  ctx.stroke();

  ctx.fillStyle = theme.textTitle;
  ctx.font = '700 30px "Segoe UI", Tahoma, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(dateStr, 124, 83);

  // Decorative script (top)
  ctx.fillStyle = theme.scriptColor || theme.textTitle;
  ctx.font = 'italic 600 28px Georgia, "Times New Roman", serif';
  ctx.textAlign = 'center';
  ctx.fillText('Small Steps Big Miracles ♡', width * 0.52, 88);
  ctx.restore();

  // ---- Doctor photo (blended) ----
  const photoSrc = doctor?.logo || DEFAULT_DOCTOR_LOGO;
  const photoImg = await loadImage(photoSrc);
  const photoX = 560;
  const photoY = 150;
  const photoW = 580;
  const photoH = 980;

  if (photoImg) {
    // Soft glow plate behind portrait
    drawWatercolorBlob(ctx, photoX + photoW * 0.48, photoY + photoH * 0.42, 280, 360, theme.wash);
    drawBlendedPortrait(ctx, photoImg, photoX, photoY, photoW, photoH);
  }

  // ---- Left copy ----
  const leftX = 72;
  const copyTop = 200;

  ctx.save();
  ctx.fillStyle = theme.textTitle;
  ctx.font = '800 76px "Segoe UI", Tahoma, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const headlineHeight = wrapText(ctx, headline, leftX, copyTop, 500, 84);

  // Leaf accent near headline
  drawSoftLeaf(ctx, leftX + 310, copyTop + 18, 1.1, theme.softLeaf, -0.2);

  const careY = copyTop + headlineHeight + 24;
  ctx.font = '600 32px "Segoe UI", Tahoma, sans-serif';
  ctx.fillStyle = theme.textTitle;
  const prefix = 'Expert Care in ';
  ctx.fillText(prefix, leftX, careY);
  const prefixW = ctx.measureText(prefix).width;
  ctx.fillStyle = theme.highlight || theme.accentColor;
  ctx.font = '800 32px "Segoe UI", Tahoma, sans-serif';
  wrapText(ctx, therapyLabel, leftX + prefixW, careY, 460 - prefixW, 40);

  // Pillars line
  ctx.fillStyle = theme.textTitle;
  ctx.font = '600 22px "Segoe UI", Tahoma, sans-serif';
  ctx.globalAlpha = 0.85;
  ctx.fillText(therapy.pillars || 'Science | Compassion | Care', leftX, careY + 58);
  ctx.globalAlpha = 1;

  // Feature icons
  const features = therapy.features || [];
  const featureY = careY + 150;
  features.forEach((feature, i) => {
    const fx = leftX + 48 + i * 155;
    drawFeatureIcon(ctx, fx, featureY, feature.color, i);
    ctx.fillStyle = theme.textTitle;
    ctx.font = '600 16px "Segoe UI", Tahoma, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    wrapText(ctx, feature.label, fx, featureY + 48, 130, 20);
  });
  ctx.restore();

  // ---- Doctor name card ----
  const rawDocName = doctor?.name?.trim() || 'Doctor Name';
  const formattedDocName = rawDocName.startsWith('Dr.') ? rawDocName : `Dr. ${rawDocName}`;

  const cardW = 430;
  const cardH = 128;
  const cardX = photoX + (photoW - cardW) / 2 - 20;
  const cardY = photoY + photoH - 210;

  ctx.save();
  ctx.shadowColor = 'rgba(20, 40, 70, 0.2)';
  ctx.shadowBlur = 28;
  ctx.shadowOffsetY = 12;
  ctx.fillStyle = '#ffffff';
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 24);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.fillStyle = theme.textTitle;
  ctx.font = '800 36px "Segoe UI", Tahoma, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(formattedDocName, cardX + cardW / 2, cardY + 48);
  ctx.font = '500 20px "Segoe UI", Tahoma, sans-serif';
  ctx.globalAlpha = 0.78;
  ctx.fillText('Consultant Specialist', cardX + cardW / 2, cardY + 88);
  ctx.restore();

  // Quote ribbon
  ctx.save();
  ctx.translate(width * 0.34, height - 320);
  ctx.rotate(-0.06);
  ctx.fillStyle = theme.ribbon || theme.wash;
  drawRoundedRect(ctx, -220, -28, 440, 56, 18);
  ctx.fill();
  ctx.fillStyle = theme.highlight || theme.accentColor;
  ctx.font = 'italic 600 22px Georgia, "Times New Roman", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`“${therapy.quote || 'Care that feels personal'} ♡”`, 0, 2);
  ctx.restore();

  // Side script
  ctx.save();
  ctx.fillStyle = theme.scriptColor || theme.textTitle;
  ctx.font = 'italic 600 26px Georgia, "Times New Roman", serif';
  ctx.textAlign = 'right';
  ctx.fillText('New Hope · Brighter Tomorrows ♡', width - 70, height - 250);
  ctx.restore();

  // ---- WhatsApp ----
  const waNumber = doctor?.contactnumber ? String(doctor.contactnumber).trim() : '';
  const waDisplay = waNumber || 'Contact for consultation';
  const waY = height - 175;

  ctx.save();
  ctx.beginPath();
  ctx.arc(108, waY, 38, 0, Math.PI * 2);
  ctx.fillStyle = '#25D366';
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 26px "Segoe UI", Tahoma, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('✆', 108, waY + 1);

  ctx.textAlign = 'left';
  ctx.fillStyle = theme.textTitle;
  ctx.font = '600 20px "Segoe UI", Tahoma, sans-serif';
  ctx.fillText('Chat with us on WhatsApp', 168, waY - 16);
  ctx.font = '800 38px "Segoe UI", Tahoma, sans-serif';
  ctx.fillText(waDisplay, 168, waY + 22);
  ctx.restore();

  // Info strip
  ctx.save();
  ctx.fillStyle = theme.textTitle;
  ctx.globalAlpha = 0.7;
  ctx.font = '600 16px "Segoe UI", Tahoma, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(
    'Personalized Patient Education  •  Informative Health Posts  •  A Healthier Community Together',
    width / 2,
    height - 105
  );
  ctx.restore();

  // Footer bar
  const footerH = 72;
  ctx.fillStyle = theme.highlight || theme.headerBg;
  ctx.fillRect(0, height - footerH, width, footerH);
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 24px "Segoe UI", Tahoma, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('HEALTHY FAMILIES  •  HAPPIER TOMORROWS', width / 2, height - footerH / 2);

  return canvas;
}
