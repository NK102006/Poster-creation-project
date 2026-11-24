import { useEffect, useRef, useState } from 'react';
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
  const [doctorFields, setDoctorFields] = useState([]);
  const [formData, setFormData] = useState({
    dynamicFields: existingDoctor?.dynamicFields || {},
    name: existingDoctor?.name || '',
    contactnumber: existingDoctor?.contactnumber
      ? String(existingDoctor.contactnumber)
      : '',
    clinicName: existingDoctor?.clinicName || '',
    doctorDegree: existingDoctor?.doctorDegree || '',
  });
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(existingDoctor?.logo || null);

  // Latest values for the async refresh below, so it never overwrites a photo
  // or details the user has already changed on this screen.
  const initialLogoRef = useRef(existingDoctor?.logo || null);
  const initialFormRef = useRef(null);
  const latestRef = useRef({ logoFile, logoPreview, formData });
  latestRef.current = { logoFile, logoPreview, formData };
  if (initialFormRef.current === null) initialFormRef.current = formData;

  const editingExisting = Boolean(doctor || existingDoctor || doctorId);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const fieldsRes = await apiRequest('/doctor-fields');
        if (!cancelled && fieldsRes?.fields) setDoctorFields(fieldsRes.fields);
      } catch (err) {
        console.warn('Could not load fields:', err);
      }

      // Always reload: the doctor passed in may be an older copy (e.g. from
      // before the photo was changed on the profile page).
      if (!doctorId) return;

      try {
        const res = await apiRequest(`/doctors/${doctorId}`);
        if (cancelled || !res?.doctor) return;
        const latest = latestRef.current;
        setDoctor(res.doctor);
        if (latest.formData === initialFormRef.current) {
          setFormData({
            dynamicFields: res.doctor.dynamicFields || {},
            name: res.doctor.name || '',
            contactnumber: res.doctor.contactnumber
              ? String(res.doctor.contactnumber)
              : '',
            clinicName: res.doctor.clinicName || '',
            doctorDegree: res.doctor.doctorDegree || '',
          });
        }
        if (!latest.logoFile && latest.logoPreview === initialLogoRef.current) {
          setLogoPreview(res.doctor.logo || null);
        }
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

    if (logoPreview && typeof logoPreview === 'string' && logoPreview.startsWith('data:')) {
      data.append('logo', logoPreview);
    } else if (file) {
      data.append('logo', file);
    }
    if (posterBlob) {
      const ext = posterBlob.type && posterBlob.type.includes('video') ? 'mp4' : 'jpg';
      data.append('poster', posterBlob, `poster.${ext}`);
      if (saveMeta?.kind) data.append('posterKind', saveMeta.kind);
      if (saveMeta?.label) data.append('posterLabel', saveMeta.label);
      if (saveMeta?.month) data.append('posterMonth', saveMeta.month);
    }
    if (saveMeta?.kind) {
      data.append('posterKind', saveMeta.kind);
    }
    
    data.append('dynamicFields', JSON.stringify(currentFormData?.dynamicFields || formData.dynamicFields || {}));

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

  // Saves the Details step: creates a new doctor, or updates an existing one
  // (so a changed photo or details are stored before moving to the design step).
  const handleSaveDoctorInitial = async () => {
    const name = formData.name?.trim();
    const contactnumber = formData.contactnumber?.trim();
    const clinicName = formData.clinicName?.trim();
    const doctorDegree = formData.doctorDegree?.trim();

    const data = new FormData();
    if (name) data.append('name', name);
    if (contactnumber) data.append('contactnumber', contactnumber);
    if (clinicName) data.append('clinicName', clinicName);
    if (doctorDegree) data.append('doctorDegree', doctorDegree);
    if (doctor?.id) data.append('doctorId', doctor.id);
    else if (user?.id) data.append('ownerUserId', user.id);
    data.append('dynamicFields', JSON.stringify(formData.dynamicFields || {}));

    if (logoPreview && typeof logoPreview === 'string' && logoPreview.startsWith('data:')) {
      data.append('logo', logoPreview);
    } else if (logoFile) {
      data.append('logo', logoFile);
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
      onBack={onBack}
      backLabel="Back"
      headerActions={
        onOpenExisting ? (
          <button type="button" className={styles.headerAction} onClick={onOpenExisting}>
            Existing doctors
          </button>
        ) : null
      }
    >
      <div className={styles.hero}>
        <h1 className={styles.heroTitle}>
          {editingExisting ? 'Create poster' : 'Doctor details'}
        </h1>
        <p className={styles.heroSub}>
          {editingExisting
            ? `Working on ${doctor?.name || existingDoctor?.name || 'this doctor'}`
            : 'Fill in the profile and generate a poster'}
        </p>
      </div>

      <PosterGenerator
        formData={formData}
        setFormData={setFormData}
        formFieldConfig={doctorFields}
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
