import { POSTER_CANVAS, POSTER_FOOTER as F } from '../lib/posterFooterLayout';

function pct(value, total) {
  return `${(value / total) * 100}%`;
}

function box(rect) {
  return {
    position: 'absolute',
    left: pct(rect.x, POSTER_CANVAS.width),
    top: pct(rect.y, POSTER_CANVAS.height),
    width: pct(rect.w, POSTER_CANVAS.width),
    height: pct(rect.h, POSTER_CANVAS.height),
  };
}

export default function PosterFooterOverlay({
  logo,
  doctorName,
  doctorDegree,
  clinicName,
  phone,
  logoFit = 'cover',
}) {
  const radius = `${(F.photoRadius / F.photo.w) * 100}%`;
  const border = `${(F.photoBorderPx / POSTER_CANVAS.width) * 100}cqw`;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 4,
        containerType: 'size',
      }}
    >
      <div style={{ ...box(F.leftBar), background: 'rgba(18, 64, 138, 0.94)' }} />
      <div style={{ ...box(F.rightBar), background: 'rgba(214, 43, 31, 0.94)' }} />

      {logo ? (
        <div
          style={{
            ...box(F.photo),
            overflow: 'hidden',
            borderRadius: `${radius} ${radius} 0 0`,
            background: '#fff',
            boxShadow: `-${border} 0 0 #fff, ${border} 0 0 #fff, 0 -${border} 0 #fff`,
          }}
        >
          <img
            src={logo}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: logoFit, objectPosition: 'center top', display: 'block' }}
          />
        </div>
      ) : null}

      <div style={{ ...box(F.name), color: '#fff', fontWeight: 700, fontSize: `${(26 / POSTER_CANVAS.height) * 100}cqh`, lineHeight: 1.15, overflow: 'hidden', whiteSpace: 'nowrap' }}>
        {doctorName}
      </div>
      {doctorDegree ? (
        <div style={{ ...box(F.degree), color: '#fff', fontWeight: 500, fontSize: `${(19 / POSTER_CANVAS.height) * 100}cqh`, lineHeight: 1.15, overflow: 'hidden', whiteSpace: 'nowrap', opacity: 0.92 }}>
          {doctorDegree}
        </div>
      ) : null}
      <div style={{ ...box(F.clinic), color: '#fff', fontWeight: 700, fontSize: `${(26 / POSTER_CANVAS.height) * 100}cqh`, lineHeight: 1.15, overflow: 'hidden', whiteSpace: 'nowrap' }}>
        {clinicName}
      </div>
      {phone ? (
        <div style={{ ...box(F.phone), color: '#fff', fontWeight: 600, fontSize: `${(20 / POSTER_CANVAS.height) * 100}cqh`, lineHeight: 1.15, overflow: 'hidden', whiteSpace: 'nowrap' }}>
          {phone}
        </div>
      ) : null}
    </div>
  );
}
