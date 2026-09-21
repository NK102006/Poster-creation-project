import { useEffect, useState } from 'react';
import { apiRequest } from '../lib/apiClient';
import PosterGenerator from '../components/PosterGenerator';
import StudioShell from '../components/StudioShell';
import styles from './DoctorDetailsPage.module.css';

export default function DoctorDetailsPage({
  user,
  onLogout,
  onBack,
  onBrandClick,
  onOpenExisting,
  onStartNew,
  existingDoctor = null,
  doctorId = null,
  initialStep = 1,
}) {
  const [doctor, setDoctor] = useState(existingDoctor);
  const [formData, setFormData] = useState({
    name: existingDoctor?.name || '',
    contactnumber: existingDoctor?.contactnumber
      ? String(existingDoctor.contactnumber)
      : '',
    clinicName: existingDoctor?.clinicName || '',
  });
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(existingDoctor?.logo || null);

  const editingExisting = Boolean(doctor || existingDoctor || doctorId);

  useEffect(() => {
    if (!doctorId || existingDoctor?.id === doctorId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiRequest(`/doctors/${doctorId}`);
        if (cancelled || !res?.doctor) return;
        setDoctor(res.doctor);
        setFormData({
          name: res.doctor.name || '',
          contactnumber: res.doctor.contactnumber
            ? String(res.doctor.contactnumber)
            : '',
          clinicName: res.doctor.clinicName || '',
        });
        setLogoPreview(res.doctor.logo || null);
      } catch (err) {
        console.warn('Could not load doctor for poster:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [doctorId, existingDoctor?.id]);

  const handleAutoSave = async (currentFormData, currentLogoFile, posterBlob) => {
    const name = currentFormData?.name?.trim() || formData.name?.trim();
    const contactnumber =
      currentFormData?.contactnumber?.trim() || formData.contactnumber?.trim();
    const clinicName =
      currentFormData?.clinicName?.trim() || formData.clinicName?.trim();
    const file = currentLogoFile !== undefined ? currentLogoFile : logoFile;

    if (!name && !contactnumber && !clinicName) {
      return { success: true };
    }

    const data = new FormData();
    if (name) data.append('name', name);
    if (contactnumber) data.append('contactnumber', contactnumber);
    if (clinicName) data.append('clinicName', clinicName);
    if (doctor?.id) data.append('doctorId', doctor.id);
    data.append('countDownload', 'true');

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
    <StudioShell
      onLogout={onLogout}
      onBrandClick={onBrandClick || onStartNew}
      headerActions={
        onOpenExisting ? (
          <button type="button" className={styles.headerAction} onClick={onOpenExisting}>
            Existing doctors
          </button>
        ) : null
      }
    >
      <div className={styles.hero}>
        {onBack && (
          <button type="button" className={styles.backLink} onClick={onBack}>
            ← Back to doctor
          </button>
        )}
        <h1 className={styles.heroTitle}>
          {editingExisting ? 'Create poster' : 'Doctor details'}
        </h1>
        <p className={styles.heroSub}>
          {editingExisting
            ? `Working on ${doctor?.name || existingDoctor?.name || 'this doctor'}`
            : 'Fill in the profile and generate a poster'}
        </p>
        {editingExisting && onStartNew && (
          <button type="button" className={styles.switchLink} onClick={onStartNew}>
            Start a new doctor instead
          </button>
        )}
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
        initialStep={initialStep}
      />
    </StudioShell>
  );
}
