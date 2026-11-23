import styles from './AdminPortal.module.css';

export default function StaffLogin({
  mark = 'M',
  subtitle,
  error,
  username,
  password,
  onUsername,
  onPassword,
  onSubmit,
  usernameLabel = 'Username',
  fieldErrors = {},
  disableAutofill = false,
}) {
  return (
    <div className={styles.loginPage}>
      <form onSubmit={onSubmit} className={styles.loginCard} noValidate autoComplete={disableAutofill ? 'off' : undefined}>
        <div className={styles.loginBrand}>
          <div className={styles.brandMark}>{mark}</div>
          <div>
            <div className={styles.brandName}>MedPortal</div>
            <div className={styles.brandSub}>{subtitle}</div>
          </div>
        </div>
        <h1 className={styles.loginTitle}>Sign in</h1>
        {error && <p className={styles.error}>{error}</p>}
        {disableAutofill && (
          <>
            <input type="text" name="fake-username" autoComplete="username" tabIndex={-1} aria-hidden="true" style={{ position: 'absolute', opacity: 0, height: 0, width: 0, pointerEvents: 'none' }} />
            <input type="password" name="fake-password" autoComplete="current-password" tabIndex={-1} aria-hidden="true" style={{ position: 'absolute', opacity: 0, height: 0, width: 0, pointerEvents: 'none' }} />
          </>
        )}
        <label className={styles.field}>
          <span>{usernameLabel}</span>
          <input
            value={username}
            name={disableAutofill ? 'sa-username' : undefined}
            autoComplete={disableAutofill ? 'off' : 'username'}
            onChange={(event) => onUsername(event.target.value.replace(/\s/g, ''))}
          />
          {fieldErrors.username && <span className={styles.fieldError}>{fieldErrors.username}</span>}
        </label>
        <label className={styles.field}>
          <span>Password</span>
          <input
            type="password"
            value={password}
            name={disableAutofill ? 'sa-password' : undefined}
            autoComplete={disableAutofill ? 'off' : 'current-password'}
            onChange={(event) => onPassword(event.target.value.replace(/\s/g, ''))}
          />
          {fieldErrors.password && <span className={styles.fieldError}>{fieldErrors.password}</span>}
        </label>
        <button type="submit" className={styles.primaryBtn}>
          Login
        </button>
      </form>
    </div>
  );
}
