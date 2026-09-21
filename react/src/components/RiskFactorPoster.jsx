// RiskFactorPoster.jsx
// ─────────────────────────────────────────────────────────────────────────────
// "Hypertension's Risk Factors" poster — one self-contained React component.
// The styles live inside this file, so you only need this file + bp-photo.jpg.
//
// WHICH PROP FEEDS WHICH SPOT ON THE POSTER
// ┌──────────────┬────────────────────────────────────────────────────────────┐
// │ logo         │ square logo / doctor photo, top-left (image URL / data URL)│
// │ doctorName   │ (a) top-left, under the logo   (b) bottom-right red bar,   │
// │              │     top line (was "Call For Appointment")                  │
// │ doctorDegree │ top-left, in small text under the doctor's name            │
// │ clinicName   │ bottom-left coloured bar                                   │
// │ phone        │ bottom-right red bar, BOTTOM line (next to the phone icon) │
// │ theme        │ 'blue' | 'red' | 'green' | 'purple'  → colours everything  │
// │ logoFit      │ (optional) 'cover' (default, fills the square, may crop)   │
// │              │     or 'contain' (shows the whole image, may leave margins)│
// │ photo        │ (optional) blood-pressure photo; defaults to bp-photo.jpg  │
// │ id           │ (optional) DOM id, handy for html-to-image / html2canvas   │
// └──────────────┴────────────────────────────────────────────────────────────┘
// Text is used exactly as you pass it (so pass "Dr. Prisha Shah" if you want "Dr.").
// Long names / degrees shrink automatically so they never spill out of their box.
// The logo is never stretched: it is always scaled with its proportions kept.
// You can also pass a ref:  <RiskFactorPoster ref={myRef} ... />
//
// Usage:
//   <RiskFactorPoster
//     logo="/logo.png"
//     doctorName="Dr. Prisha Shah"
//     doctorDegree="MBBS, MD (Medicine)"
//     clinicName="Prisha Health Care & Pharmacy"
//     phone="+91 - 7379354191"
//     theme="green"
//   />
// ─────────────────────────────────────────────────────────────────────────────

import { forwardRef, useEffect, useState } from 'react';
import bpPhoto from '../assets/bp-photo.jpg';

// ─── THEMES ──────────────────────────────────────────────────────────────────
// Every theme is a light-tinted background with DARK text, plus deep colours for
// headings and the bottom bars (which carry WHITE text). All pairs were checked
// for contrast, so nothing blends into the background.
//
//   bg1 / bg2        page background (top → bottom gradient)
//   band / panel     thin stripe across the top / big block behind the photo
//   frameBorder      outline around the photo
//   dotA / dotB      the two decorative circles
//   ink              normal text ("Unmasking the…", risk-factor labels)
//   headA / headB    "HYPERTENSION'S" and "RISK FACTORS."
//   ring             outline of the small round icons
//   nameA / nameB    doctor name / degree under the logo (top-left)
//   barL / barR      bottom-left bar (clinic) and bottom-right bar (doctor + phone)
export const RISK_POSTER_THEMES = {
  blue: {
    bg1: '#e3f1fc', bg2: '#c4dff5', band: '#a6cbea', panel: '#8fbfe8', frameBorder: '#a9cfee',
    dotA: 'rgba(15, 60, 120, 0.28)', dotB: 'rgba(230, 80, 90, 0.55)',
    ink: '#0c2a4a', headA: '#0a559f', headB: '#c62020', ring: '#1f6fb8',
    nameA: '#12408a', nameB: '#d62b1f', barL: '#12408a', barR: '#d62b1f',
  },
  red: {
    bg1: '#feeae7', bg2: '#f9cfca', band: '#f0aaa3', panel: '#ee9b93', frameBorder: '#f3b3ac',
    dotA: 'rgba(120, 20, 25, 0.28)', dotB: 'rgba(230, 70, 70, 0.5)',
    ink: '#4a0f12', headA: '#7f1015', headB: '#c4161c', ring: '#b3262c',
    nameA: '#7f1015', nameB: '#c4161c', barL: '#7f1015', barR: '#c4161c',
  },
  green: {
    bg1: '#e6f6e9', bg2: '#c7e8cf', band: '#a3d5b0', panel: '#8ccb9c', frameBorder: '#a9d9b6',
    dotA: 'rgba(15, 90, 50, 0.28)', dotB: 'rgba(240, 170, 60, 0.55)',
    ink: '#0d3320', headA: '#14683a', headB: '#b45309', ring: '#1b7a45',
    nameA: '#14683a', nameB: '#b45309', barL: '#14683a', barR: '#b45309',
  },
  purple: {
    bg1: '#f1e9fb', bg2: '#dccbf3', band: '#c3a9e8', panel: '#b391e0', frameBorder: '#c9b0ec',
    dotA: 'rgba(70, 25, 140, 0.28)', dotB: 'rgba(230, 80, 150, 0.5)',
    ink: '#2b1454', headA: '#5b21b6', headB: '#be185d', ring: '#6d32c4',
    nameA: '#4a1d96', nameB: '#be185d', barL: '#4a1d96', barR: '#be185d',
  },
};

