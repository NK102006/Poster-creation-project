import { useCallback, useLayoutEffect, useRef } from 'react';
import { fieldBoxStyle, isImageField, shapeRadius } from '../lib/posterFields';

const JUSTIFY = { left: 'flex-start', center: 'center', right: 'flex-end' };

/** One line of text that sizes itself to fill its box without overflowing. */
export function FitText({ text, color, align = 'left', weight = 700 }) {
  const boxRef = useRef(null);
  const textRef = useRef(null);

  const fit = useCallback(() => {
    const box = boxRef.current;
    const span = textRef.current;
    if (!box || !span) return;
    const boxW = box.offsetWidth;
    const boxH = box.offsetHeight;
    if (!boxW || !boxH) return;
    span.style.fontSize = '100px';
    const textW = span.offsetWidth;
    if (!textW) return;
    const size = Math.max(4, Math.min((100 * boxW) / textW, boxH * 0.82));
    span.style.fontSize = `${size}px`;
  }, []);

  useLayoutEffect(() => {
    fit();
    const box = boxRef.current;
    const observer = new ResizeObserver(fit);
    if (box) observer.observe(box);
    document.fonts?.ready.then(fit);
    return () => observer.disconnect();
  }, [fit, text]);

  return (
    <div
      ref={boxRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: JUSTIFY[align] || JUSTIFY.left,
        overflow: 'hidden',
      }}
    >
      <span
        ref={textRef}
        style={{
          flexShrink: 0,
          display: 'inline-block',
          whiteSpace: 'nowrap',
          color,
          fontFamily: 'var(--font-body)',
          fontWeight: weight,
          lineHeight: 1.1,
        }}
      >
        {text}
      </span>
    </div>
  );
}

/** Draws doctor fields at the rectangles a superadmin placed on the poster. */
export default function PosterFieldsOverlay({ fields = [], values = {} }) {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 4 }}>
      {fields.map((field) => {
        const value = values[field.key];
        if (!value) return null;

        if (isImageField(field)) {
          return (
            <div
              key={field.key}
              style={{ ...fieldBoxStyle(field), overflow: 'hidden', borderRadius: shapeRadius(field.shape) }}
            >
              <img
                src={value}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', display: 'block' }}
              />
            </div>
          );
        }

        return (
          <div key={field.key} style={fieldBoxStyle(field)}>
            <FitText text={value} color={field.color || '#ffffff'} />
          </div>
        );
      })}
    </div>
  );
}
