// src/components/LogoCanvas.jsx
// Circular interactive canvas — user drags the photo to position it inside the circle
import { useRef, useState, useEffect, useCallback } from 'react';
import styles from './LogoCanvas.module.css';

const CANVAS_SIZE = 300; // square canvas, circle inscribed
const RADIUS = CANVAS_SIZE / 2;

export default function LogoCanvas({ logoSrc, onChange }) {
  const canvasRef = useRef(null);
  const [logoImg, setLogoImg] = useState(null);

  // Logo position & scale within the canvas
  const [logoPos, setLogoPos] = useState({ x: 0, y: 0 });
  const [logoScale, setLogoScale] = useState(1);

  // Drag state
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Load the logo image whenever the source changes
  useEffect(() => {
    if (!logoSrc) {
      setLogoImg(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setLogoImg(img);
      // Scale image to cover the circle
      const scale = Math.max(CANVAS_SIZE / img.width, CANVAS_SIZE / img.height);
      setLogoScale(scale);
      // Center the image
      setLogoPos({
        x: (CANVAS_SIZE - img.width * scale) / 2,
        y: (CANVAS_SIZE - img.height * scale) / 2,
      });
    };
    img.src = logoSrc;
  }, [logoSrc]);

  // Draw the canvas
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Clear everything
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Draw circular clip region
    ctx.save();
    ctx.beginPath();
    ctx.arc(RADIUS, RADIUS, RADIUS, 0, Math.PI * 2);
    ctx.clip();

    // Checkerboard background inside circle
    const tileSize = 10;
    for (let row = 0; row < CANVAS_SIZE / tileSize; row++) {
      for (let col = 0; col < CANVAS_SIZE / tileSize; col++) {
        ctx.fillStyle = (row + col) % 2 === 0 ? '#f2f2f2' : '#ffffff';
        ctx.fillRect(col * tileSize, row * tileSize, tileSize, tileSize);
      }
    }

    // Draw the logo image inside the circle
    if (logoImg) {
      const drawW = logoImg.width * logoScale;
      const drawH = logoImg.height * logoScale;
      ctx.drawImage(logoImg, logoPos.x, logoPos.y, drawW, drawH);
    } else {
      // Placeholder text
      ctx.fillStyle = '#bbb';
      ctx.font = '13px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Upload a logo above', RADIUS, RADIUS - 10);
      ctx.fillText('to position it here', RADIUS, RADIUS + 10);
    }

    ctx.restore(); // release clip

    // Draw circular border ring on top
    ctx.save();
    ctx.beginPath();
    ctx.arc(RADIUS, RADIUS, RADIUS - 1.5, 0, Math.PI * 2);
    ctx.strokeStyle = logoImg ? 'rgba(0, 123, 255, 0.6)' : 'rgba(0, 0, 0, 0.12)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();

    // If dragging, show a subtle inner highlight
    if (dragging && logoImg) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(RADIUS, RADIUS, RADIUS - 4, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0, 123, 255, 0.25)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.restore();
    }
  }, [logoImg, logoPos, logoScale, dragging]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Export the circular cropped logo whenever position changes
  useEffect(() => {
    if (!logoImg || !onChange) return;
    const timeout = setTimeout(() => {
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = CANVAS_SIZE;
      exportCanvas.height = CANVAS_SIZE;
      const ectx = exportCanvas.getContext('2d');
      ectx.beginPath();
      ectx.arc(RADIUS, RADIUS, RADIUS, 0, Math.PI * 2);
      ectx.clip();
      const drawW = logoImg.width * logoScale;
      const drawH = logoImg.height * logoScale;
      ectx.drawImage(logoImg, logoPos.x, logoPos.y, drawW, drawH);
      onChange(exportCanvas.toDataURL('image/png'));
    }, 200);
    return () => clearTimeout(timeout);
  }, [logoImg, logoPos, logoScale, onChange]);

  // --- Pointer helpers ---
  const getMousePos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scale = CANVAS_SIZE / rect.width;
    return {
      mx: (e.clientX - rect.left) * scale,
      my: (e.clientY - rect.top) * scale,
    };
  };

  const isInsideCircle = (mx, my) => {
    const dx = mx - RADIUS;
    const dy = my - RADIUS;
    return dx * dx + dy * dy <= RADIUS * RADIUS;
  };

  const handlePointerDown = (e) => {
    if (!logoImg) return;
    const { mx, my } = getMousePos(e);
    if (!isInsideCircle(mx, my)) return;

    setDragging(true);
    setDragStart({ x: mx - logoPos.x, y: my - logoPos.y });
    canvasRef.current?.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!logoImg) return;
    const { mx, my } = getMousePos(e);

    // Cursor
    canvasRef.current.style.cursor =
      isInsideCircle(mx, my) ? (dragging ? 'grabbing' : 'grab') : 'default';

    if (dragging) {
      setLogoPos({
        x: mx - dragStart.x,
        y: my - dragStart.y,
      });
    }
  };

  const handlePointerUp = (e) => {
    setDragging(false);
    canvasRef.current?.releasePointerCapture(e.pointerId);
  };

  // Zoom with mouse wheel / trackpad scroll
  const handleWheel = (e) => {
    if (!logoImg) return;
    e.preventDefault();
    const { mx, my } = getMousePos(e);

    setLogoScale((prev) => {
      const minScale = Math.max(CANVAS_SIZE / logoImg.width, CANVAS_SIZE / logoImg.height) * 0.4;
      const maxScale = Math.max(CANVAS_SIZE / logoImg.width, CANVAS_SIZE / logoImg.height) * 4;
      const delta = e.deltaY > 0 ? -0.02 : 0.02;
      const next = Math.min(maxScale, Math.max(minScale, prev + delta));

      // Zoom towards cursor position
      const ratio = next / prev;
      setLogoPos((p) => ({
        x: mx - (mx - p.x) * ratio,
        y: my - (my - p.y) * ratio,
      }));

      return next;
    });
  };

  // Attach wheel listener with { passive: false } to allow preventDefault
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  });

  // Reset to center
  const handleReset = () => {
    if (!logoImg) return;
    const scale = Math.max(CANVAS_SIZE / logoImg.width, CANVAS_SIZE / logoImg.height);
    setLogoScale(scale);
    setLogoPos({
      x: (CANVAS_SIZE - logoImg.width * scale) / 2,
      y: (CANVAS_SIZE - logoImg.height * scale) / 2,
    });
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.canvasLabel}>
        <span className={styles.labelIcon}>🖼️</span>
        <span>Position Your Logo</span>
      </div>

      <div className={styles.circleContainer}>
        <canvas
          ref={canvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          className={styles.canvas}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />
      </div>

      {logoImg && (
        <button type="button" className={styles.resetBtn} onClick={handleReset}>
          ↺ Reset
        </button>
      )}

      <span className={styles.hint}>
        {logoImg ? 'Drag to move · Scroll to zoom' : 'Upload a logo above to begin'}
      </span>
    </div>
  );
}
