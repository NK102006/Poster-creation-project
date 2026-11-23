import StudioShell from '../components/StudioShell';
import styles from './DoctorHubPage.module.css';

export default function DoctorHubPage({ user, onLogout, onAddNew, onAccessExisting, onBrandClick }) {
  return (
    <StudioShell user={user} onLogout={onLogout} onBrandClick={onBrandClick}>
      <div className={styles.hero}>
        <h1 className={styles.title}>Welcome</h1>
        <p className={styles.subtitle}>Choose add new doctor or an existing one</p>
      </div>

      <div className={styles.choiceGrid}>
        <button type="button" className={styles.choiceCard} onClick={onAddNew}>
          <span className={styles.choiceIndex}>01</span>
          <h2 className={styles.choiceTitle}>Add new doctor</h2>
          <p className={styles.choiceText}>Create a doctor profile and generate posters</p>
        </button>

        <button type="button" className={styles.choiceCard} onClick={onAccessExisting}>
          <span className={styles.choiceIndex}>02</span>
          <h2 className={styles.choiceTitle}>Access existing doctor</h2>
          <p className={styles.choiceText}>Find, manage, and review posters for saved doctors</p>
        </button>
      </div>
    </StudioShell>
  );
}
