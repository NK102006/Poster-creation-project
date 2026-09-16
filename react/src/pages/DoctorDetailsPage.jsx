import { useState, useEffect } from 'react';
import { apiRequest } from '../lib/apiClient';
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

  // Fetch initial doctor data if available from clinic registry
  useEffect(() => {
    let isMounted = true;
    const fetchDoctor = async () => {
      try {
        const res = await apiRequest('/doctors/current');
        if (isMounted && res?.doctor) {
          setDoctor(res.doctor);
          setFormData({
            name: res.doctor.name || '',
            contactnumber: res.doctor.contactnumber ? String(res.doctor.contactnumber) : '',
          });
          if (res.doctor.logo) {
            setLogoPreview(res.doctor.logo);
          }
          setLogoFile(null);
          setFormData({ name: '', contactnumber: '' });
          setLogoPreview('');
        }
      } catch (err) {
        console.warn('Doctor fetch notice:', err);
      }
    };

    fetchDoctor();
    return () => {
      isMounted = false;
    };
  }, []);

  // Automatically triggered in background when user downloads the poster in Step 4
  const handleAutoSave = async (currentFormData, currentLogoFile, posterBlob) => {
    const name = currentFormData?.name?.trim() || formData.name?.trim();
    const contactnumber = currentFormData?.contactnumber?.trim() || formData.contactnumber?.trim();
    const file = currentLogoFile !== undefined ? currentLogoFile : logoFile;

    if (!name && !contactnumber) {
      return { success: true };
    }

    const data = new FormData();
    if (name) data.append('name', name);
    if (contactnumber) data.append('contactnumber', contactnumber);
    if (file) {
      data.append('logo', file);
    } else if (logoPreview && typeof logoPreview === 'string' && logoPreview.startsWith('data:')) {
      data.append('logo', logoPreview);
    }
    if (posterBlob) {
      data.append('poster', posterBlob, 'poster.jpg');
    }

    try {
      const result = await apiRequest('/doctors', {
        method: 'POST',
        body: data,
      });
      if (result?.doctor) {
        setDoctor(result.doctor);
      }
      return { success: true };
    } catch (err) {
      console.warn('Auto-save background sync notice:', err);
      return { success: false, error: err };
    }
  };

  return (
    <div className={styles.page}>
      {/* Top Navigation */}
      <header className={styles.header}>
        <div className={styles.brandGroup}>
          <div className={styles.logoIcon}>M</div>
          <span className={styles.brandName}>MedPortal</span>
        </div>
        <div className={styles.userNav}>
          <div className={styles.userBadge}>
            <span className={styles.statusDot} />
            <span>Employee</span>
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

      {/* Main Content */}
      <main className={styles.main}>
        <div className={styles.hero}>
          <h1 className={styles.heroTitle}>Doctor Portal & Poster Studio</h1>
        </div>

        {/* Unified 4-Step Poster Studio */}
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
