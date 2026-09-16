// src/components/Poster.jsx
// Dynamic Pharma Poster Template definitions and Canvas Renderer

export const POSTER_THEMES = [
  {
    id: 'theme-blue',
    name: 'Cool Blue',
    description: 'Professional medical blue with forest green accents',
    headerBg: '#0056b3',
    accentColor: '#007bff',
    badgeBg: '#0056b3',
    badgeText: '#ffffff',
    cardGlow: 'rgba(0, 86, 179, 0.1)',
    footerBg: '#0f2942',
    footerAccent: '#28a745',
    textTitle: '#0f2942',
    bgGradient: 'linear-gradient(135deg, #eef7fc 0%, #d2e4f5 100%)',
    bgStart: '#eef7fc',
    bgEnd: '#d2e4f5',
  },
  {
    id: 'theme-warm-red',
    name: 'Warm Red',
    description: 'Rich crimson and warm orange cardiovascular tones',
    headerBg: '#c92a2a',
    accentColor: '#ff6b6b',
    badgeBg: '#9c0c0c',
    badgeText: '#ffffff',
    cardGlow: 'rgba(201, 42, 42, 0.1)',
    footerBg: '#4a0e17',
    footerAccent: '#ffa94d',
    textTitle: '#4a0e17',
    bgGradient: 'linear-gradient(135deg, #fff3f3 0%, #fbe3e3 50%, #f3c2c2 100%)',
    bgStart: '#fff3f3',
    bgEnd: '#f3c2c2',
  },
  {
    id: 'theme-green',
    name: 'Emerald Green',
    description: 'Refreshing vitality and natural wellness teal',
    headerBg: '#0f5132',
    accentColor: '#198754',
    badgeBg: '#0f5132',
    badgeText: '#ffffff',
    cardGlow: 'rgba(15, 81, 50, 0.15)',
    footerBg: '#0b2211',
    footerAccent: '#34d399',
    textTitle: '#0f5132',
    bgGradient: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 60%, #bbf7d0 100%)',
    bgStart: '#f0fdf4',
    bgEnd: '#bbf7d0',
  },
  {
    id: 'theme-purple',
    name: 'Royal Purple',
    description: 'Deep royal indigo and lavender care accents',
    headerBg: '#4c1d95',
    accentColor: '#7c3aed',
    badgeBg: '#4c1d95',
    badgeText: '#ffffff',
    cardGlow: 'rgba(76, 29, 149, 0.15)',
    footerBg: '#1e1b4b',
    footerAccent: '#a78bfa',
    textTitle: '#311062',
    bgGradient: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 60%, #ddd6fe 100%)',
    bgStart: '#f5f3ff',
    bgEnd: '#ddd6fe',
  },
];

export const POSTER_THERAPIES = [
  {
    id: 'infertility',
    name: 'Infertility',
    badge: 'INFERTILITY',
    icon: '🌸',
    title: 'Guiding Hope, Nurturing Life',
    subtitle: 'Comprehensive fertility care and reproductive health guidance.',
    recommendedTheme: 'theme-purple',
  },
  {
    id: 'diabetes',
    name: 'Diabetes',
    badge: 'DIABETES',
    icon: '🩸',
    title: 'Mastering Diabetes, Empowering Life',
    subtitle: 'Simple steps today, healthier balance tomorrow.',
    recommendedTheme: 'theme-blue',
  },
  {
    id: 'cardio',
    name: 'Cardio',
    badge: 'CARDIO',
    icon: '❤️',
    title: 'Take Care of Your Heart',
    subtitle: 'Simple steps today, healthier beats tomorrow.',
    recommendedTheme: 'theme-warm-red',
  },
  {
    id: 'hypertension',
    name: 'Hypertension',
    badge: 'HYPERTENSION',
    icon: '🩺',
    title: 'Control Your Blood Pressure',
    subtitle: 'Proactive care today, a stronger and safer tomorrow.',
    recommendedTheme: 'theme-green',
  },
];