// ─── Text fitting (long names shrink instead of overflowing) ────────────────
// We measure the real width of the text in the Poppins font, then pick the
// largest font size (up to `base`, down to `min`) that fits in `avail` pixels.
let measureCtx = null;

// width of `text` when the font size is 1px (so width at N px = N × this)
const widthPerPx = (text, weight) => {
  const str = String(text || '');
  if (typeof document === 'undefined') return Math.max(str.length, 1) * 0.66; // server-side fallback
  measureCtx = measureCtx || document.createElement('canvas').getContext('2d');
  measureCtx.font = `${weight} 100px Poppins, 'Segoe UI', Arial, sans-serif`;
  return Math.max(measureCtx.measureText(str).width / 100, 0.01);
};

// Some browsers round glyph widths at small sizes, so we keep ~8% spare room.
const SAFETY = 0.92;

const fitSize = (text, base, min, avail, weight = 600) =>
  Math.max(min, Math.min(base, (avail * SAFETY) / widthPerPx(text, weight)));

// Doctor name under the logo: one line, shrinks if long.
const fitNameSize = (text) => fitSize(text, 17, 9, 178, 700);

// Degree under the doctor's name: one line if it fits, otherwise two small lines.
const fitDegreeSize = (text, avail = 184) => {
  const w = widthPerPx(text, 600);
  const oneLine = (avail * SAFETY) / w;
  if (oneLine >= 10.5) return Math.min(12.5, oneLine);
  return Math.max(8.5, Math.min(11, (avail * 2 * 0.85 * SAFETY) / w));
};

// Wrap at 31 characters, but never split a word.
// If char 31 lands inside a word (e.g. the "o" in "John"), the whole word
// moves to line 2. Only hard-cuts when a single word itself is longer than 31.
const NAME_WRAP_LIMIT = 31;
const splitDoctorName = (name, limit = NAME_WRAP_LIMIT) => {
  const str = String(name || '');
  if (str.length <= limit) return { line1: str, line2: '' };

  const atLimit = str[limit]; // first char that would overflow (0-based index `limit`)
  const beforeLimit = str[limit - 1];

  // Mid-word: both sides of the cut are non-space → pull the whole word down
  if (beforeLimit !== ' ' && atLimit && atLimit !== ' ') {
    let wordStart = limit - 1;
    while (wordStart > 0 && str[wordStart - 1] !== ' ') {
      wordStart -= 1;
    }
    // First word alone is longer than the limit — unavoidable hard cut
    if (wordStart === 0) {
      return { line1: str.slice(0, limit), line2: str.slice(limit) };
    }
    return {
      line1: str.slice(0, wordStart).trimEnd(),
      line2: str.slice(wordStart).trimStart(),
    };
  }

  // Cut lands on/after a space — break cleanly there
  return {
    line1: str.slice(0, limit).trimEnd(),
    line2: str.slice(limit).trimStart(),
  };
};

// Re-render once the Poppins font has finished loading, so the measurements
// above use the real font instead of a fallback.
const useFontsReady = () => {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (typeof document === 'undefined' || !document.fonts) return undefined;
    let alive = true;
    const bump = () => alive && setTick((n) => n + 1);
    document.fonts.load('700 16px Poppins').then(bump).catch(() => {});
    document.fonts.ready.then(bump);
    return () => { alive = false; };
  }, []);
};

