// src/components/PosterGenerator.jsx
import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import JSZip from 'jszip';
import { POSTER_THEMES } from './Poster';
import PosterCarousel, { PosterPage } from './PosterCarousel';
import LogoCanvas from './LogoCanvas';
import { getGeneralPosters, getMonthlyPosters } from '../lib/posterCatalog';
import {
  mapThemeToRiskFactor,
  renderBlankPosterBlob,
  renderRiskFactorPosterBlob,
} from '../lib/posterExport';
import styles from './PosterGenerator.module.css';

const STEPS = [
  { id: 1, label: 'Doctor Details', short: 'Details' },
  { id: 2, label: 'Design', short: 'Design' },
];

export default function PosterGenerator({
  formData = { name: '', contactnumber: '', clinicName: '', doctorDegree: '' },
  setFormData,
  logoFile = null,
  setLogoFile,
  logoPreview = null,
  setLogoPreview,
  onAutoSave,
  doctor = null,
  initialStep = 1,
}) {
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [selectedThemeId, setSelectedThemeId] = useState('theme-warm-red');
  const [activePosterIndex, setActivePosterIndex] = useState(0);
  const [posterMode, setPosterMode] = useState('general');
  const [isGenerating, setIsGenerating] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [downloadMessage, setDownloadMessage] = useState('');
  const [stepError, setStepError] = useState(null);

  const [originalLogoUrl, setOriginalLogoUrl] = useState(null);
  const [showCropModal, setShowCropModal] = useState(false);
  const [croppedLogoData, setCroppedLogoData] = useState(null);
  const [logoCropState, setLogoCropState] = useState(null);
  const [tempLogoCropState, setTempLogoCropState] = useState(null);

  const [previewModalOpen, setPreviewModalOpen] = useState(false);

  const generalPosters = useMemo(() => getGeneralPosters(), []);
  const monthlyPosters = useMemo(() => getMonthlyPosters(new Date()), []);

  const selectedTheme =
    POSTER_THEMES.find((t) => t.id === selectedThemeId) || POSTER_THEMES[0];
  const isStepComplete = (step) => currentStep > step;
  const activePosterContent = monthlyPosters[activePosterIndex] || monthlyPosters[0];

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile?.(file);
      const url = URL.createObjectURL(file);
      setOriginalLogoUrl(url);
      setLogoCropState(null);
      setTempLogoCropState(null);
      setShowCropModal(true);
      if (stepError) setStepError(null);
    }
  };

  const handleRemoveLogo = () => {
    setLogoFile?.(null);
    setLogoPreview?.(null);
    setOriginalLogoUrl(null);
    setLogoCropState(null);
    setTempLogoCropState(null);
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
      setLogoPreview?.(croppedLogoData);
      if (tempLogoCropState) setLogoCropState(tempLogoCropState);
    }
    setShowCropModal(false);
  };

  const handleContinueToDesign = () => {
    const hasLogo = Boolean(logoFile || logoPreview);
    const hasName = Boolean(formData.name?.trim());
    const hasContact = Boolean(formData.contactnumber?.trim());
    const hasClinic = Boolean(formData.clinicName?.trim());
    const hasDegree = Boolean(formData.doctorDegree?.trim());

    if (!hasName || !hasDegree || !hasContact || !hasClinic || !hasLogo) {
      setStepError(
        'Please fill in all required fields (Name, Degree, Clinic/Hospital, Contact, and Logo) to proceed.'
      );
      return;
    }

    setStepError(null);
    setCurrentStep(2);
  };

  const checkCanNavigate = (targetStep) => {
    const hasLogo = Boolean(logoFile || logoPreview);
    const hasName = Boolean(formData.name?.trim());
    const hasContact = Boolean(formData.contactnumber?.trim());
    const hasClinic = Boolean(formData.clinicName?.trim());
    const hasDegree = Boolean(formData.doctorDegree?.trim());

    if (targetStep > 1 && (!hasName || !hasDegree || !hasContact || !hasClinic || !hasLogo)) {
      setStepError(
        'Please fill in all required fields (Name, Degree, Clinic/Hospital, Contact, and Logo) to proceed.'
      );
      return false;
    }

    if (targetStep > 2 && !selectedThemeId) {
      setStepError('Please choose a theme before previewing.');
      return false;
    }

    setStepError(null);
    return true;
  };

  const rawDocName = formData.name?.trim() || doctor?.name || 'Doctor Name';
  const formattedDoctorName = rawDocName.startsWith('Dr.') ? rawDocName : `Dr. ${rawDocName}`;
  const doctorFields = {
    logo: logoPreview || doctor?.logo || null,
    doctorName: formattedDoctorName,
    doctorDegree: formData.doctorDegree?.trim() || doctor?.doctorDegree || '',
    clinicName: formData.clinicName?.trim() || 'Your Clinic Name',
    phone: formData.contactnumber?.trim() || doctor?.contactnumber || '',
  };

  const carouselProps = {
    activeIndex: activePosterIndex,
    onIndexChange: setActivePosterIndex,
    mode: posterMode,
    onModeChange: setPosterMode,
    theme: selectedTheme,
    doctorFields,
    onPosterClick: () => setPreviewModalOpen(true),
  };

  const renderPosterBlob = async (poster, label) => {
    if (poster?.template === 'risk-factor') {
      return renderRiskFactorPosterBlob({
        ...doctorFields,
        theme: mapThemeToRiskFactor(selectedTheme?.id),
      });
    }
    return renderBlankPosterBlob(selectedTheme, label);
  };

  const handleGenerateAndDownload = async () => {
    try {
      setIsGenerating(true);
      setDownloadSuccess(false);

      if (activePosterContent?.kind === 'video' && activePosterContent?.videoUrl) {
        const cleanDocName = formattedDoctorName
          .replace(/[^a-zA-Z0-9_-]/g, '_')
          .replace(/_+/g, '_');
        const fileName = `Video_${cleanDocName}_${activePosterContent.id}.mp4`;
        
        const response = await fetch(activePosterContent.videoUrl);
        const videoBlob = await response.blob();
        const dataUrl = URL.createObjectURL(videoBlob);
        
        const link = document.createElement('a');
        link.download = fileName;
        link.href = dataUrl;
        link.click();
        URL.revokeObjectURL(dataUrl);

        if (onAutoSave) {
          onAutoSave(formData, logoFile, videoBlob, 'video').catch((err) => {
            console.warn('Auto save notice:', err);
          });
        }

        setIsGenerating(false);
        setDownloadMessage('Video downloaded.');
        setDownloadSuccess(true);
        setTimeout(() => setDownloadSuccess(false), 6000);
        return;
      }

      const label =
        activePosterContent?.kind === 'festival'
          ? activePosterContent.festivalName || 'Festival'
          : `Poster-${
              activePosterContent?.kind === 'festival'
                ? 1
                : Math.max(
                    1,
                    generalPosters.findIndex((p) => p.id === activePosterContent?.id) + 1
                  )
            }`;

      const posterBlob = await renderPosterBlob(activePosterContent, label);
      const dataUrl = URL.createObjectURL(posterBlob);

      const cleanDocName = formattedDoctorName
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .replace(/_+/g, '_');
      const posterLabel = activePosterContent?.id || 'poster';
      const fileName = `Poster_${cleanDocName}_${posterLabel}.jpg`;

      if (onAutoSave) {
        onAutoSave(formData, logoFile, posterBlob).catch((err) => {
          console.warn('Auto save notice:', err);
        });
      }

      const link = document.createElement('a');
      link.download = fileName;
      link.href = dataUrl;
      link.click();
      URL.revokeObjectURL(dataUrl);

      setIsGenerating(false);
      setDownloadMessage('Poster downloaded.');
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 6000);
    } catch (err) {
      console.error('Failed to render poster:', err);
      setIsGenerating(false);
      alert('Could not render poster. Please try again.');
    }
  };

  const handleDownloadZip = async () => {
    try {
      setIsGenerating(true);
      setDownloadSuccess(false);

      const zip = new JSZip();
      const cleanDocName = formattedDoctorName
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .replace(/_+/g, '_');

      const pack = getMonthlyPosters(new Date());
      let generalCounter = 0;
      for (let i = 0; i < pack.length; i += 1) {
        const poster = pack[i];
        if (poster.kind === 'video' && poster.videoUrl) {
          const response = await fetch(poster.videoUrl);
          const blob = await response.blob();
          zip.file(`${String(i + 1).padStart(2, '0')}_Video.mp4`, blob);
          continue;
        }

        const label =
          poster.kind === 'festival'
            ? poster.festivalName || 'Festival'
            : `Poster-${++generalCounter}`;
        const blob = await renderPosterBlob(poster, label);
        const safeLabel = label.replace(/[^a-zA-Z0-9_-]/g, '_');
        zip.file(`${String(i + 1).padStart(2, '0')}_${safeLabel}.jpg`, blob);
      }

      if (onAutoSave && pack[0]) {
        const firstBlob = await renderPosterBlob(
          pack[0],
          pack[0].kind === 'festival' ? pack[0].festivalName : 'Poster-1'
        );
        onAutoSave(formData, logoFile, firstBlob).catch(() => {});
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Posters_${cleanDocName}.zip`;
      link.click();
      URL.revokeObjectURL(url);

      setIsGenerating(false);
      setDownloadMessage(`Zip ready!`);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 6000);
    } catch (err) {
      console.error('Failed to build zip:', err);
      setIsGenerating(false);
      alert('Could not create zip. Please try again.');
    }
  };

  return (
    <section className={styles.containerWide} id="poster-studio-section">
      <nav className={styles.topStepper} aria-label="Poster setup steps">
        <div className={styles.progressTrack} aria-hidden="true">
          <div
            className={styles.progressFill}
            style={{ width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%` }}
          />
        </div>

        <div className={styles.stepRow} role="tablist">
          {STEPS.map((step) => {
            const active = currentStep === step.id;
            const complete = isStepComplete(step.id);

            return (
              <button
                key={step.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={`${styles.stepTab} ${active ? styles.stepTabActive : ''} ${complete ? styles.stepTabComplete : ''}`}
                onClick={() => {
                  if (checkCanNavigate(step.id)) setCurrentStep(step.id);
                }}
              >
                <span className={styles.stepNumber}>{complete ? '✓' : step.id}</span>
                <span className={styles.stepLabel}>{step.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <div className={styles.content}>
        {currentStep === 1 && (
          <div className={styles.stepContent}>
            <header className={styles.stepIntro}>
              <h2 className={styles.stepHeading}>Doctor details</h2>
            </header>

            {stepError && (
              <div className={styles.stepAlert} role="alert">
                <span>{stepError}</span>
              </div>
            )}

            <div className={styles.docFormCard}>
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel} htmlFor="step-doc-name">
                    Doctor full name <span className={styles.requiredStar}>*</span>
                  </label>
                  <input
                    id="step-doc-name"
                    type="text"
                    placeholder="e.g. Dr. Emily Watson"
                    className={styles.inputField}
                    value={formData.name}
                    onChange={(e) => {
                      setFormData?.((prev) => ({ ...prev, name: e.target.value }));
                      if (stepError) setStepError(null);
                    }}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel} htmlFor="step-doc-degree">
                    Doctor&apos;s degree <span className={styles.requiredStar}>*</span>
                  </label>
                  <input
                    id="step-doc-degree"
                    type="text"
                    placeholder="e.g. MBBS, MD (Medicine)"
                    className={styles.inputField}
                    value={formData.doctorDegree || ''}
                    onChange={(e) => {
                      setFormData?.((prev) => ({ ...prev, doctorDegree: e.target.value }));
                      if (stepError) setStepError(null);
                    }}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel} htmlFor="step-clinic-name">
                    Clinic / Hospital name <span className={styles.requiredStar}>*</span>
                  </label>
                  <input
                    id="step-clinic-name"
                    type="text"
                    placeholder="e.g. City Care Hospital"
                    className={styles.inputField}
                    value={formData.clinicName || ''}
                    onChange={(e) => {
                      setFormData?.((prev) => ({ ...prev, clinicName: e.target.value }));
                      if (stepError) setStepError(null);
                    }}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel} htmlFor="step-doc-contact">
                    WhatsApp contact number <span className={styles.requiredStar}>*</span>
                  </label>
                  <input
                    id="step-doc-contact"
                    type="tel"
                    placeholder="e.g. 919876543210"
                    className={styles.inputField}
                    value={formData.contactnumber}
                    onChange={(e) => {
                      setFormData?.((prev) => ({ ...prev, contactnumber: e.target.value }));
                      if (stepError) setStepError(null);
                    }}
                    required
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>
                  Doctor photo or clinic logo <span className={styles.requiredStar}>*</span>
                </label>

                <label className={styles.fileDrop} htmlFor="step-doc-logo">
                  <span className={styles.fileDropTitle}>Click to upload</span>
                  <input
                    id="step-doc-logo"
                    type="file"
                    accept="image/*"
                    className={styles.fileInput}
                    onChange={handleFileChange}
                  />
                </label>

                {logoPreview && (
                  <div className={styles.filePreviewWrap}>
                    <img src={logoPreview} alt="Doctor Logo Preview" className={styles.fileThumb} />
                    <div className={styles.fileDetails}>
                      <span className={styles.fileName}>{logoFile?.name || 'Selected logo'}</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleAdjustClick}
                      className={styles.primaryBtn}
                      style={{ marginRight: 8, padding: '4px 10px' }}
                    >
                      Adjust
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className={styles.primaryBtn}
                      style={{ padding: '4px 10px' }}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className={styles.navRow}>
              <div />
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={handleContinueToDesign}
                id="continue-to-design-button"
              >
                Continue to Design
              </button>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className={styles.stepContent}>
            <header className={styles.stepIntro}>
              <h2 className={styles.stepHeading}>Design</h2>
              <p className={styles.stepHint}>
                Pick a theme and review all posters. Hover a poster to enlarge it in place.
              </p>
            </header>

            <div className={styles.atelier}>
              <div className={styles.atelierBlock}>
                <div className={styles.atelierHeader}>
                  <h3 className={styles.atelierTitle}>Colour theme</h3>
                </div>

                <div className={styles.themeJewels} role="listbox" aria-label="Colour theme">
                  {POSTER_THEMES.map((theme) => {
                    const isSelected = theme.id === selectedThemeId;
                    return (
                      <button
                        key={theme.id}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        className={`${styles.themeJewel} ${isSelected ? styles.themeJewelActive : ''}`}
                        onClick={() => setSelectedThemeId(theme.id)}
                      >
                        <span
                          className={styles.jewelFace}
                          style={{
                            background: `linear-gradient(145deg, ${theme.headerBg}, ${theme.footerBg})`,
                            boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.18), 0 12px 28px ${theme.cardGlow}`,
                          }}
                        />
                        <span className={styles.jewelMeta}>
                          <span className={styles.jewelName}>{theme.name}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className={styles.selectionSummary}>
                <p className={styles.summaryValue}>{selectedTheme.name}</p>
              </div>
            </div>

            <div className={styles.designPreview}>
              <h3 className={styles.previewHeading}>Live preview</h3>
              <PosterCarousel key={selectedThemeId} variant="grid" {...carouselProps} />
            </div>

            <div className={styles.navRow}>
              <button type="button" className={styles.secondaryBtn} onClick={() => setCurrentStep(1)}>
                Back
              </button>
              
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                {downloadSuccess && (
                  <span style={{ color: '#4caf50', fontSize: 14, fontWeight: 500 }}>
                    {downloadMessage || 'Download complete.'}
                  </span>
                )}
                <button
                  type="button"
                  className={styles.primaryBtn}
                  onClick={handleDownloadZip}
                  disabled={isGenerating}
                >
                  {isGenerating ? 'Preparing ZIP…' : 'Download all posters as ZIP'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {showCropModal && originalLogoUrl && createPortal(
        <div
          style={{
            position: 'fixed', inset: 0, 
            background: 'rgba(255,255,255,0.05)',
            backdropFilter: 'blur(15px)',
            WebkitBackdropFilter: 'blur(15px)',
            zIndex: 999999,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '40px 20px',
          }}
          onClick={() => setShowCropModal(false)}
        >
          <div
            style={{
              position: 'relative',
              background: '#fff',
              padding: '24px',
              borderRadius: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              alignItems: 'center',
              boxShadow: '0 20px 50px rgba(0,0,0,0.2)',
              maxHeight: '85vh',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              style={{
                margin: 0,
                fontSize: '18px',
                color: '#14276b',
                fontFamily: '"Poppins", sans-serif',
              }}
            >
              Adjust Photo
            </h3>
            <LogoCanvas
              logoSrc={originalLogoUrl}
              initialState={logoCropState}
              onChange={(dataUrl, state) => {
                setCroppedLogoData(dataUrl);
                if (state) setTempLogoCropState(state);
              }}
            />
            <div
              style={{
                display: 'flex',
                gap: '12px',
                width: '100%',
                justifyContent: 'flex-end',
                marginTop: '8px',
              }}
            >
              <button
                type="button"
                onClick={() => setShowCropModal(false)}
                className={styles.primaryBtn}
                style={{ padding: '6px 16px', fontSize: '13px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyCrop}
                className={styles.primaryBtn}
                style={{ padding: '6px 16px', fontSize: '13px' }}
              >
                Apply
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Poster Preview Modal */}
      {previewModalOpen && createPortal(
        <div
          style={{
            position: 'fixed', inset: 0, 
            background: 'rgba(255,255,255,0.05)',
            backdropFilter: 'blur(15px)',
            WebkitBackdropFilter: 'blur(15px)',
            zIndex: 999999,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '40px 20px',
          }}
          onClick={() => setPreviewModalOpen(false)}
        >
          <div style={{ position: 'relative', height: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setPreviewModalOpen(false)}
              style={{ 
                position: 'absolute', top: -36, right: -40, background: 'none', border: 'none', 
                color: '#000', fontSize: 28, cursor: 'pointer', fontWeight: 'bold',
                textShadow: '0 2px 4px rgba(255,255,255,0.8)' 
              }}
            >
              ✕
            </button>
            
            <div style={{ height: '100%', minHeight: 0, aspectRatio: '9/16', overflow: 'hidden', borderRadius: 12, boxShadow: '0 20px 50px rgba(0,0,0,0.5)', position: 'relative' }}>
              <PosterPage
                poster={activePosterContent}
                label={activePosterContent?.id}
                pageStyle={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
                isCaptureTarget={false}
                theme={selectedTheme}
                doctorFields={doctorFields}
              />
            </div>

            <button
              type="button"
              className={styles.generateBtn}
              onClick={handleGenerateAndDownload}
              disabled={isGenerating}
              style={{ padding: '16px 24px', fontSize: 16 }}
            >
              {isGenerating ? 'Preparing…' : activePosterContent?.kind === 'video' ? 'Download this video' : 'Download this poster'}
            </button>
          </div>
        </div>,
        document.body
      )}
    </section>
  );
}