export const DEFAULT_DOCTOR_LOGO = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 120" width="240" height="120">
  <rect width="240" height="120" rx="10" fill="#ffffff"/>
  <g transform="translate(18, 20)">
    <circle cx="40" cy="40" r="36" fill="#0056b3" fill-opacity="0.1" stroke="#0056b3" stroke-width="3"/>
    <path d="M40 22 V58 M22 40 H58" stroke="#0056b3" stroke-width="7" stroke-linecap="round"/>
    <circle cx="40" cy="40" r="7" fill="#28a745"/>
  </g>
  <text x="104" y="52" font-family="'Segoe UI', Roboto, sans-serif" font-weight="800" font-size="24" fill="#0f2942">MEDICAL</text>
  <text x="104" y="76" font-family="'Segoe UI', Roboto, sans-serif" font-weight="700" font-size="13" fill="#007bff" letter-spacing="3">CLINIC +</text>
</svg>
`)}`;

/**
 * Loads an image from URL or data URI and returns an HTMLImageElement
 */
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

/**
 * Draws rounded rectangle on canvas
 */
function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Helper to wrap text cleanly
 */
function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let currentY = y;

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;
    if (testWidth > maxWidth && n > 0) {
      ctx.fillText(line, x, currentY);
      line = words[n] + ' ';
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, currentY);
}

/**
 * High-resolution canvas renderer for the user's poster template (1200 x 1500 px, 4:5 ratio)
 */
