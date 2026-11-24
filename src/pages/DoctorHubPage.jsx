import { useEffect, useMemo, useRef, useState } from 'react';
import StudioShell from '../components/StudioShell';
import { apiRequest } from '../lib/apiClient';
import { upcomingHealthDays } from '../lib/healthDays';
import styles from './DoctorHubPage.module.css';

const HEART_PATH =
  'M12 21s-7.5-4.6-9.5-9.2C1 8.2 3.4 4.5 7 4.5c2.1 0 3.6 1.1 5 3 1.4-1.9 2.9-3 5-3 3.6 0 6 3.7 4.5 7.3C19.5 16.4 12 21 12 21z';

const AVATAR_TONES = [styles.toneRed, styles.toneMint, styles.toneViolet];

function greeting(date) {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function initials(name = '') {
  const parts = name.replace(/^dr\.?\s+/i, '').trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] || '') + (parts[1]?.[0] || '') || 'Dr';
}

function HeartIcon({ size = 14, color = '#e5484d' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true">
      <path d={HEART_PATH} />
    </svg>
  );
}

function DoctorIllustration() {
  return (
    <svg className={styles.doctorArt} viewBox="0 0 270 300" aria-hidden="true">
      <path d="M35 300c0-62 30-96 100-100 70 4 100 38 100 100z" fill="#fff" stroke="#d3e6f1" strokeWidth="2" />
      <path d="M105 202l30 52 30-52z" fill="#1fa39a" />
      <path d="M105 202l30 52-22 46H95z" fill="#f3f9fc" stroke="#d3e6f1" strokeWidth="2" />
      <path d="M165 202l-30 52 22 46h18z" fill="#f3f9fc" stroke="#d3e6f1" strokeWidth="2" />
      <path d="M118 168h34v38l-17 14-17-14z" fill="#e8b48f" />
      <ellipse cx="135" cy="130" rx="42" ry="48" fill="#f2c4a0" />
      <path d="M92 128c-4-44 22-66 46-66 30 0 50 20 46 62-6-18-16-30-30-34-18 10-42 14-62 38z" fill="#2b2f3a" />
      <path d="M92 124c-6 30-2 56 6 70 4-20 2-44-6-70zM178 124c6 30 2 56-6 70-4-20-2-44 6-70z" fill="#2b2f3a" />
      <ellipse cx="94" cy="134" rx="6" ry="10" fill="#e8b48f" />
      <ellipse cx="176" cy="134" rx="6" ry="10" fill="#e8b48f" />
      <ellipse cx="119" cy="134" rx="4" ry="5" fill="#2b2f3a" />
      <ellipse cx="151" cy="134" rx="4" ry="5" fill="#2b2f3a" />
      <path d="M113 122q6-4 12 0M145 122q6-4 12 0" stroke="#2b2f3a" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <path d="M122 155q13 11 26 0" stroke="#b55d4c" strokeWidth="3" fill="none" strokeLinecap="round" />
      <ellipse cx="109" cy="148" rx="7" ry="4" fill="#f1a08a" opacity=".5" />
      <ellipse cx="161" cy="148" rx="7" ry="4" fill="#f1a08a" opacity=".5" />
      <path d="M108 206c-10 30-8 52 8 62M162 206c10 30 8 52-8 62" stroke="#1f6f9f" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M116 268c8 8 30 8 38 0" stroke="#1f6f9f" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M135 274v12" stroke="#1f6f9f" strokeWidth="4" strokeLinecap="round" />
      <circle cx="135" cy="292" r="9" fill="#9cc7e2" stroke="#1f6f9f" strokeWidth="3" />
      <rect x="178" y="250" width="30" height="26" rx="4" fill="#f3f9fc" stroke="#d3e6f1" strokeWidth="2" />
      <rect x="186" y="238" width="5" height="18" rx="2" fill="#e5484d" />
      <rect x="64" y="252" width="26" height="32" rx="4" fill="#e3f1fa" stroke="#4a9fd4" strokeWidth="2" />
      <path d="M77 260v12M71 266h12" stroke="#e5484d" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function PosterPreview({ className, kicker, title, doctor, role, art }) {
  return (
    <div className={`${styles.poster} ${className}`}>
      <div className={styles.posterKicker}>{kicker}</div>
      <div className={styles.posterTitle}>{title}</div>
      <div className={styles.posterArt}>{art}</div>
      <div className={styles.posterDoc}>
        <span className={styles.posterAvatar} />
        <span>
          <b>{doctor}</b>
          <small>{role}</small>
        </span>
      </div>
    </div>
  );
}

export default function DoctorHubPage({
  user,
  onLogout,
  onAddNew,
  onAccessExisting,
  onSelectDoctor,
  onBrandClick,
}) {
  const now = useMemo(() => new Date(), []);
  const healthDays = useMemo(() => upcomingHealthDays(10, now), [now]);
  const [recent, setRecent] = useState([]);
  const [totalDoctors, setTotalDoctors] = useState(null);
  const daysRef = useRef(null);
  const [daysEdge, setDaysEdge] = useState({ start: true, end: true });

  // Track whether the events strip can scroll further left / right.
  const updateDaysEdge = () => {
    const el = daysRef.current;
    if (!el) return;
    setDaysEdge({
      start: el.scrollLeft <= 2,
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2,
    });
  };

  useEffect(() => {
    const el = daysRef.current;
    if (!el) return undefined;
    updateDaysEdge();
    // Let a normal mouse wheel scroll the strip sideways.
    const onWheel = (e) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      if (el.scrollWidth <= el.clientWidth) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('resize', updateDaysEdge);
    return () => {
      el.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', updateDaysEdge);
    };
  }, []);

  const scrollDays = (dir) => {
    const el = daysRef.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  };

  useEffect(() => {
    const controller = new AbortController();
    apiRequest('/doctors?page=1&limit=3', { signal: controller.signal })
      .then((res) => {
        setRecent(res?.doctors || []);
        setTotalDoctors(res?.total ?? null);
      })
      .catch(() => {
        // The welcome page still works without the recent list.
      });
    return () => controller.abort();
  }, []);

  const dateLabel = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });

  return (
    <StudioShell user={user} onLogout={onLogout} onBrandClick={onBrandClick}>
      <section className={styles.hero}>
        <div className={styles.heroText}>
          <div className={styles.pill}>
            <span className={styles.pillIcon}><HeartIcon size={13} /></span>
            {greeting(now)} · {dateLabel}
          </div>
          <h1 className={styles.title}>
            Help doctors spread <em>health awareness</em>
          </h1>
          <p className={styles.subtitle}>
            Create personalised health posters for your doctors to share with their patients on
            WhatsApp, Instagram and Facebook.
          </p>
          <svg className={styles.ecg} viewBox="0 0 470 34" fill="none" aria-hidden="true">
            <path
              d="M0 18h150l10-12 12 26 14-30 12 24 8-8h264"
              stroke="url(#hubEcg)"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <defs>
              <linearGradient id="hubEcg" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="470" y2="0">
                <stop stopColor="#1fa39a" />
                <stop offset=".45" stopColor="#e5484d" />
                <stop offset="1" stopColor="#4a9fd4" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        <div className={styles.figure} aria-hidden="true">
          <DoctorIllustration />
          <div className={`${styles.chip} ${styles.chipTop}`}>
            <i className={styles.toneRed}><HeartIcon size={15} /></i>
            <div>Cardiology<small>Heart health tips</small></div>
          </div>
          <div className={`${styles.chip} ${styles.chipRight}`}>
            <i className={styles.toneMint}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#137a73" strokeWidth="2.2" strokeLinecap="round"><path d="M12 3v18M3 12h18" /></svg>
            </i>
            {totalDoctors != null ? (
              <div>{totalDoctors} {totalDoctors === 1 ? 'doctor' : 'doctors'}<small>registered</small></div>
            ) : (
              <div>Social-ready<small>posters in minutes</small></div>
            )}
          </div>
          <div className={`${styles.chip} ${styles.chipLeft}`}>
            <i className={styles.toneBlue}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1f6f9f" strokeWidth="2"><rect x="4" y="8" width="16" height="8" rx="4" transform="rotate(-35 12 12)" /></svg>
            </i>
            <div>Diabetes<small>Awareness week</small></div>
          </div>
        </div>
      </section>

      <div className={styles.choiceGrid}>
        <button type="button" className={`${styles.card} ${styles.cardNew}`} onClick={onAddNew}>
          <span className={styles.cardInfo}>
            <span className={`${styles.cardIcon} ${styles.toneMint}`}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#137a73" strokeWidth="2" strokeLinecap="round"><circle cx="9" cy="7" r="4" /><path d="M2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1" /><path d="M19 8v6M16 11h6" /></svg>
            </span>
            <span className={styles.cardTitle}>Add new doctor</span>
            <span className={styles.cardText}>
              Enter the doctor’s name, photo, clinic and specialty, then create their posters.
            </span>
            <span className={`${styles.cta} ${styles.ctaTeal}`}>Register doctor <span aria-hidden="true">→</span></span>
          </span>
          <span className={styles.posters} aria-hidden="true">
            <PosterPreview
              className={styles.posterRed}
              kicker="29 SEPT"
              title="World Heart Day"
              doctor="Dr. Riya Shah"
              role="Cardiologist"
              art={
                <svg width="54" height="50" viewBox="0 0 24 22">
                  <path d={HEART_PATH} fill="#fff" opacity=".95" />
                  <path d="M4 12h5l1.5-3 2 6 1.5-3h6" stroke="#e5484d" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              }
            />
            <PosterPreview
              className={styles.posterTeal}
              kicker="14 NOV"
              title="World Diabetes Day"
              doctor="Dr. Arjun Mehta"
              role="Diabetologist"
              art={
                <svg width="50" height="50" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="9" fill="none" stroke="#fff" strokeWidth="2.6" />
                  <path d="M12 7c2.5 3 3.5 4.6 3.5 6.2a3.5 3.5 0 0 1-7 0C8.5 11.6 9.5 10 12 7z" fill="#fff" />
                </svg>
              }
            />
          </span>
        </button>

        <div className={`${styles.card} ${styles.cardExisting}`}>
          <div className={styles.cardInfo}>
            <span className={`${styles.cardIcon} ${styles.toneBlue}`}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#1f6f9f" strokeWidth="2" strokeLinecap="round"><path d="M6 3v6a4 4 0 0 0 8 0V3" /><path d="M10 13v2a5 5 0 0 0 10 0v-2" /><circle cx="20" cy="11" r="2" /></svg>
            </span>
            <h2 className={styles.cardTitle}>My doctors</h2>
            <p className={styles.cardText}>
              Open a saved doctor to update their details or download their posters again.
            </p>
            <button type="button" className={`${styles.cta} ${styles.ctaBlue}`} onClick={onAccessExisting}>
              View doctors <span aria-hidden="true">→</span>
            </button>
          </div>

          <div className={styles.docList}>
            {recent.length > 0 ? (
              recent.map((doc, i) => (
                <button
                  key={doc.id}
                  type="button"
                  className={styles.docRow}
                  onClick={() => (onSelectDoctor ? onSelectDoctor(doc) : onAccessExisting())}
                >
                  <span className={`${styles.docAvatar} ${AVATAR_TONES[i % AVATAR_TONES.length]}`}>
                    {initials(doc.name)}
                  </span>
                  <span className={styles.docBody}>
                    <b>{doc.name}</b>
                    <small>{doc.doctorDegree || doc.clinicName || 'Doctor'}</small>
                  </span>
                  <span className={styles.docCount} title="Posters made">{doc.postersMade || 0}</span>
                </button>
              ))
            ) : (
              <div className={styles.docEmpty}>
                <HeartIcon size={18} color="#4a9fd4" />
                <span>Doctors you add will appear here.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={styles.days}>
        <div className={styles.daysLabel}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1f6f9f" strokeWidth="2" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
          Upcoming health days
        </div>
        <div
          className={`${styles.daysScroller} ${daysEdge.start ? '' : styles.fadeStart} ${daysEdge.end ? '' : styles.fadeEnd}`}
        >
          <div ref={daysRef} className={styles.daysList} onScroll={updateDaysEdge}>
            {healthDays.map((d) => (
              <div key={d.name} className={styles.day}>
                <i className={styles[`tone${d.tone[0].toUpperCase()}${d.tone.slice(1)}`]} aria-hidden="true">{d.icon}</i>
                {d.name} <small>· {d.label}</small>
              </div>
            ))}
          </div>
        </div>
        <div className={styles.daysNav}>
          <button type="button" aria-label="Previous health days" disabled={daysEdge.start} onClick={() => scrollDays(-1)}>‹</button>
          <button type="button" aria-label="More health days" disabled={daysEdge.end} onClick={() => scrollDays(1)}>›</button>
        </div>
      </div>
    </StudioShell>
  );
}