// ─── Icons ───────────────────────────────────────────────────────────────────
const IconInactive = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="6.5" r="3" fill="#7a4fa3" />
    <path d="M7 20v-5.5a5 5 0 0 1 10 0V20z" fill="#d4548f" />
    <rect x="4" y="18.5" width="16" height="3" rx="1.5" fill="#7a4fa3" />
  </svg>
);
const IconSmoking = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="9.5" fill="#fff" stroke="#e02818" strokeWidth="2.2" />
    <rect x="6" y="10.6" width="8.5" height="2.8" rx="0.8" fill="#f2a65a" />
    <rect x="14.5" y="10.6" width="3.5" height="2.8" rx="0.8" fill="#8a8a8a" />
    <line x1="5.5" y1="18.5" x2="18.5" y2="5.5" stroke="#e02818" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);
const IconObesity = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="5.5" r="2.8" fill="#8a5a3c" />
    <ellipse cx="12" cy="15" rx="6.8" ry="6.2" fill="#d99a5b" />
    <rect x="5.4" y="14" width="13.2" height="2.2" rx="1.1" fill="#3b3b3b" />
  </svg>
);
const IconGenetics = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M8 3c0 6 8 6 8 12s-8 6-8 6" fill="none" stroke="#7a4fa3" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M16 3c0 6-8 6-8 12s8 6 8 6" fill="none" stroke="#d4548f" strokeWidth="1.8" strokeLinecap="round" />
    <line x1="9" y1="7" x2="15" y2="7" stroke="#7a9ad4" strokeWidth="1.6" strokeLinecap="round" />
    <line x1="9" y1="12" x2="15" y2="12" stroke="#7a9ad4" strokeWidth="1.6" strokeLinecap="round" />
    <line x1="9" y1="17" x2="15" y2="17" stroke="#7a9ad4" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);
const IconAlcohol = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M6 4h12l-1.2 7.5a4.8 4.8 0 0 1-9.6 0z" fill="#e6a23c" />
    <path d="M6.5 7h11" stroke="#fff" strokeWidth="1.2" />
    <rect x="11.2" y="15.5" width="1.6" height="4.5" fill="#6b6b6b" />
    <rect x="8" y="19.6" width="8" height="1.8" rx="0.9" fill="#6b6b6b" />
  </svg>
);
const IconPhone = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="rfp-phoneIcon">
    <path
      fill="#fff"
      d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.3-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1s-.6.8-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.4 0-.5l-.7-1.7c-.2-.4-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2c0 1.3.9 2.5 1 2.7.1.2 1.9 3 4.7 4.1 2.3.9 2.8.7 3.3.7.5-.1 1.6-.7 1.8-1.3.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.6-.3Z"
    />
  </svg>
);

const RISK_FACTORS = [
  { label: 'Inactive lifestyle', Icon: IconInactive },
  { label: 'Smoking', Icon: IconSmoking },
  { label: 'Obesity', Icon: IconObesity },
  { label: 'Genetics', Icon: IconGenetics },
  { label: 'Excessive alcohol consumption', Icon: IconAlcohol },
];

