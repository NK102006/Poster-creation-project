import { useState } from 'react';
import PosterGenerator from '../components/PosterGenerator';
import styles from './DoctorDetailsPage.module.css';

export default function DoctorDetailsPage({ user, onLogout }) {
  const [doctor, setDoctor] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    contactnumber: '',
  });
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);

  // Local-only save — keeps UI flow working with no backend/database.
  const handleAutoSave = async (currentFormData, currentLogoFile) => {
    const name = currentFormData?.name?.trim() || formData.name?.trim();
    const contactnumber =
      currentFormData?.contactnumber?.trim() || formData.contactnumber?.trim();
    const file = currentLogoFile !== undefined ? currentLogoFile : logoFile;

    if (!name && !contactnumber && !file && !logoPreview) {
      return { success: true };
    }

    setDoctor({
      name: name || '',
      contactnumber: contactnumber || '',
      logo: logoPreview || null,
      updatedBy: user?.empid || user?.id || null,
    });

    return { success: true };
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brandGroup}>
          <div className={styles.logoIcon}>M</div>
          <span className={styles.brandName}>MedPortal</span>
        </div>
        <div className={styles.userNav}>
          <div className={styles.userBadge}>
            <span className={styles.statusDot} />
            <span>Employee {user?.empid || user?.id || ''}</span>
          </div>
          <button
            type="button"
            className={styles.logoutBtn}
            onClick={onLogout}
            id="logout-button"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.hero}>
          <h1 className={styles.heroTitle}>Poster Studio</h1>
        </div>

        <PosterGenerator
          formData={formData}
          setFormData={setFormData}
          logoFile={logoFile}
          setLogoFile={setLogoFile}
          logoPreview={logoPreview}
          setLogoPreview={setLogoPreview}
          onAutoSave={handleAutoSave}
          doctor={doctor}
        />
      </main>
    </div>
  );
}
