import { useState } from 'react';
import LoginForm from '../features/auth/LoginForm';
import styles from './LoginPage.module.css';

export default function LoginPage({ onLoginSuccess }) {
  const [success, setSuccess] = useState(false);

  return (
    <div className={styles.page}>
      <main className={styles.centerStage}>
        <div className={styles.brandMark}>
          <span className={styles.logoIcon}>M</span>
          <span className={styles.wordmark}>MedPortal</span>
        </div>

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
