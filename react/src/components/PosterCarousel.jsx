import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { mapThemeToRiskFactor, themePageStyle } from '../lib/posterExport';
import { apiRequest } from '../lib/apiClient';
import RiskFactorPoster from './RiskFactorPoster';
import styles from './PosterCarousel.module.css';

function posterLabel(poster) {
  return poster.label || 'Poster';
}

function posterSendLabel(index) {
  return `Day ${index + 1}`;
}

function ScaledRiskFactorPoster({
  isCaptureTarget,
  theme,
  doctorFields,
}) {
  const hostRef = useRef(null);
  const [scale, setScale] = useState(0.35);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const measure = () => {
      const { width, height } = host.getBoundingClientRect();
      if (width < 1 || height < 1) return;
      setScale(Math.min(width, height) / 736);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  const riskTheme = mapThemeToRiskFactor(theme?.id);

  return (
    <div ref={hostRef} className={styles.componentFit}>
      <div
        className={styles.componentScaler}
        style={{ transform: `translate(-50%, -50%) scale(${scale})` }}
      >
        <RiskFactorPoster
          logo={doctorFields.logo}
          doctorName={doctorFields.doctorName}
          doctorDegree={doctorFields.doctorDegree}
          clinicName={doctorFields.clinicName}
          phone={doctorFields.phone}
          theme={riskTheme}
          id={isCaptureTarget ? 'risk-factor-poster' : undefined}
        />
      </div>
    </div>
  );
}

export function PosterPage({
  poster,
  label,
  pageStyle,
  isCaptureTarget,
  theme,
  doctorFields,
}) {
  if (poster.template === 'risk-factor') {
    return (
      <div
        className={`${styles.blankPage} ${styles.componentPage}`}
        style={pageStyle}
        id={isCaptureTarget ? 'doctor-poster-capture' : undefined}
      >
        <ScaledRiskFactorPoster
          isCaptureTarget={isCaptureTarget}
          theme={theme}
          doctorFields={doctorFields}
        />
      </div>
    );
  }

  if (poster.kind === 'video') {
    return (
      <div
        className={`${styles.blankPage} ${styles.componentPage}`}
        style={{ ...pageStyle, background: '#000' }}
        id={isCaptureTarget ? 'doctor-poster-capture' : undefined}
      >
        <video
          src={poster.videoUrl}
          autoPlay
          loop
          muted
          playsInline
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <span className={styles.blankLabel} style={{ position: 'absolute', bottom: 10, right: 10, color: 'rgba(255,255,255,0.7)' }}>{label}</span>
      </div>
    );
  }

  if (poster.kind === 'master') {
    return (
      <div
        className={`${styles.blankPage} ${styles.componentPage}`}
        style={{ ...pageStyle, padding: 0, overflow: 'hidden' }}
        id={isCaptureTarget ? 'doctor-poster-capture' : undefined}
      >
        <img
          src={poster.image.startsWith('http') ? poster.image : '/' + poster.image}
          alt={label}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          crossOrigin="anonymous"
        />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '10px', background: 'rgba(255,255,255,0.85)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          {doctorFields.logo && <img src={doctorFields.logo} alt="Logo" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />}
          <div>
            <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#000' }}>{doctorFields.doctorName}</div>
            <div style={{ fontSize: '10px', color: '#555' }}>{doctorFields.doctorDegree} | {doctorFields.clinicName}</div>
            <div style={{ fontSize: '10px', color: '#555' }}>{doctorFields.phone}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={styles.blankPage}
      style={pageStyle}
      id={isCaptureTarget ? 'doctor-poster-capture' : undefined}
    >
      <span className={styles.blankSheen} aria-hidden="true" />
      <span className={styles.blankLabel}>{label}</span>
    </div>
  );
}

function Dropdowns({
  festival,
  slides,
  safeIndex,
  generalPosters,
  generalSelectValue,
  onFestivalChange,
  onGeneralChange,
}) {
  return (
    <div className={styles.dropdowns}>
      <label className={styles.dropdownField}>
        <span className={styles.dropdownLabel}>Festival</span>
        <select
          className={styles.dropdown}
          value={slides[safeIndex]?.kind === 'festival' && festival ? festival.id : ''}
          onChange={onFestivalChange}
          disabled={!festival}
        >
          {!festival && <option value="">No festival this month</option>}
          {festival && (
            <>
              <option value="" disabled>
                Choose festival
              </option>
              <option value={festival.id}>{festival.festivalName}</option>
            </>
          )}
        </select>
      </label>

      <label className={styles.dropdownField}>
        <span className={styles.dropdownLabel}>General</span>
        <select
          className={styles.dropdown}
          value={generalSelectValue}
          onChange={onGeneralChange}
        >
          <option value="" disabled>
            Choose poster
          </option>
          {generalPosters.map((poster, index) => (
            <option key={poster.id} value={String(index)}>
              Poster-{index + 1}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function ScrollView({
  slides,
  safeIndex,
  goTo,
  pageStyle,
  theme,
  doctorFields,
}) {
  const viewportRef = useRef(null);
  const [stageWidth, setStageWidth] = useState(0);
  const [slideWidth, setSlideWidth] = useState(280);
  const animLock = useRef(false);
  const indexRef = useRef(safeIndex);
  indexRef.current = safeIndex;
  const gap = 20;

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;
    const measure = () => {
      const width = viewport.clientWidth;
      setStageWidth(width);
      setSlideWidth(Math.min(300, Math.max(210, width * 0.4)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  const lockedGoTo = useCallback(
    (index) => {
      const next = Math.max(0, Math.min(slides.length - 1, index));
      if (next === indexRef.current || animLock.current) return;
      animLock.current = true;
      goTo(next);
      window.setTimeout(() => {
        animLock.current = false;
      }, 520);
    },
    [goTo, slides.length]
  );

  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName;
      if (tag === 'SELECT' || tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        lockedGoTo(indexRef.current - 1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        lockedGoTo(indexRef.current + 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lockedGoTo]);

  const trackOffset =
    stageWidth > 0
      ? stageWidth / 2 - slideWidth / 2 - safeIndex * (slideWidth + gap)
      : 0;

  const active = slides[safeIndex];
  const sendLabel = active
    ? posterSendLabel(safeIndex)
    : '';

  return (
    <>
      <p className={styles.keyHint}>Use ← → keys or arrows to slide</p>

      <div
        className={styles.scrollStage}
        style={{
          '--slide-w': `${slideWidth}px`,
          '--slide-gap': `${gap}px`,
          '--carousel-accent': theme?.accentColor || '#4a9fd4',
        }}
      >
        <button
          type="button"
          className={`${styles.arrow} ${styles.arrowLeft}`}
          onClick={() => lockedGoTo(safeIndex - 1)}
          disabled={safeIndex <= 0}
          aria-label="Previous poster"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M15 5L8 12l7 7"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <div className={styles.scrollViewport} ref={viewportRef}>
          <div className={styles.fadeLeft} aria-hidden="true" />
          <div className={styles.fadeRight} aria-hidden="true" />
          <div
            className={styles.scrollTrack}
            style={{ transform: `translate3d(${trackOffset}px, 0, 0)` }}
          >
            {slides.map((poster, index) => {
              const distance = Math.abs(index - safeIndex);
              const sideClass =
                distance === 0
                  ? styles.slideActive
                  : distance === 1
                    ? styles.slideNear
                    : styles.slideFar;
              const label = posterLabel(poster);

              return (
                <button
                  key={poster.id}
                  type="button"
                  className={`${styles.scrollSlide} ${sideClass}`}
                  onClick={(e) => {
                    lockedGoTo(index);
                    if (onPosterClick) {
                      const rect = e.currentTarget.getBoundingClientRect();
                      onPosterClick(poster, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
                    }
                  }}
                  aria-label={label}
                  aria-current={distance === 0 ? 'true' : undefined}
                >
                  <PosterPage
                    poster={poster}
                    label={label}
                    pageStyle={pageStyle}
                    isCaptureTarget={distance === 0}
                    theme={theme}
                    doctorFields={doctorFields}
                  />
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          className={`${styles.arrow} ${styles.arrowRight}`}
          onClick={() => lockedGoTo(safeIndex + 1)}
          disabled={safeIndex >= slides.length - 1}
          aria-label="Next poster"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M9 5l7 7-7 7"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      <div className={styles.scrollSendBar}>
        <span className={styles.scrollSendLabel}>Send to doctor</span>
        <strong className={styles.scrollSendValue}>{sendLabel}</strong>
      </div>

      <div className={styles.dots} role="tablist" aria-label="Poster pages">
        {slides.map((poster, index) => (
          <button
            key={poster.id}
            type="button"
            role="tab"
            aria-selected={index === safeIndex}
            className={`${styles.dot} ${index === safeIndex ? styles.dotActive : ''}`}
            onClick={() => lockedGoTo(index)}
            aria-label={`Go to ${posterLabel(poster)}`}
          />
        ))}
      </div>
    </>
  );
}

export default function PosterCarousel({
  activeIndex = 0,
  onIndexChange,
  theme,
  variant = 'grid',
  onPosterClick,
  onSlidesChange,
  doctorFields = {
    clinicName: '',
    doctorName: '',
    doctorDegree: '',
    phone: '',
    logo: null,
  },
}) {
  const [filter, setFilter] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [masterPosters, setMasterPosters] = useState([]);

  useEffect(() => {
    const fetchMasterPosters = async () => {
      try {
        const query = selectedMonth ? `?month=${selectedMonth}` : '';
        const res = await apiRequest(`/posters${query}`);
        if (res.posters) {
          setMasterPosters(res.posters.map((p, idx) => ({
            id: p._id,
            kind: 'master',
            image: p.posterlink,
            category: p.category,
            month: p.month,
            color: p.color,
            label: `Poster-${idx + 1}`
          })));
        }
      } catch (err) {
        console.error('Error fetching master posters:', err);
      }
    };
    fetchMasterPosters();
  }, [selectedMonth]);

  const slides = useMemo(() => {
    let combined = [...masterPosters];

    if (filter === 'festivals') {
      return combined.filter(p => p.category?.toLowerCase().includes('festival'));
    }
    if (filter === 'videos') {
      return combined.filter(p => p.category?.toLowerCase().includes('video'));
    }
    if (filter === 'education') {
      return combined.filter(p => p.category?.toLowerCase().includes('education') || p.category?.toLowerCase().includes('gk'));
    }
    if (theme) {
      const themeStr = `${theme.id} ${theme.name}`.toLowerCase();
      combined = combined.filter(p => {
        if (!p.color || p.color.trim() === '') return true; // Show for all if no color
        const c = p.color.toLowerCase().trim();
        return themeStr.includes(c) || c.includes(themeStr);
      });
    }

    return combined;
  }, [filter, masterPosters, theme]);

  useEffect(() => {
    if (onSlidesChange) {
      onSlidesChange(slides);
    }
  }, [slides, onSlidesChange]);

  const safeIndex = Math.max(0, Math.min(activeIndex, Math.max(slides.length - 1, 0)));
  const pageStyle = themePageStyle(theme);

  const goTo = useCallback(
    (index) => {
      onIndexChange?.(index);
    },
    [onIndexChange]
  );

  return (
    <div className={styles.carousel}>
      <div className={styles.categoryRow}>
        {[
          { id: 'all', label: 'All Categories' },
          { id: 'education', label: 'Education' },
          { id: 'festivals', label: 'Festivals' },
          { id: 'videos', label: 'Videos' }
        ].map(cat => (
          <button
            key={cat.id}
            type="button"
            className={`${styles.categoryBtn} ${filter === cat.id ? styles.categoryBtnActive : ''}`}
            onClick={() => {
              setFilter(cat.id);
              onIndexChange?.(0);
            }}
          >
            {cat.label}
          </button>
        ))}
      </div>
      
      <div className={styles.categoryRow} style={{ justifyContent: 'flex-end' }}>
        <select 
          className={`${styles.categoryBtn} ${styles.monthSelect}`}
          value={selectedMonth}
          onChange={(e) => {
            setSelectedMonth(e.target.value);
            onIndexChange?.(0);
          }}
          style={{ outline: 'none' }}
        >
          <option value="" style={{ color: '#000' }}>Select</option>
          {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(m => (
            <option key={m} value={m} style={{ color: '#000' }}>{m}</option>
          ))}
        </select>
      </div>



      {slides.length === 0 ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--color-text-muted)', background: 'linear-gradient(180deg, #f4f9fc 0%, var(--color-surface) 100%)', borderRadius: 16, border: '1px solid rgba(31, 111, 159, 0.14)' }}>
          No previews available in this category yet.
        </div>
      ) : variant === 'scroll' ? (
        <ScrollView
          slides={slides}
          safeIndex={safeIndex}
          goTo={goTo}
          pageStyle={pageStyle}
          theme={theme}
          doctorFields={doctorFields}
        />
      ) : (
        <div className={styles.posterGridBox}>
          {slides.map((poster, index) => {
            const label = posterLabel(poster);
            const sendLabel = posterSendLabel(index);
            const isActive = index === safeIndex;

            return (
              <button
                key={poster.id}
                type="button"
                className={`${styles.gridCard} ${isActive ? styles.gridCardActive : ''}`}
                onClick={(e) => {
                  goTo(index);
                  if (onPosterClick) {
                    const rect = e.currentTarget.getBoundingClientRect();
                    onPosterClick(poster, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
                  }
                }}
                aria-label={label}
                aria-current={isActive ? 'true' : undefined}
              >
                <PosterPage
                  poster={poster}
                  label={label}
                  pageStyle={pageStyle}
                  isCaptureTarget={isActive}
                  theme={theme}
                  doctorFields={doctorFields}
                />
                <p className={styles.sendDate}>
                  Send <strong>{sendLabel}</strong>
                </p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
