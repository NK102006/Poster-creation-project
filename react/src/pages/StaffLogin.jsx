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
}) {
  return (
    <div className={styles.loginPage}>
      <form onSubmit={onSubmit} className={styles.loginCard}>
        <div className={styles.loginBrand}>
          <div className={styles.brandMark}>{mark}</div>
          <div>
            <div className={styles.brandName}>MedPortal</div>
            <div className={styles.brandSub}>{subtitle}</div>
          </div>
        </div>
        <h1 className={styles.loginTitle}>Sign in</h1>
        {error && <p className={styles.error}>{error}</p>}
        <label className={styles.field}>
          <span>{usernameLabel}</span>
          <input value={username} onChange={(event) => onUsername(event.target.value)} />
          {fieldErrors.username && <span className={styles.fieldError}>{fieldErrors.username}</span>}
        </label>
        <label className={styles.field}>
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => onPassword(event.target.value)}
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