// ─── Styles (poster is drawn on a fixed 736 × 736 canvas) ───────────────────
const CSS = `
.rfp { position: relative; width: 736px; height: 736px; flex-shrink: 0; overflow: hidden;
  box-sizing: border-box; font-family: 'Poppins', 'Segoe UI', Arial, sans-serif; color: var(--rfp-ink);
  background: linear-gradient(180deg, var(--rfp-bg1) 0%, var(--rfp-bg2) 100%); }
.rfp *, .rfp *::before, .rfp *::after { box-sizing: border-box; }
.rfp p { margin: 0; }

.rfp-band  { position: absolute; top: 76px; left: 0; right: 0; height: 8px; background: var(--rfp-band); }
.rfp-panel { position: absolute; top: 78px; right: 0; width: 203px; height: 522px; background: var(--rfp-panel); }
.rfp-dot   { position: absolute; width: 38px; height: 38px; border-radius: 50%; }
.rfp-dot1 { top: 128px; left: 475px; background: var(--rfp-dotA); }
.rfp-dot2 { top: 128px; left: 507px; background: var(--rfp-dotB); }
.rfp-dot3 { top: 416px; left: 281px; background: var(--rfp-dotB); }
.rfp-dot4 { top: 449px; left: 281px; background: var(--rfp-dotA); }

.rfp-tab { position: absolute; top: 0; left: 34px; width: 204px; height: 156px; background: #fff;
  border-radius: 0 0 20px 20px; box-shadow: 0 6px 16px rgba(20, 30, 60, 0.14);
  display: flex; flex-direction: column; align-items: center; padding-top: 10px; z-index: 3; }
.rfp-tabTall { height: 172px; padding-top: 8px; }
.rfp-tabTall .rfp-logo { width: 88px; height: 88px; }
.rfp-logo { width: 98px; height: 98px; border-radius: 0; background: transparent; overflow: hidden;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.rfp-logo img { width: 100%; height: 100%; display: block; object-fit: cover; transform: scale(1.08); transform-origin: center center; }
.rfp-tabName { margin-top: 6px; width: 100%; padding: 0 10px; text-align: center; font-weight: 700;
  line-height: 1.15; letter-spacing: 0.2px; color: var(--rfp-nameA); }
.rfp-tabNameLine { display: block; white-space: nowrap; overflow: visible; text-align: center; width: 100%; }
.rfp-tabDeg { margin-top: 2px; width: 100%; padding: 0 10px; text-align: center; font-weight: 600;
  line-height: 1.2; color: var(--rfp-nameB); }

.rfp-headline { position: absolute; top: 168px; left: 40px; }
.rfp-h1 { font-size: 26px; font-weight: 500; line-height: 1.35; color: var(--rfp-ink); }
.rfp-hA { margin-top: 10px !important; font-size: 35px; font-weight: 800; line-height: 1.4; color: var(--rfp-headA); letter-spacing: 0.2px; }
.rfp-hB { font-size: 35px; font-weight: 800; line-height: 1.4; color: var(--rfp-headB); letter-spacing: 0.2px; }

.rfp-list { position: absolute; top: 355px; left: 68px; margin: 0; padding: 0; list-style: none; }
.rfp-row { display: flex; align-items: center; height: 41px; }
.rfp-ring { width: 38px; height: 38px; border-radius: 50%; border: 2px solid var(--rfp-ring); background: #fff;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.rfp-ring svg { width: 26px; height: 26px; }
.rfp-label { margin-left: 11px; max-width: 165px; font-size: 16.5px; font-weight: 500; line-height: 1.25; color: var(--rfp-ink); }

.rfp-frame { position: absolute; top: 183px; left: 372px; width: 318px; height: 417px; padding: 18px;
  border-radius: 74px; background: #fff; border: 7px solid var(--rfp-frameBorder); z-index: 2; }
.rfp-frame img { width: 100%; height: 100%; object-fit: cover; border-radius: 54px; display: block; }

.rfp-barL { position: absolute; top: 646px; left: 0; width: 486px; height: 48px; background: var(--rfp-barL); color: #fff;
  font-weight: 600; display: flex; align-items: center; padding-left: 14px; white-space: nowrap; overflow: hidden; }
.rfp-barR { position: absolute; top: 646px; left: 486px; right: 0; height: 48px; background: var(--rfp-barR); color: #fff;
  display: flex; flex-direction: column; justify-content: center; align-items: flex-start;
  padding-left: 52px; padding-right: 6px; overflow: hidden; }
.rfp-barTall { top: 630px; height: 64px; }
.rfp-doc { font-weight: 700; line-height: 1.12; }
.rfp-docLine { display: block; white-space: nowrap; overflow: hidden; }
.rfp-phone { display: flex; align-items: center; margin-left: -28px; font-weight: 600; line-height: 1.15; white-space: nowrap; }
.rfp-phoneIcon { width: 22px; height: 22px; margin-right: 6px; flex-shrink: 0; }
`;