export async function renderPosterToCanvas(
  canvas,
  { themeId, therapyId, doctor, customTitle, customSubtitle, dateText }
) {
  const theme =
    POSTER_THEMES.find((t) => t.id === themeId) || POSTER_THEMES[0];
  const therapy =
    POSTER_THERAPIES.find((t) => t.id === therapyId) || POSTER_THERAPIES[0];

  const title = customTitle || therapy.title;
  const subtitle = customSubtitle || therapy.subtitle;
  const dateStr = dateText || new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).toUpperCase();

  const width = 1200;
  const height = 1500;

  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // 1. Solid opaque base & Background Gradient (4:5 Aspect Ratio, required for JPEG)
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, theme.bgStart);
  grad.addColorStop(1, theme.bgEnd);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Subtle texture
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.025)';
  for (let x = 0; x < width; x += 40) {
    for (let y = 0; y < height; y += 40) {
      ctx.fillRect(x, y, 20, 20);
    }
  }
  ctx.restore();

  // 2. HEADER: Doctor Logo & Date
  const headerPaddingX = 80;
  const headerPaddingY = 60;
  const headerHeight = 220;

  // Header bottom border line (5px solid var(--header-bg))
  ctx.fillStyle = theme.headerBg;
  ctx.fillRect(0, headerHeight, width, 10);

  // Doctor Logo Card in Header
  const logoCardWidth = 240;
  const logoCardHeight = 150;
  const logoCardX = headerPaddingX;
  const logoCardY = headerPaddingY - 15;

  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 4;
  drawRoundedRect(ctx, logoCardX, logoCardY, logoCardWidth, logoCardHeight, 16);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  // Draw Logo in Header (Doctor's logo or default medical clinic logo)
  const headerLogoSrc = doctor?.logo || DEFAULT_DOCTOR_LOGO;
  let headerLogoImg = null;
  if (headerLogoSrc) {
    headerLogoImg = await loadImage(headerLogoSrc);
  }

  if (headerLogoImg) {
    ctx.save();
    drawRoundedRect(ctx, logoCardX + 8, logoCardY + 8, logoCardWidth - 16, logoCardHeight - 16, 10);
    ctx.clip();
    ctx.drawImage(headerLogoImg, logoCardX + 16, logoCardY + 16, logoCardWidth - 32, logoCardHeight - 32);
    ctx.restore();
  }

  // Date Pill on Top Right
  ctx.save();
  const datePillText = `DATE: ${dateStr}`;
  ctx.font = 'bold 26px "Segoe UI", Tahoma, sans-serif';
  const dateMetrics = ctx.measureText(datePillText);
  const datePillWidth = dateMetrics.width + 48;
  const datePillHeight = 60;
  const datePillX = width - headerPaddingX - datePillWidth;
  const datePillY = headerPaddingY + 20;

  ctx.fillStyle = theme.cardGlow;
  drawRoundedRect(ctx, datePillX, datePillY, datePillWidth, datePillHeight, 30);
  ctx.fill();

  ctx.fillStyle = theme.headerBg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(datePillText, datePillX + datePillWidth / 2, datePillY + datePillHeight / 2 + 1);
  ctx.restore();

  // 3. BODY: Therapy Type Badge, Poster Title, Subtitle
  const bodyTop = headerHeight + 60;
  const bodyBottom = height - 260;
  const bodyCenterY = bodyTop + (bodyBottom - bodyTop) / 2;

  // Therapy Badge
  ctx.save();
  const badgeText = `THERAPY TYPE: ${therapy.badge}`;
  ctx.font = 'bold 36px "Segoe UI", Tahoma, sans-serif';
  const badgeMetrics = ctx.measureText(badgeText);
  const badgeWidth = badgeMetrics.width + 80;
  const badgeHeight = 84;
  const badgeX = (width - badgeWidth) / 2;
  const badgeY = bodyCenterY - 240;

  ctx.fillStyle = theme.badgeBg;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 6;
  drawRoundedRect(ctx, badgeX, badgeY, badgeWidth, badgeHeight, 42);
  ctx.fill();

  ctx.fillStyle = theme.badgeText;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(badgeText, width / 2, badgeY + badgeHeight / 2 + 1);
  ctx.restore();

  // Poster Title
  ctx.save();
  ctx.fillStyle = theme.textTitle;
  ctx.font = '800 68px "Segoe UI", Tahoma, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const titleY = badgeY + badgeHeight + 50;
  wrapText(ctx, title, width / 2, titleY, width - 200, 84);
  ctx.restore();

  // Poster Subtitle
  ctx.save();
  ctx.fillStyle = '#444444';
  ctx.font = '500 34px "Segoe UI", Tahoma, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const subtitleY = titleY + 180;
  wrapText(ctx, subtitle, width / 2, subtitleY, width - 280, 52);
  ctx.restore();

  // 4. FOOTER: Doctor Name & Title on left, WhatsApp on right (Exact Template)
  const footerHeight = 220;
  const footerY = height - footerHeight;

  // Accent Line on top of footer (4px solid var(--footer-accent))
  ctx.fillStyle = theme.footerAccent;
  ctx.fillRect(0, footerY, width, 8);

  // Footer Background (var(--footer-bg))
  ctx.fillStyle = theme.footerBg;
  ctx.fillRect(0, footerY + 8, width, footerHeight - 8);

  // Footer Left Content: Doctor Name & Title
  const footerLeftX = 80;
  const footerCenterY = footerY + footerHeight / 2 + 4;
  const rawDocName = doctor?.name || 'Doctor';
  const formattedDocName = rawDocName.startsWith('Dr.') ? rawDocName : `Dr. ${rawDocName}`;

  ctx.save();
  // Doctor Name
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 44px "Segoe UI", Tahoma, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText(formattedDocName, footerLeftX, footerCenterY - 6);

  // Doctor Title
  ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
  ctx.font = '28px "Segoe UI", Tahoma, sans-serif';
  ctx.textBaseline = 'top';
  ctx.fillText('Consultant Specialist', footerLeftX, footerCenterY + 6);
  ctx.restore();

  // Footer Right Content: Doctor WhatsApp
  ctx.save();
  const footerRightX = width - 80;
  const waNumber = doctor?.contactnumber ? String(doctor.contactnumber) : '';
  const waDisplay = waNumber ? `📞 ${waNumber}` : '📞 Contact for Appointments';

  ctx.fillStyle = theme.footerAccent;
  ctx.font = '600 38px "Segoe UI", Tahoma, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(waDisplay, footerRightX, footerCenterY);
  ctx.restore();

  return canvas;
}

