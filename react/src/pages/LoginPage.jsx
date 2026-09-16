import { useState } from 'react';
import LoginForm from '../features/auth/LoginForm';
import styles from './LoginPage.module.css';

export default function LoginPage({ onLoginSuccess }) {
  const [success, setSuccess] = useState(false);

  return (
    <div className={styles.page}>
      <aside className={styles.brandPanel} aria-hidden="true">
        <div>
          <span className={styles.wordmark}>MedPortal</span>
          <p className={styles.tagline}>
            Your prescriptions, appointments, and care team — in one place.
          </p>
        </div>
      </aside>

      <main className={styles.formPanel}>
        <div className={styles.formCard}>
          <h1>Welcome back</h1>
          <p className={styles.subheading}>Sign in to your account to continue.</p>

          {success && (
            <p role="status" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
              Login successful. Authentication verified.
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
