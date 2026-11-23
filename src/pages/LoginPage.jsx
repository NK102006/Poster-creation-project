import { useState } from 'react';
import LoginForm from '../features/auth/LoginForm';
import styles from './LoginPage.module.css';

export default function LoginPage({ onLoginSuccess }) {
  const [success, setSuccess] = useState(false);

  return (
    <div className={styles.page}>
      <main className={styles.centerStage}>
        <div className={styles.brandMark}>
          <span className={styles.logoIcon} aria-hidden="true">
            <svg viewBox="0 0 24 24" className={styles.logoMark} fill="none">
              <path
                d="M12 4.5v15M4.5 12h15"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <span className={styles.wordmark}>MedPortal</span>
        </div>

        <p className={styles.tagline}>Clinical poster studio for modern practices</p>

        <div className={styles.formCard}>
          <h1>Welcome back</h1>

          {success && (
            <p className={styles.successNote} role="status">
              Login successful.
            </p>
          )}

          <LoginForm
            onSuccess={(data) => {
              setSuccess(true);
              onLoginSuccess?.(data.user);
            }}
          />
        </div>
      </main>
    </div>
  );
}
