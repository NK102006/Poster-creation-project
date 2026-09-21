import styles from './StudioShell.module.css';

export default function StudioShell({
  userLabel = 'Employee',
  onLogout,
  children,
  onBrandClick,
  headerActions = null,
}) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button type="button" className={styles.brandGroup} onClick={onBrandClick}>
          <div className={styles.logoIcon} aria-hidden="true">
            <svg viewBox="0 0 24 24" className={styles.logoMark} fill="none">
              <path
                d="M12 4.5v15M4.5 12h15"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <span className={styles.brandName}>MedPortal</span>
        </button>
        <div className={styles.userNav}>
          {headerActions}
          <div className={styles.userBadge}>
            <span className={styles.statusDot} />
            <span>{userLabel}</span>
          </div>
          <button type="button" className={styles.logoutBtn} onClick={onLogout} id="logout-button">
            Sign out
          </button>
        </div>
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
