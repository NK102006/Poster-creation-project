import styles from './StudioShell.module.css';

export default function StudioShell({
  user,
  userLabel = 'Employee',
  onLogout,
  children,
  onBrandClick,
  onBack = null,
  backLabel = 'Back',
  headerActions = null,
  subheaderActions = null,
  subheaderExtra = null,
  wide = false,
}) {
  const showSubheader = Boolean(onBack || subheaderActions || subheaderExtra);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
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
        </div>
        <div className={styles.userNav}>
          {headerActions}
          <div className={styles.userBadge}>
            <span className={styles.statusDot} />
            <span>{userLabel}{user?.empid ? ` ${user.empid}` : ''}</span>
          </div>
          <button type="button" className={styles.logoutBtn} onClick={onLogout} id="logout-button">
            Sign out
          </button>
        </div>
      </header>
      {showSubheader ? (
        <div className={`${styles.subheader} ${wide ? styles.subheaderWide : ''}`}>
          <div className={styles.subheaderLeft}>
            {onBack ? (
              <button type="button" className={styles.headerBack} onClick={onBack}>
                ← {backLabel}
              </button>
            ) : null}
            {subheaderExtra}
          </div>
          {subheaderActions ? (
            <div className={styles.subheaderRight}>{subheaderActions}</div>
          ) : null}
        </div>
      ) : null}
      <main className={`${styles.main} ${wide ? styles.mainWide : ''}`}>{children}</main>
    </div>
  );
}
