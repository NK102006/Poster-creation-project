// src/components/LogoCanvas.jsx
// Square interactive canvas — drag to move, slider to zoom (center fixed)
import { useRef, useState, useEffect, useCallback } from 'react';
import styles from './LogoCanvas.module.css';

const CANVAS_SIZE = 300;
const CENTER = CANVAS_SIZE / 2;

export default function LogoCanvas({ logoSrc, onChange, initialState }) {
  const canvasRef = useRef(null);
  const [logoImg, setLogoImg] = useState(null);
  const [logoPos, setLogoPos] = useState({ x: 0, y: 0 });
  const [logoScale, setLogoScale] = useState(1);
  const [baseScale, setBaseScale] = useState(1);
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!logoSrc) {
      setLogoImg(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setLogoImg(img);
      const scale = Math.max(CANVAS_SIZE / img.width, CANVAS_SIZE / img.height);
      setBaseScale(scale);
      if (initialState) {
        setLogoScale(initialState.scale);
        setLogoPos(initialState.pos);
      } else {
        setLogoScale(scale);
        setLogoPos({
          x: (CANVAS_SIZE - img.width * scale) / 2,
          y: (CANVAS_SIZE - img.height * scale) / 2,
        });
      }
    };
    img.src = logoSrc;
  }, [logoSrc]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    ctx.clip();

    const tileSize = 10;
    for (let row = 0; row < CANVAS_SIZE / tileSize; row++) {
      for (let col = 0; col < CANVAS_SIZE / tileSize; col++) {
        ctx.fillStyle = (row + col) % 2 === 0 ? '#f2f2f2' : '#ffffff';
        ctx.fillRect(col * tileSize, row * tileSize, tileSize, tileSize);
      }
    }

    if (logoImg) {
      const drawW = logoImg.width * logoScale;
      const drawH = logoImg.height * logoScale;
      ctx.drawImage(logoImg, logoPos.x, logoPos.y, drawW, drawH);
    }

    ctx.restore();

    ctx.save();
    ctx.strokeStyle = logoImg ? '#4a9fd4' : 'rgba(0, 0, 0, 0.12)';
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, CANVAS_SIZE - 3, CANVAS_SIZE - 3);
    ctx.restore();

    if (dragging && logoImg) {
      ctx.save();
      ctx.strokeStyle = 'rgba(74, 159, 212, 0.35)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(4, 4, CANVAS_SIZE - 8, CANVAS_SIZE - 8);
      ctx.restore();
    }
  }, [logoImg, logoPos, logoScale, dragging]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    if (!logoImg || !onChange) return;
    const timeout = setTimeout(() => {
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = CANVAS_SIZE;
      exportCanvas.height = CANVAS_SIZE;
      const ectx = exportCanvas.getContext('2d');
      ectx.beginPath();
      ectx.rect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      ectx.clip();
      const drawW = logoImg.width * logoScale;
      const drawH = logoImg.height * logoScale;
      ectx.drawImage(logoImg, logoPos.x, logoPos.y, drawW, drawH);
      onChange(exportCanvas.toDataURL('image/png'), { pos: logoPos, scale: logoScale });
    }, 200);
    return () => clearTimeout(timeout);
  }, [logoImg, logoPos, logoScale, onChange]);

  const getMousePos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scale = CANVAS_SIZE / rect.width;
    return {
      mx: (e.clientX - rect.left) * scale,
      my: (e.clientY - rect.top) * scale,
    };
  };

  const isInsideSquare = (mx, my) =>
    mx >= 0 && mx <= CANVAS_SIZE && my >= 0 && my <= CANVAS_SIZE;

  const applyScaleKeepingCenter = (nextScale) => {
    const prev = logoScale || 1;
    const ratio = nextScale / prev;
    setLogoScale(nextScale);
    setLogoPos((p) => ({
      x: CENTER - (CENTER - p.x) * ratio,
      y: CENTER - (CENTER - p.y) * ratio,
    }));
  };

  const minScale = baseScale * 0.4;
  const maxScale = baseScale * 4;

  const handlePointerDown = (e) => {
    if (!logoImg) return;
    const { mx, my } = getMousePos(e);
    if (!isInsideSquare(mx, my)) return;

    setDragging(true);
    setDragStart({ x: mx - logoPos.x, y: my - logoPos.y });
    canvasRef.current?.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!logoImg) return;
    const { mx, my } = getMousePos(e);

    canvasRef.current.style.cursor =
      isInsideSquare(mx, my) ? (dragging ? 'grabbing' : 'grab') : 'default';

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

  const handleZoomChange = (e) => {
    if (!logoImg) return;
    const next = Number(e.target.value);
    applyScaleKeepingCenter(next);
  };

  const handleZoomOut = () => {
    if (!logoImg) return;
    const next = Math.max(minScale, logoScale - (maxScale - minScale) * 0.05);
    applyScaleKeepingCenter(next);
  };

  const handleZoomIn = () => {
    if (!logoImg) return;
    const next = Math.min(maxScale, logoScale + (maxScale - minScale) * 0.05);
    applyScaleKeepingCenter(next);
  };

  if (!logoSrc) return null;

  return (
    <div className={styles.wrapper}>
      <div className={styles.squareContainer}>
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
        <div className={styles.zoomBar}>
          <button
            type="button"
            className={styles.zoomBtn}
            onClick={handleZoomOut}
            aria-label="Zoom out"
          >
            −
          </button>
          <input
            type="range"
            className={styles.zoomSlider}
            min={minScale}
            max={maxScale}
            step={(maxScale - minScale) / 100}
            value={logoScale}
            onChange={handleZoomChange}
            aria-label="Zoom"
          />
          <button
            type="button"
            className={styles.zoomBtn}
            onClick={handleZoomIn}
            aria-label="Zoom in"
          >
            +
          </button>
        </div>
      )}
    </div>
  );
}
