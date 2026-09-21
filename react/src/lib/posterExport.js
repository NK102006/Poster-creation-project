/** Render themed blank poster pages to JPEG blobs for download / zip. */
import { createRoot } from 'react-dom/client';
import { toJpeg } from 'html-to-image';
import { createElement } from 'react';
import RiskFactorPoster from '../components/RiskFactorPoster';

export function mapThemeToRiskFactor(themeId) {
  switch (themeId) {
    case 'theme-warm-red':
      return 'red';
    case 'theme-green':
      return 'green';
    case 'theme-purple':
      return 'purple';
    case 'theme-blue':
    default:
      return 'blue';
  }
}

function waitForImages(node) {
  const images = Array.from(node?.querySelectorAll('img') || []);
  return Promise.all(
    images.map(
      (img) =>
        new Promise((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          img.onload = () => resolve();
          img.onerror = () => resolve();
        })
    )
  );
}

export async function renderRiskFactorPosterBlob(fields) {
  const host = document.createElement('div');
  host.style.cssText =
    'position:fixed;left:-10000px;top:0;width:736px;height:736px;pointer-events:none;opacity:0;';
  document.body.appendChild(host);

  const root = createRoot(host);
  root.render(
    createElement(RiskFactorPoster, {
      logo: fields.logo,
      doctorName: fields.doctorName,
      doctorDegree: fields.doctorDegree,
      clinicName: fields.clinicName,
      phone: fields.phone,
      theme: fields.theme || 'blue',
      id: 'risk-factor-poster-export',
    })
  );

  await new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });

  const node = host.querySelector('.rfp');
  if (!node) {
    root.unmount();
    host.remove();
    throw new Error('Risk factor poster node not found');
  }

  await waitForImages(node);

  try {
    const dataUrl = await toJpeg(node, {
      quality: 0.95,
      pixelRatio: 2,
      cacheBust: true,
    });
    const res = await fetch(dataUrl);
    return res.blob();
  } finally {
    root.unmount();
    host.remove();
  }
}

function hexToRgb(hex) {
  const h = String(hex || '').replace('#', '');
  if (h.length !== 6) return { r: 243, g: 235, b: 224 };
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function fillThemeBackground(ctx, width, height, theme) {
  const start = theme?.bgStart || '#f7f1e8';
  const mid = theme?.bgMid || theme?.bgStart || '#efe6d8';
  const end = theme?.bgEnd || '#f3ebe0';
  const grad = ctx.createLinearGradient(0, 0, width * 0.2, height);
  grad.addColorStop(0, start);
  grad.addColorStop(0.45, mid);
  grad.addColorStop(1, end);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  const wash = theme?.wash || 'rgba(198,164,106,0.25)';
  const wash2 = theme?.washSecondary || 'rgba(198,164,106,0.12)';

  const blob = (x, y, r, color) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };

  blob(width * 0.82, height * 0.22, width * 0.38, wash);
  blob(width * 0.18, height * 0.78, width * 0.32, wash2);
}

export function renderBlankPosterDataUrl(theme, label, options = {}) {
  const width = options.width || 900;
  const height = options.height || 1200;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  fillThemeBackground(ctx, width, height, theme);

  ctx.fillStyle = theme?.textTitle || '#1a2a25';
  ctx.globalAlpha = 0.28;
  ctx.font = '600 48px "Cormorant Garamond", Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label || 'Poster', width / 2, height / 2);
  ctx.globalAlpha = 1;

  const accent = theme?.accentColor || '#c6a46a';
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  ctx.strokeRect(28, 28, width - 56, height - 56);

  return canvas.toDataURL('image/jpeg', 0.92);
}

export async function renderBlankPosterBlob(theme, label) {
  const dataUrl = renderBlankPosterDataUrl(theme, label);
  const res = await fetch(dataUrl);
  return res.blob();
}

export function themePageStyle(theme) {
  return {
    background:
      theme?.bgGradient ||
      'linear-gradient(180deg, #ffffff 0%, #f3ebe0 100%)',
    borderColor: theme?.accentColor || 'rgba(36, 71, 62, 0.12)',
    color: theme?.textTitle || '#1a2a25',
    boxShadow: `0 18px 40px rgba(8, 20, 16, 0.22), 0 0 0 1px ${
      theme?.accentColor || 'rgba(198,164,106,0.25)'
    }33`,
    '--page-wash': theme?.wash || 'rgba(198,164,106,0.2)',
    '--page-label': theme?.textTitle || '#1a2a25',
  };
}

export { hexToRgb };
