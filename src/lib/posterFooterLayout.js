/** Locked footer overlay on the 1080 × 1350 poster canvas (4:5). Origin is top-left. */
export const POSTER_CANVAS = { width: 1080, height: 1350 };

const B = 6;

export const POSTER_FOOTER = {
  barHeight: 112,
  leftBar: { x: 0, y: 1238, w: 631, h: 112 },
  rightBar: { x: 631, y: 1238, w: 449, h: 112 },
  // Image sits 6px in so the left white border can sit on x = 0.
  photo: { x: B, y: 1156, w: 176, h: 194 },
  photoRadius: 24,
  photoBorderPx: B,
  photoBorderLeft: { x: 0, y: 1156, w: B, h: 194 },
  photoBorderRight: { x: B + 176, y: 1156, w: B, h: 194 },
  photoBorderTop: { x: B, y: 1156 - B, w: 176, h: B },
  name: { x: 217, y: 1259, w: 390, h: 41 },
  degree: { x: 217, y: 1303, w: 390, h: 29 },
  clinic: { x: 657, y: 1259, w: 400, h: 41 },
  phone: { x: 657, y: 1303, w: 400, h: 29 },
};

export function fitPosterScale(boxWidth, boxHeight) {
  return Math.min(boxWidth / POSTER_CANVAS.width, boxHeight / POSTER_CANVAS.height);
}
