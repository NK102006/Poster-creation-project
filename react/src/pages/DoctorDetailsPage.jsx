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
    doctorDegree: existingDoctor?.doctorDegree || '',
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
          doctorDegree: res.doctor.doctorDegree || '',
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

  const handleAutoSave = async (currentFormData, currentLogoFile, posterBlob, saveMeta) => {
    const name = currentFormData?.name?.trim() || formData.name?.trim();
    const contactnumber =
      currentFormData?.contactnumber?.trim() || formData.contactnumber?.trim();
    const clinicName =
      currentFormData?.clinicName?.trim() || formData.clinicName?.trim();
    const doctorDegree =
      currentFormData?.doctorDegree?.trim() || formData.doctorDegree?.trim();
    const file = currentLogoFile !== undefined ? currentLogoFile : logoFile;

    if (!name && !contactnumber && !clinicName && !doctorDegree) {
      return { success: true };
    }

    const data = new FormData();
    if (name) data.append('name', name);
    if (contactnumber) data.append('contactnumber', contactnumber);
    if (clinicName) data.append('clinicName', clinicName);
    if (doctorDegree) data.append('doctorDegree', doctorDegree);
    if (doctor?.id) data.append('doctorId', doctor.id);
    if (!doctor?.id && user?.id) data.append('ownerUserId', user.id);
    data.append('countDownload', 'true');

    if (file) {
      data.append('logo', file);
    } else if (logoPreview && typeof logoPreview === 'string' && logoPreview.startsWith('data:')) {
      data.append('logo', logoPreview);
    }
    if (posterBlob) {
      const ext = posterBlob.type && posterBlob.type.includes('video') ? 'mp4' : 'jpg';
      data.append('poster', posterBlob, `poster.${ext}`);
      if (saveMeta?.kind) data.append('posterKind', saveMeta.kind);
      if (saveMeta?.label) data.append('posterLabel', saveMeta.label);
    }
    if (saveMeta?.kind) {
      data.append('posterKind', saveMeta.kind);
    }

    try {
      const result = await apiRequest('/doctors', {
        method: 'POST',
        body: data,
      });
      if (result?.doctor) {
        setDoctor(result.doctor);
        setLogoFile(null);
        if (result.doctor.logo) {
          setLogoPreview(result.doctor.logo);
        }
      }
      return { success: true };
    } catch (err) {
      console.warn('Auto-save background sync notice:', err);
      return { success: false, error: err };
    }
  };

  const handleSaveDoctorInitial = async () => {
    if (doctor?.id) return true; // Already saved

    const name = formData.name?.trim();
    const contactnumber = formData.contactnumber?.trim();
    const clinicName = formData.clinicName?.trim();
    const doctorDegree = formData.doctorDegree?.trim();

    const data = new FormData();
    if (name) data.append('name', name);
    if (contactnumber) data.append('contactnumber', contactnumber);
    if (clinicName) data.append('clinicName', clinicName);
    if (doctorDegree) data.append('doctorDegree', doctorDegree);
    if (user?.id) data.append('ownerUserId', user.id);

    if (logoFile) {
      data.append('logo', logoFile);
    } else if (logoPreview && typeof logoPreview === 'string' && logoPreview.startsWith('data:')) {
      data.append('logo', logoPreview);
    }

    try {
      const result = await apiRequest('/doctors', {
        method: 'POST',
        body: data,
      });
      if (result?.doctor) {
        setDoctor(result.doctor);
        setLogoFile(null);
        if (result.doctor.logo) {
          setLogoPreview(result.doctor.logo);
        }
      }
      return { success: true };
    } catch (err) {
      console.error('Failed to save doctor initially:', err);
      return { success: false, error: err.message || 'Failed to save doctor.' };
    }
  };

  return (
    <StudioShell
      user={user}
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
        onSaveDoctorInitial={handleSaveDoctorInitial}
        doctor={doctor}
        initialStep={initialStep}
      />
    </StudioShell>
  );
}
