import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getActiveFestival, getGeneralPosters, getMonthlyPosters } from '../lib/posterCatalog';
import { mapThemeToRiskFactor, themePageStyle } from '../lib/posterExport';
import { getPosterTiming, getSendDateForIndex } from '../lib/posterSchedule';
import RiskFactorPoster from './RiskFactorPoster';
import styles from './PosterCarousel.module.css';

function posterLabel(poster, generalPosters) {
  if (poster.kind === 'festival') return poster.festivalName || 'Festival';
  const gIdx = Math.max(0, generalPosters.findIndex((p) => p.id === poster.id));
  return `Poster-${gIdx + 1}`;
}

function posterSendLabel(poster, index, total) {
  if (poster.kind === 'festival') {
    return getPosterTiming({ mode: 'festival' }).sendLabel;
  }
  return getSendDateForIndex(index, total);
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

function PosterPage({
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
  generalPosters,
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
    ? posterSendLabel(active, safeIndex, slides.length)
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
              const label = posterLabel(poster, generalPosters);

              return (
                <button
                  key={poster.id}
                  type="button"
                  className={`${styles.scrollSlide} ${sideClass}`}
                  onClick={() => lockedGoTo(index)}
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
            aria-label={`Go to ${posterLabel(poster, generalPosters)}`}
          />
        ))}
      </div>
    </>
  );
}

export default function PosterCarousel({
  activeIndex = 0,
  onIndexChange,
  mode = 'general',
  onModeChange,
  theme,
  variant = 'grid',
  doctorFields = {
    clinicName: '',
    doctorName: '',
    doctorDegree: '',
    phone: '',
    logo: null,
  },
}) {
  const festival = useMemo(() => getActiveFestival(new Date()), []);
  const generalPosters = useMemo(() => getGeneralPosters(), []);
  const monthlyPosters = useMemo(() => getMonthlyPosters(new Date()), []);

  const slides = monthlyPosters;
  const safeIndex = Math.max(0, Math.min(activeIndex, Math.max(slides.length - 1, 0)));
  const pageStyle = themePageStyle(theme);

  const handleFestivalChange = (e) => {
    const value = e.target.value;
    if (!value) return;
    onModeChange?.('festival');
    const festIndex = slides.findIndex((p) => p.kind === 'festival');
    onIndexChange?.(festIndex >= 0 ? festIndex : 0);
  };

  const handleGeneralChange = (e) => {
    const value = e.target.value;
    if (value === '') return;
    const idx = Number(value);
    onModeChange?.('general');
    const targetId = generalPosters[idx]?.id;
    const packIndex = slides.findIndex((p) => p.id === targetId);
    onIndexChange?.(packIndex >= 0 ? packIndex : idx);
  };

  const goTo = useCallback(
    (index) => {
      const poster = slides[index];
      if (!poster) return;
      onModeChange?.(poster.kind === 'festival' ? 'festival' : 'general');
      onIndexChange?.(index);
    },
    [onIndexChange, onModeChange, slides]
  );

  const generalSelectValue = (() => {
    const current = slides[safeIndex];
    if (!current || current.kind === 'festival') return '';
    const gIdx = generalPosters.findIndex((p) => p.id === current.id);
    return gIdx >= 0 ? String(gIdx) : '';
  })();

  return (
    <div className={styles.carousel}>
      <Dropdowns
        festival={festival}
        slides={slides}
        safeIndex={safeIndex}
        generalPosters={generalPosters}
        generalSelectValue={generalSelectValue}
        onFestivalChange={handleFestivalChange}
        onGeneralChange={handleGeneralChange}
      />

      {variant === 'scroll' ? (
        <ScrollView
          slides={slides}
          safeIndex={safeIndex}
          goTo={goTo}
          pageStyle={pageStyle}
          generalPosters={generalPosters}
          theme={theme}
          doctorFields={doctorFields}
        />
      ) : (
        <div className={styles.posterGridBox}>
          {slides.map((poster, index) => {
            const label = posterLabel(poster, generalPosters);
            const sendLabel = posterSendLabel(poster, index, slides.length);
            const isActive = index === safeIndex;

            return (
              <button
                key={poster.id}
                type="button"
                className={`${styles.gridCard} ${isActive ? styles.gridCardActive : ''}`}
                onClick={() => goTo(index)}
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
