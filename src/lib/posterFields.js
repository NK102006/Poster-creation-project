/** Shared helpers for doctor fields placed on a poster by the designer. */

// Placed rectangles are fractions (0-1) of the 4:5 poster canvas.
export const FIELD_MIN_W = 0.03;
export const FIELD_MIN_H = 0.02;

export function isImageField(field) {
  return Boolean(field) && (field.key === 'logo' || field.key === 'photo' || field.type === 'file');
}

export const FIELD_SHAPES = [
  { id: 'circle', label: 'Circle' },
  { id: 'rectangle', label: 'Rectangle' },
  { id: 'square', label: 'Square' },
];

// A box that is square on the 1080 x 1350 canvas has h = w * 0.8 as fractions.
export const CANVAS_RATIO = 1080 / 1350;

export function isSquareShape(shape) {
  return shape === 'circle' || shape === 'square';
}

/** Shrinks a rectangle (keeping its top-left) so it is square on the canvas. */
export function squareUp(rect) {
  const side = Math.min(rect.w, rect.h / CANVAS_RATIO);
  return { ...rect, w: side, h: side * CANVAS_RATIO };
}

export function shapeRadius(shape) {
  return shape === 'circle' ? '50%' : undefined;
}

// —— Text colour that suits the theme and the poster underneath ——
function channel(value) {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function hexLuminance(hex) {
  const h = String(hex || '').replace('#', '');
  if (h.length !== 6) return 0.1;
  return (
    0.2126 * channel(parseInt(h.slice(0, 2), 16)) +
    0.7152 * channel(parseInt(h.slice(2, 4), 16)) +
    0.0722 * channel(parseInt(h.slice(4, 6), 16))
  );
}

function contrastRatio(a, b) {
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Picks the theme colour when it reads well on the background, otherwise
 * white or near-black depending on how dark the background is.
 */
export function chooseTextColor(backgroundLuminance, themeColor) {
  if (backgroundLuminance == null) return themeColor || '#ffffff';
  if (themeColor && contrastRatio(hexLuminance(themeColor), backgroundLuminance) >= 3) return themeColor;
  return backgroundLuminance < 0.4 ? '#ffffff' : '#10202c';
}

/** Returns a function giving the average luminance (0-1) under a poster rectangle. */
export function createImageSampler(img) {
  try {
    const width = 216;
    const height = 270;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const scale = Math.max(width / img.naturalWidth, height / img.naturalHeight);
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    ctx.drawImage(img, (width - dw) / 2, (height - dh) / 2, dw, dh);
    ctx.getImageData(0, 0, 1, 1); // throws if the canvas is tainted

    return (rect) => {
      const x = Math.max(0, Math.floor(rect.x * width));
      const y = Math.max(0, Math.floor(rect.y * height));
      const w = Math.max(1, Math.min(width - x, Math.ceil(rect.w * width)));
      const h = Math.max(1, Math.min(height - y, Math.ceil(rect.h * height)));
      const { data } = ctx.getImageData(x, y, w, h);
      let total = 0;
      for (let i = 0; i < data.length; i += 4) {
        total += 0.2126 * channel(data[i]) + 0.7152 * channel(data[i + 1]) + 0.0722 * channel(data[i + 2]);
      }
      return total / (data.length / 4);
    };
  } catch {
    return null;
  }
}

export function fieldBoxStyle(field) {
  return {
    position: 'absolute',
    left: `${field.x * 100}%`,
    top: `${field.y * 100}%`,
    width: `${field.w * 100}%`,
    height: `${field.h * 100}%`,
  };
}

export function posterImageUrl(link) {
  const raw = String(link || '');
  if (!raw) return '';
  return /^(https?:|data:|blob:)/.test(raw) || raw.startsWith('/') ? raw : `/${raw}`;
}
