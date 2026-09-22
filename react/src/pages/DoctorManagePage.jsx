import { useEffect, useState } from 'react';
import { apiRequest } from '../lib/apiClient';
import StudioShell from '../components/StudioShell';
import LogoCanvas from '../components/LogoCanvas';
import { getSendDateForIndex } from '../lib/posterSchedule';
import styles from './DoctorManagePage.module.css';

const EMPTY_FORM = {
  name: '',
  clinicName: '',
  contactnumber: '',
  doctorDegree: '',
};

export default function DoctorManagePage({
  user,
  doctorId,
  onLogout,
  onBack,
  onStartNew,
  onContinue,
}) {
  const [doctor, setDoctor] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [logoPreview, setLogoPreview] = useState('');
  const [logoFile, setLogoFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const [originalLogoUrl, setOriginalLogoUrl] = useState(null);
  const [showCropModal, setShowCropModal] = useState(false);
  const [croppedLogoData, setCroppedLogoData] = useState(null);
  const [logoCropState, setLogoCropState] = useState(null);
  const [tempLogoCropState, setTempLogoCropState] = useState(null);

  const isInactive = doctor?.active === false;

  const loadDoctor = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest(`/doctors/${doctorId}`);
      setDoctor(res.doctor);
      setForm({
        name: res.doctor.name || '',
        clinicName: res.doctor.clinicName || '',
        contactnumber: res.doctor.contactnumber ? String(res.doctor.contactnumber) : '',
        doctorDegree: res.doctor.doctorDegree || '',
      });
      setLogoPreview(res.doctor.logo || '');
      setLogoFile(null);
      setOriginalLogoUrl(res.doctor.logo || null);
      setLogoCropState(null);
      setTempLogoCropState(null);
    } catch (err) {
      setError(err.message || 'Failed to load doctor');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDoctor();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctorId]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const data = new FormData();
      data.append('name', form.name.trim());
      data.append('clinicName', form.clinicName.trim());
      data.append('contactnumber', form.contactnumber.trim());
      data.append('doctorDegree', form.doctorDegree.trim());
      if (logoFile) data.append('logo', logoFile);
      else if (logoPreview?.startsWith('data:')) data.append('logo', logoPreview);

      const res = await apiRequest(`/doctors/${doctorId}`, {
        method: 'PUT',
        body: data,
      });
      setDoctor(res.doctor);
      setMessage('Doctor details saved');
    } catch (err) {
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async () => {
    if (!doctor) return;
    const nextActive = !doctor.active;
    const label = nextActive ? 'activate' : 'deactivate';
    if (!window.confirm(`Are you sure you want to ${label} this doctor?`)) return;

    try {
      const res = await apiRequest(`/doctors/${doctorId}/status`, {
        method: 'PATCH',
        body: { active: nextActive },
      });
      setDoctor(res.doctor);
      setMessage(nextActive ? 'Doctor activated' : 'Doctor deactivated');
    } catch (err) {
      setError(err.message || 'Status update failed');
    }
  };

  const handleRemove = async () => {
    if (!window.confirm('Permanently remove this doctor and all posters?')) return;
    try {
      await apiRequest(`/doctors/${doctorId}`, { method: 'DELETE' });
      onBack?.();
    } catch (err) {
      setError(err.message || 'Delete failed');
    }
  };

  const handleDownloadPoster = async (poster) => {
    if (!poster?.image) return;
    try {
      const link = document.createElement('a');
      link.href = poster.image;
      link.download = `Poster_${(doctor?.name || 'doctor').replace(/\s+/g, '_')}.jpg`;
      link.click();

      const res = await apiRequest(`/doctors/${doctorId}/download`, {
        method: 'POST',
        body: { posterId: poster.id === 'legacy' ? undefined : poster.id },
      });
      setDoctor(res.doctor);
    } catch (err) {
      setError(err.message || 'Download tracking failed');
    }
  };

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    const url = URL.createObjectURL(file);
    setOriginalLogoUrl(url);
    setLogoCropState(null);
    setTempLogoCropState(null);
    setShowCropModal(true);
    e.target.value = '';
  };

  const handleAdjustClick = () => {
    if (!originalLogoUrl && logoPreview) {
      setOriginalLogoUrl(logoPreview);
    } else if (!originalLogoUrl && doctor?.logo) {
      setOriginalLogoUrl(doctor.logo);
    }
    setShowCropModal(true);
  };

  const handleApplyCrop = () => {
    if (croppedLogoData) {
      setLogoPreview(croppedLogoData);
      if (tempLogoCropState) setLogoCropState(tempLogoCropState);
      // Keep as data URL for save when no fresh File
      setLogoFile(null);
    }
    setShowCropModal(false);
  };

  const handleContinue = () => {
    if (isInactive) {
      setError('Reactivate this doctor before continuing.');
      return;
    }
    if (!form.doctorDegree?.trim()) {
      setError("Doctor's degree is required before continuing.");
      return;
    }
    onContinue?.(doctor);
  };

  return (
    <StudioShell
      userLabel={user ? `Employee ${user.empid || (user.id && String(user.id).length < 24 ? user.id : '')}`.trim() : 'Employee'}
      onLogout={onLogout}
      onBrandClick={onStartNew || onBack}
      headerActions={
        onStartNew ? (
          <button type="button" className={styles.headerAction} onClick={onStartNew}>
            New doctor
          </button>
        ) : null
      }
    >
      <div className={styles.hero}>
        <button type="button" className={styles.backLink} onClick={onBack}>
          ← Back to list
        </button>
        <h1 className={styles.title}>{doctor?.name || 'Doctor'}</h1>
        <p className={styles.subtitle}>
          {isInactive ? 'Deactivated' : 'Active'} profile
        </p>
      </div>

      {loading && <p className={styles.status}>Loading…</p>}
      {error && <p className={styles.error}>{error}</p>}
      {message && <p className={styles.success}>{message}</p>}

      {!loading && doctor && (
        <>
          {isInactive && (
            <p className={styles.inactiveBanner}>
              This doctor is deactivated. Activate the profile to create new posters.
            </p>
          )}

          <div className={styles.statsRow}>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>Posters made</span>
              <strong className={styles.statValue}>{doctor.postersMade || 0}</strong>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>Downloads</span>
              <strong className={styles.statValue}>{doctor.downloadCount || 0}</strong>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>Status</span>
              <strong className={styles.statValue}>
                {isInactive ? 'Inactive' : 'Active'}
              </strong>
            </div>
          </div>

          <form className={styles.panel} onSubmit={handleSave}>
            <h2 className={styles.panelTitle}>Edit details</h2>

            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span>Doctor full name</span>
                <input
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  required
                />
              </label>
              <label className={styles.field}>
                <span>Doctor&apos;s degree</span>
                <input
                  value={form.doctorDegree}
                  onChange={(e) => setForm((p) => ({ ...p, doctorDegree: e.target.value }))}
                  placeholder="e.g. MBBS, MD (Medicine)"
                  required
                />
              </label>
              <label className={styles.field}>
                <span>Clinic / Hospital name</span>
                <input
                  value={form.clinicName}
                  onChange={(e) => setForm((p) => ({ ...p, clinicName: e.target.value }))}
                  required
                />
              </label>
              <label className={styles.field}>
                <span>WhatsApp contact</span>
                <input
                  value={form.contactnumber}
                  onChange={(e) => setForm((p) => ({ ...p, contactnumber: e.target.value }))}
                  required
                />
              </label>
            </div>

            <label className={styles.field}>
              <span>Doctor photo / logo</span>
              <div className={styles.logoRow}>
                {logoPreview ? (
                  <img src={logoPreview} alt="" className={styles.logoThumb} />
                ) : (
                  <div className={styles.logoFallback}>No logo</div>
                )}
                <input type="file" accept="image/*" onChange={handleLogoChange} />
                {logoPreview && (
                  <button
                    type="button"
                    className={styles.secondaryBtn}
                    onClick={handleAdjustClick}
                  >
                    Adjust / reframe
                  </button>
                )}
              </div>
            </label>

            <div className={styles.actions}>
              <button type="button" className={styles.backAction} onClick={onBack}>
                ← Back
              </button>
              <div className={styles.actionsCenter}>
                <button type="submit" className={styles.primaryBtn} disabled={saving}>
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
                <button type="button" className={styles.secondaryBtn} onClick={handleToggleActive}>
                  {isInactive ? 'Activate' : 'Deactivate'}
                </button>
                <button type="button" className={styles.dangerBtn} onClick={handleRemove}>
                  Remove
                </button>
              </div>
              <button
                type="button"
                className={styles.continueBtn}
                onClick={handleContinue}
                disabled={isInactive || !form.doctorDegree?.trim()}
                title={
                  isInactive
                    ? 'Activate this doctor to continue'
                    : !form.doctorDegree?.trim()
                      ? "Add doctor's degree to continue"
                      : 'Continue to design'
                }
              >
                Continue
              </button>
            </div>
          </form>


        </>
      )}

      {showCropModal && originalLogoUrl && (
        <div className={styles.cropOverlay}>
          <div className={styles.cropModal}>
            <h3 className={styles.cropTitle}>Adjust photo</h3>
            <LogoCanvas
              logoSrc={originalLogoUrl}
              initialState={logoCropState}
              onChange={(dataUrl, state) => {
                setCroppedLogoData(dataUrl);
                if (state) setTempLogoCropState(state);
              }}
            />
            <div className={styles.cropActions}>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => setShowCropModal(false)}
              >
                Cancel
              </button>
              <button type="button" className={styles.primaryBtn} onClick={handleApplyCrop}>
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </StudioShell>
  );
}