// ─── The component ───────────────────────────────────────────────────────────
const RiskFactorPoster = forwardRef(function RiskFactorPoster(
  {
    logo,
    doctorName = 'Dr. Doctor Name',
    doctorDegree = 'MBBS, MD',
    clinicName = 'Your Clinic Name',
    phone = '+91 00000 00000',
    theme = 'blue',
    logoFit = 'cover',
    photo = bpPhoto,
    id = 'risk-factor-poster',
  },
  ref
) {
  useFontsReady();

  // theme can be a name ('blue') or your own object with the same keys as above
  const t =
    typeof theme === 'object' && theme
      ? { ...RISK_POSTER_THEMES.blue, ...theme }
      : RISK_POSTER_THEMES[theme] || RISK_POSTER_THEMES.blue;

  const cssVars = {
    '--rfp-bg1': t.bg1, '--rfp-bg2': t.bg2, '--rfp-band': t.band, '--rfp-panel': t.panel,
    '--rfp-frameBorder': t.frameBorder, '--rfp-dotA': t.dotA, '--rfp-dotB': t.dotB,
    '--rfp-ink': t.ink, '--rfp-headA': t.headA, '--rfp-headB': t.headB, '--rfp-ring': t.ring,
    '--rfp-nameA': t.nameA, '--rfp-nameB': t.nameB, '--rfp-barL': t.barL, '--rfp-barR': t.barR,
  };

  const { line1: nameLine1, line2: nameLine2 } = splitDoctorName(doctorName);
  const nameWrapped = Boolean(nameLine2);
  const longestNameLine =
    nameWrapped && nameLine2.length > nameLine1.length ? nameLine2 : nameLine1;
  const nameFontSize = fitNameSize(longestNameLine);
  const barNameFontSize = fitSize(longestNameLine, nameWrapped ? 15 : 19, 9, 190, 700);
  const barClass = nameWrapped ? ' rfp-barTall' : '';

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap"
        rel="stylesheet"
      />
      <style>{CSS}</style>

      <div className="rfp" id={id} ref={ref} style={cssVars}>
        {/* fixed background artwork (colours come from the theme) */}
        <div className="rfp-band" />
        <div className="rfp-panel" />
        <div className="rfp-dot rfp-dot1" />
        <div className="rfp-dot rfp-dot2" />
        <div className="rfp-dot rfp-dot3" />
        <div className="rfp-dot rfp-dot4" />

        {/* PROP `logo` + PROP `doctorName` + PROP `doctorDegree` (top-left) */}
        <div className={`rfp-tab${nameWrapped ? ' rfp-tabTall' : ''}`}>
          <div className="rfp-logo">
            {logo && <img src={logo} alt="Logo" style={{ objectFit: logoFit }} />}
          </div>
          <div className="rfp-tabName" style={{ fontSize: `${nameFontSize}px` }}>
            <span className="rfp-tabNameLine">{nameLine1}</span>
            {nameWrapped ? <span className="rfp-tabNameLine">{nameLine2}</span> : null}
          </div>
          {doctorDegree && (
            <div className="rfp-tabDeg" style={{ fontSize: `${fitDegreeSize(doctorDegree)}px` }}>
              {doctorDegree}
            </div>
          )}
        </div>

        {/* fixed headline */}
        <div className="rfp-headline">
          <p className="rfp-h1">Unmasking the</p>
          <p className="rfp-h1">Silent Threat. Exploring</p>
          <p className="rfp-hA">HYPERTENSION&apos;S</p>
          <p className="rfp-hB">RISK FACTORS.</p>
        </div>

        {/* fixed risk-factor list */}
        <ul className="rfp-list">
          {RISK_FACTORS.map(({ label, Icon }) => (
            <li key={label} className="rfp-row">
              <span className="rfp-ring"><Icon /></span>
              <span className="rfp-label">{label}</span>
            </li>
          ))}
        </ul>

        {/* fixed photo (or your own via the `photo` prop) */}
        <div className="rfp-frame">
          <img src={photo} alt="Blood pressure check" />
        </div>

        {/* PROP `clinicName` (bottom-left bar) */}
        <div className={`rfp-barL${barClass}`}>
          <span style={{ fontSize: `${fitSize(clinicName, 30, 12, 456, 600)}px` }}>{clinicName}</span>
        </div>

        {/* PROP `doctorName` (wrapped) + PROP `phone` — bottom-right */}
        <div className={`rfp-barR${barClass}`}>
          <span className="rfp-doc" style={{ fontSize: `${barNameFontSize}px` }}>
            <span className="rfp-docLine">{nameLine1}</span>
            {nameWrapped ? <span className="rfp-docLine">{nameLine2}</span> : null}
          </span>
          <span className="rfp-phone">
            <IconPhone />
            <span style={{ fontSize: `${fitSize(phone, 22, 10, 188, 600)}px` }}>{phone}</span>
          </span>
        </div>
      </div>
    </>
  );
});

export default RiskFactorPoster;
