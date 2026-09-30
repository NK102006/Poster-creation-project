import { useEffect, useState } from 'react';
import { apiRequest } from '../lib/apiClient';
import StudioShell from '../components/StudioShell';
import LogoCanvas from '../components/LogoCanvas';
import { sanitizePhoneInput, validatePhoneNumber } from '../features/auth/validators';
import { enabledFormFields, isFullWidthDoctorField } from '../lib/doctorFields';
import styles from './DoctorManagePage.module.css';
import adminStyles from './AdminPortal.module.css';

const EMPTY_FORM = {
  dynamicFields: {},
};

function inferPosterKind(poster) {
  const raw = String(poster?.kind || '').toLowerCase();
  if (raw === 'festival' || raw === 'video' || raw === 'education') return raw;
  if (raw === 'gk') return 'education';
  const src = String(poster?.image || '');
  if (src.includes('.mp4') || src.includes('video') || src.startsWith('data:video')) {
    return 'video';
  }
  return 'education';
}

function posterGalleryStyle(count) {
  if (count <= 1) return { gridTemplateColumns: 'minmax(320px, 480px)', justifyContent: 'center' };
  if (count <= 2) return { gridTemplateColumns: 'repeat(2, minmax(280px, 1fr))' };
  if (count <= 4) return { gridTemplateColumns: 'repeat(2, minmax(260px, 1fr))' };
  if (count <= 6) return { gridTemplateColumns: 'repeat(3, minmax(240px, 1fr))' };
  return { gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' };
}

function formatPosterSendDate(value) {
  if (!value) return 'Send date not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Send date not set';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const compare = new Date(date);
  compare.setHours(0, 0, 0, 0);
  const label = date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  return compare > today ? `Send ${label}` : `Sent ${label}`;
}

export default function DoctorManagePage({
  user,
  doctorId,
  onLogout,
  onBack,
  onStartNew,
  onContinue,
  onBrandClick,
}) {
  const [doctor, setDoctor] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [logoPreview, setLogoPreview] = useState('');
  const [logoFile, setLogoFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [formFieldErrors, setFormFieldErrors] = useState({});
  const [doctorFields, setDoctorFields] = useState([]);

  const [originalLogoUrl, setOriginalLogoUrl] = useState(null);
  const [showCropModal, setShowCropModal] = useState(false);
  const [croppedLogoData, setCroppedLogoData] = useState(null);
  const [logoCropState, setLogoCropState] = useState(null);
  const [tempLogoCropState, setTempLogoCropState] = useState(null);
  const [showPosters, setShowPosters] = useState(false);

  const isInactive = doctor?.active === false;
  const doctorPosters = doctor?.posters || [];

  useEffect(() => {
    if (!showPosters) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setShowPosters(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showPosters]);

  const loadDoctor = async () => {
    setLoading(true);
    setError(null);
    try {
      const fieldsRes = await apiRequest('/doctor-fields');
      if (fieldsRes?.fields) setDoctorFields(fieldsRes.fields);

      const res = await apiRequest(`/doctors/${doctorId}`);
      setDoctor(res.doctor);
      setForm({
        ...res.doctor,
        contactnumber: res.doctor.contactnumber ? String(res.doctor.contactnumber) : '',
        dynamicFields: res.doctor.dynamicFields || {},
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

    const errs = {};
    const enabledFields = doctorFields.filter(f => f.enabled);

    for (const f of enabledFields) {
      const isDynamic = !f.isStandard;
      const val = isDynamic ? (form.dynamicFields?.[f.key] || '') : (form[f.key] || '');

      if (f.key === 'contactnumber') {
        const phoneError = validatePhoneNumber(val);
        if (phoneError) errs[f.key] = phoneError;
        else if (f.required && !String(val).trim()) errs[f.key] = `${f.label} is required`;
        continue;
      }
      if (f.required && !String(val).trim()) errs[f.key] = `${f.label} is required`;
    }
    
    if (Object.keys(errs).length > 0) {
      setFormFieldErrors(errs);
      return;
    }
    setFormFieldErrors({});

    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const data = new FormData();
      for (const f of doctorFields.filter(field => field.enabled)) {
        if (f.isStandard) data.append(f.key, (form[f.key] || '').trim());
      }
      data.append('dynamicFields', JSON.stringify(form.dynamicFields || {}));
      if (logoPreview?.startsWith('data:')) data.append('logo', logoPreview);
      else if (logoFile) data.append('logo', logoFile);

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

  const handleContinue = async () => {
    const errs = {};
    const enabledFields = doctorFields.filter(f => f.enabled);

    for (const f of enabledFields) {
      const isDynamic = !f.isStandard;
      const val = isDynamic ? (form.dynamicFields?.[f.key] || '') : (form[f.key] || '');

      if (f.key === 'contactnumber') {
        const phoneError = validatePhoneNumber(val);
        if (phoneError) errs[f.key] = phoneError;
        else if (f.required && !String(val).trim()) errs[f.key] = `${f.label} is required`;
        continue;
      }
      if (f.required && !String(val).trim()) errs[f.key] = `${f.label} is required`;
    }

    if (Object.keys(errs).length > 0) {
      setFormFieldErrors(errs);
      setError('Please fix the errors above before continuing.');
      return;
    }

    if (isInactive) {
      setError('Reactivate this doctor before continuing.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const data = new FormData();
      for (const f of doctorFields.filter(field => field.enabled)) {
        if (f.isStandard) data.append(f.key, String(form[f.key] || '').trim());
      }
      data.append('dynamicFields', JSON.stringify(form.dynamicFields || {}));
      if (logoFile) data.append('logo', logoFile);
      else if (logoPreview?.startsWith('data:')) data.append('logo', logoPreview);

      const res = await apiRequest(`/doctors/${doctorId}`, {
        method: 'PUT',
        body: data,
      });
      onContinue?.(res.doctor || doctor);
    } catch (err) {
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const missingRequired = doctorFields.filter(f => f.enabled && f.required).some(f => {
    const isDynamic = !f.isStandard;
    const val = isDynamic ? form.dynamicFields?.[f.key] : form[f.key];
    return !String(val || '').trim();
  });

  return (
    <StudioShell
      user={user}
      onLogout={onLogout}
      onBrandClick={onBrandClick}
      onBack={onBack}
      backLabel="Doctors"
      headerActions={
        onStartNew ? (
          <button type="button" className={styles.headerAction} onClick={onStartNew}>
            New doctor
          </button>
        ) : null
      }
    >
      {loading && <p className={styles.status}>Loading…</p>}
      {error && <p className={styles.error}>{error}</p>}
      {message && <p className={styles.success}>{message}</p>}

      {!loading && doctor && (
        <div className={styles.profilePage}>
          <section className={styles.profileHero}>
            <div className={styles.profilePhoto}>
              {logoPreview ? (
                <img src={logoPreview} alt="" />
              ) : (
                <span>{(doctor.name || 'D').slice(0, 1)}</span>
              )}
            </div>
            <div className={styles.profileCopy}>
              <div className={styles.profileTop}>
                <p className={styles.profileEyebrow}>Doctor profile</p>
                <div className={styles.profileTopActions}>
                  <button
                    type="button"
                    className={styles.showPostersBtn}
                    onClick={() => setShowPosters(true)}
                  >
                    Show posters
                    {doctor.postersMade ? (
                      <span className={styles.showPostersCount}>{doctor.postersMade}</span>
                    ) : null}
                  </button>
                  <span className={isInactive ? styles.statusPillInactive : styles.statusPill}>
                    {isInactive ? 'Inactive' : 'Active'}
                  </span>
                </div>
              </div>
              <h1 className={styles.profileName}>{doctor.name || 'Doctor'}</h1>
              <p className={styles.profileMeta}>
                {[
                  doctorFields.find(f => f.key === 'doctorDegree')?.enabled ? form.doctorDegree : null, 
                  doctorFields.find(f => f.key === 'clinicName')?.enabled ? form.clinicName : null
                ].filter(Boolean).join(' · ') || 'Add details'}
              </p>
              <div className={styles.metricRow}>
                <div className={styles.metric}>
                  <strong>{doctor.postersMade || 0}</strong>
                  <span>Posters</span>
                </div>
                <div className={styles.metric}>
                  <strong>{doctor.downloadCount || 0}</strong>
                  <span>Downloads</span>
                </div>
                <div className={styles.metric}>
                  <strong>{form.contactnumber || '—'}</strong>
                  <span>WhatsApp</span>
                </div>
              </div>
            </div>
          </section>

          {isInactive && (
            <p className={styles.inactiveBanner}>
              This doctor is deactivated. Activate the profile to create new posters.
            </p>
          )}

          <form className={styles.panel} onSubmit={handleSave}>
            <div className={styles.panelHeader}>
              <div>
                <h2 className={styles.panelTitle}>Profile details</h2>
                <p className={styles.panelHint}>Update the information used on posters.</p>
              </div>
            </div>

            <div className={styles.formGrid}>
              {enabledFormFields(doctorFields).map((field) => {
                const isDynamic = !field.isStandard;
                const value = isDynamic ? (form.dynamicFields?.[field.key] ?? '') : (form[field.key] ?? '');
                const fullWidth = isFullWidthDoctorField(field);

                return (
                  <label
                    key={field.key}
                    className={`${styles.field} ${fullWidth ? styles.fieldFull : ''}`}
                  >
                    <span>{field.label} {field.required ? '*' : ''}</span>
                    <input
                      type={field.type || 'text'}
                      inputMode={field.key === 'contactnumber' ? 'numeric' : undefined}
                      minLength={field.key === 'contactnumber' ? 10 : undefined}
                      maxLength={field.key === 'contactnumber' ? 10 : undefined}
                      pattern={field.key === 'contactnumber' ? '[0-9]{10}' : undefined}
                      value={value}
                      placeholder={field.key === 'doctorDegree' ? 'e.g. MBBS, MD (Medicine)' : ''}
                      onChange={(e) => {
                        const next = field.key === 'contactnumber' ? sanitizePhoneInput(e.target.value) : e.target.value;
                        setForm((p) => {
                          if (isDynamic) return { ...p, dynamicFields: { ...p.dynamicFields, [field.key]: next } };
                          return { ...p, [field.key]: next };
                        });
                        if (formFieldErrors[field.key]) setFormFieldErrors((p) => ({ ...p, [field.key]: null }));
                      }}
                      onBlur={(e) => {
                        if (field.key === 'contactnumber') {
                          const err = validatePhoneNumber(e.target.value);
                          if (err) setFormFieldErrors((p) => ({ ...p, contactnumber: err }));
                        }
                      }}
                    />
                    {formFieldErrors[field.key] && <span className={styles.fieldError}>{formFieldErrors[field.key]}</span>}
                  </label>
                );
              })}
            </div>

            {doctorFields.some(f => f.key === 'logo' && f.enabled) && (
              <label className={styles.field}>
                <span>Doctor photo / logo</span>
                <div className={styles.logoBox}>
                  {logoPreview ? (
                    <img 
                      src={logoPreview} 
                      alt="" 
                      className={styles.logoThumb} 
                      onClick={(e) => {
                        e.preventDefault();
                        handleAdjustClick();
                      }} 
                      style={{ cursor: 'pointer' }} 
                      title="Click to adjust / reframe"
                    />
                  ) : (
                    <div className={styles.logoFallback}>No logo</div>
                  )}
                  <div style={{ flex: 1 }}>
                    <input type="file" accept="image/*" onChange={handleLogoChange} className="bs-form-control" />
                  </div>
                </div>
              </label>
            )}

            <div className={styles.footerActions}>
              <div className={styles.footerLeft}>
                <button type="button" className={styles.secondaryBtn} onClick={handleToggleActive}>
                  {isInactive ? 'Activate' : 'Deactivate'}
                </button>
                <button type="button" className={styles.dangerBtn} onClick={handleRemove}>
                  Remove
                </button>
              </div>
              <div className={styles.footerRight}>
                <button type="submit" className={styles.secondaryBtn} disabled={saving}>
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
                <button
                  type="button"
                  className={styles.continueBtn}
                  onClick={handleContinue}
                  disabled={isInactive || missingRequired}
                  title={
                    isInactive
                      ? 'Activate this doctor to continue'
                      : missingRequired
                        ? "Fill all required fields to continue"
                        : 'Save & next'
                  }
                >
                  Save & next
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {showPosters && doctor && (
        <div className={adminStyles.posterOverlay} role="dialog" aria-modal="true" aria-label="Doctor posters">
          <div className={adminStyles.posterOverlayHeader}>
            <div>
              <p className={adminStyles.previewEyebrow}>Posters</p>
              <h2>{doctor.name || 'Doctor'}</h2>
              <p className={adminStyles.previewMeta}>
                {doctorPosters.length} {doctorPosters.length === 1 ? 'poster' : 'posters'}
              </p>
            </div>
            <button
              type="button"
              className={adminStyles.secondaryBtn}
              onClick={() => setShowPosters(false)}
            >
              Close
            </button>
          </div>
          <div className={adminStyles.posterOverlayBody}>
            {doctorPosters.length === 0 ? (
              <p className={adminStyles.posterEmpty}>No posters yet.</p>
            ) : (
              <div
                className={adminStyles.posterGallery}
                style={posterGalleryStyle(doctorPosters.length)}
              >
                {doctorPosters.map((poster, index) => {
                  const kind = inferPosterKind(poster);
                  return (
                    <div key={poster.id || index} className={adminStyles.posterOverlayItem}>
                      {kind === 'video' ? (
                        <video src={poster.image} controls playsInline preload="metadata" />
                      ) : (
                        <img src={poster.image} alt={poster.label || `Poster ${index + 1}`} />
                      )}
                      <em>{poster.label || `Poster ${index + 1}`}</em>
                      <small>{kind}</small>
                      <span className={adminStyles.posterSendDate}>
                        {formatPosterSendDate(poster.createdAt)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
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
