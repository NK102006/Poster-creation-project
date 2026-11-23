import styles from './MedicalAtmosphere.module.css';

/**
 * Soft medical motifs behind the UI — line art only, low opacity.
 * Decorative; ignored by assistive tech.
 */
export default function MedicalAtmosphere() {
  return (
    <div className={styles.root} aria-hidden="true">
      <div className={styles.glowPrimary} />
      <div className={styles.glowSecondary} />
      <div className={styles.vignette} />

      {/* Large stethoscope — bottom right */}
      <svg
        className={`${styles.motif} ${styles.stethoscope}`}
        viewBox="0 0 280 340"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Earpieces */}
        <circle cx="72" cy="36" r="14" stroke="currentColor" strokeWidth="2.4" />
        <circle cx="148" cy="36" r="14" stroke="currentColor" strokeWidth="2.4" />
        {/* Tubing */}
        <path
          d="M72 50c0 46 10 72 38 96"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <path
          d="M148 50c0 46-10 72-38 96"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <path
          d="M110 146c0 48 22 84 58 112"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        {/* Chest piece */}
        <circle cx="188" cy="278" r="38" stroke="currentColor" strokeWidth="2.4" />
        <circle cx="188" cy="278" r="18" stroke="currentColor" strokeWidth="1.8" opacity="0.75" />
        <circle cx="188" cy="278" r="5" fill="currentColor" opacity="0.45" />
      </svg>

      {/* ECG / pulse ribbon — top left */}
      <svg
        className={`${styles.motif} ${styles.pulse}`}
        viewBox="0 0 520 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          className={styles.pulsePath}
          d="M8 68h72l18-36 22 72 28-92 26 78 16-22h88l14-28 20 56 18-40 12 24h120"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {/* Soft medical cross — mid left */}
      <svg
        className={`${styles.motif} ${styles.cross}`}
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect
          x="48"
          y="18"
          width="24"
          height="84"
          rx="6"
          stroke="currentColor"
          strokeWidth="2"
        />
        <rect
          x="18"
          y="48"
          width="84"
          height="24"
          rx="6"
          stroke="currentColor"
          strokeWidth="2"
        />
      </svg>

      {/* Small capsule — upper right */}
      <svg
        className={`${styles.motif} ${styles.capsule}`}
        viewBox="0 0 140 60"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect
          x="8"
          y="10"
          width="124"
          height="40"
          rx="20"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path
          d="M70 10v40"
          stroke="currentColor"
          strokeWidth="1.5"
          opacity="0.65"
        />
      </svg>
    </div>
  );
}
