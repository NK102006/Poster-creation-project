// src/components/PosterGenerator.jsx
import { useState, useRef } from 'react';
import { toJpeg } from 'html-to-image';
import { POSTER_THERAPIES, POSTER_THEMES, DEFAULT_DOCTOR_LOGO } from './Poster';
import DoctorPoster from './DoctorPoster';
import LogoCanvas from './LogoCanvas';
import styles from './PosterGenerator.module.css';

const STEPS = [
  { id: 1, label: 'Doctor Details', short: 'Details' },
  { id: 2, label: 'Design', short: 'Design' },
  { id: 3, label: 'Preview', short: 'Preview' },
];

export default function PosterGenerator({
  formData = { name: '', contactnumber: '' },
  setFormData,
  logoFile = null,
  setLogoFile,
  logoPreview = null,
  setLogoPreview,
  onAutoSave,
  doctor = null,
}) {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedTherapyId, setSelectedTherapyId] = useState('cardio');
  const [selectedThemeId, setSelectedThemeId] = useState('theme-warm-red');
  const [isGenerating, setIsGenerating] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [stepError, setStepError] = useState(null);
  
  const [originalLogoUrl, setOriginalLogoUrl] = useState(null);
  const [showCropModal, setShowCropModal] = useState(false);
  const [croppedLogoData, setCroppedLogoData] = useState(null);

  const todayFormatted = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const canvasRef = useRef(null);

  const selectedTherapy =
    POSTER_THERAPIES.find((t) => t.id === selectedTherapyId) || POSTER_THERAPIES[0];
  const selectedTheme =
    POSTER_THEMES.find((t) => t.id === selectedThemeId) || POSTER_THEMES[0];
  const isStepComplete = (step) => currentStep > step;

  const handleSelectTherapy = (therapy) => {
    setSelectedTherapyId(therapy.id);
    setSelectedThemeId(therapy.recommendedTheme);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile?.(file);
      const url = URL.createObjectURL(file);
      setOriginalLogoUrl(url);
      setShowCropModal(true);
      if (stepError) setStepError(null);
    }
  };

  const handleRemoveLogo = () => {
    setLogoFile?.(null);
    setLogoPreview?.(null);
    setOriginalLogoUrl(null);
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
    }
    setShowCropModal(false);
  };

  const handleContinueToDesign = () => {
    const hasLogo = Boolean(logoFile || logoPreview);
    const hasName = Boolean(formData.name?.trim());
    const hasContact = Boolean(formData.contactnumber?.trim());

    if (!hasName || !hasContact || !hasLogo) {
      setStepError('Please fill in all three input fields (Name, Contact Number, and Logo) to proceed.');
      return;
    }

    setStepError(null);
    setCurrentStep(2);
  };

  const checkCanNavigate = (targetStep) => {
    const hasLogo = Boolean(logoFile || logoPreview);
    const hasName = Boolean(formData.name?.trim());
    const hasContact = Boolean(formData.contactnumber?.trim());

    if (targetStep > 1 && (!hasName || !hasContact || !hasLogo)) {
      setStepError('Please fill in all three input fields (Name, Contact Number, and Logo) to proceed.');
      return false;
    }

    if (targetStep > 2 && (!selectedTherapyId || !selectedThemeId)) {
      setStepError('Please choose a therapy and theme before previewing.');
      return false;
    }

    setStepError(null);
    return true;
  };

  const rawDocName = formData.name?.trim() || doctor?.name || 'Doctor Name';
  const formattedDoctorName = rawDocName.startsWith('Dr.') ? rawDocName : `Dr. ${rawDocName}`;
  const whatsappNumber = formData.contactnumber?.trim() || doctor?.contactnumber || 'Contact for Consultation';
  const activeLogo = logoPreview || doctor?.logo || DEFAULT_DOCTOR_LOGO;

  const getThemeClass = (id) => {
    switch (id) {
      case 'theme-warm-red':
        return styles.themeWarmRed;
      case 'theme-green':
        return styles.themeGreen;
      case 'theme-purple':
        return styles.themePurple;
      case 'theme-blue':
      default:
        return styles.themeBlue;
    }
  };

  const handleGenerateAndDownload = async () => {
    try {
      setIsGenerating(true);
      setDownloadSuccess(false);

      const node = document.getElementById('doctor-poster-capture');
      if (!node) throw new Error('Poster node not found');

      const dataUrl = await toJpeg(node, { quality: 0.95 });
      const posterBlob = await (await fetch(dataUrl)).blob();

      const cleanDocName = formattedDoctorName
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .replace(/_+/g, '_');
      const fileName = `Poster_${selectedTherapy.name}_${cleanDocName}.jpg`;

      if (onAutoSave) {
        onAutoSave(formData, logoFile, posterBlob).catch((err) => {
          console.warn('Auto save notice:', err);
        });
      }

      const link = document.createElement('a');
      link.download = fileName;
      link.href = dataUrl;
      link.click();

      setIsGenerating(false);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 6000);
    } catch (err) {
      console.error('Failed to render poster:', err);
      setIsGenerating(false);
      alert('Could not render poster. Please try again.');
    }
  };

  return (
    <section className={styles.container} id="poster-studio-section">
      <canvas ref={canvasRef} style={{ display: 'none' }} />

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
                    Doctor full name
                  </label>
                  <input
                    id="step-doc-name"
                    type="text"
                    placeholder="e.g. Dr. Emily Watson, MD"
                    className={styles.inputField}
                    value={formData.name}
                    onChange={(e) => {
                      setFormData?.((prev) => ({ ...prev, name: e.target.value }));
                      if (stepError) setStepError(null);
                    }}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel} htmlFor="step-doc-contact">
                    WhatsApp contact number
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
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>
                  Doctor photo or clinic logo
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
                    <button type="button" onClick={handleAdjustClick} className={styles.primaryBtn} style={{marginRight: 8, padding: '4px 10px'}}>
                      Adjust
                    </button>
                    <button type="button" onClick={handleRemoveLogo} className={styles.primaryBtn} style={{padding: '4px 10px'}}>
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
                id="continue-to-therapy-button"
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
            </header>

            <div className={styles.atelier}>
              <div className={styles.atelierBlock}>
                <div className={styles.atelierHeader}>
                  <h3 className={styles.atelierTitle}>Therapy area</h3>
                </div>

                <div className={styles.therapyOrbit} role="listbox" aria-label="Therapy area">
                  {POSTER_THERAPIES.map((item, index) => {
                    const isSelected = item.id === selectedTherapyId;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        className={`${styles.therapyTile} ${isSelected ? styles.therapyTileActive : ''}`}
                        style={{ '--tile-delay': `${index * 40}ms` }}
                        onClick={() => handleSelectTherapy(item)}
                      >
                        <span className={styles.therapyGlow} aria-hidden="true" />
                        <span className={styles.therapyIcon}>{item.icon}</span>
                        <span className={styles.therapyName}>{item.name}</span>
                        {isSelected && <span className={styles.selectedMark}>Selected</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className={styles.atelierDivider} aria-hidden="true">
                <span />
              </div>

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
                <p className={styles.summaryValue}>
                  {selectedTherapy.name}
                  <span aria-hidden="true"> · </span>
                  {selectedTheme.name}
                </p>
              </div>
            </div>

            <div className={styles.navRow}>
              <button type="button" className={styles.secondaryBtn} onClick={() => setCurrentStep(1)}>
                Back
              </button>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={() => {
                  if (checkCanNavigate(3)) setCurrentStep(3);
                }}
              >
                Preview poster
              </button>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className={styles.stepContent}>
            <header className={styles.stepIntro}>
              <h2 className={styles.stepHeading}>Preview</h2>
            </header>

            <div className={styles.previewStage}>
              <div style={{ display: 'flex', justifyContent: 'center', width: '100%', zoom: 0.8 }}>
                <DoctorPoster
                  doctorName={formattedDoctorName}
                  credentials="Consultant Specialist"
                  therapyName={selectedTherapy.therapyLabel || selectedTherapy.name}
                  photo={activeLogo}
                  date={todayFormatted}
                  whatsapp={whatsappNumber}
                  theme={selectedTheme}
                />
              </div>

              <div className={styles.previewActions}>
                {downloadSuccess && (
                  <div className={styles.successAlert} role="status">
                    Poster downloaded successfully.
                  </div>
                )}

                <button
                  type="button"
                  className={styles.generateBtn}
                  onClick={handleGenerateAndDownload}
                  disabled={isGenerating}
                  id="generate-download-poster-button"
                >
                  {isGenerating ? 'Rendering…' : 'Generate & download JPG'}
                </button>
              </div>
            </div>

            <div className={styles.navRow}>
              <button type="button" className={styles.secondaryBtn} onClick={() => setCurrentStep(2)}>
                Back to Design
              </button>
              <div />
            </div>
          </div>
        )}
      </div>

      {showCropModal && originalLogoUrl && (
        <div style={{position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <div style={{background: '#fff', padding: '24px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.15)'}}>
            <h3 style={{margin: 0, fontSize: '18px', color: '#14276b', fontFamily: '"Poppins", sans-serif'}}>Adjust Photo</h3>
            <LogoCanvas 
              logoSrc={originalLogoUrl} 
              onChange={(dataUrl) => setCroppedLogoData(dataUrl)} 
            />
            <div style={{display: 'flex', gap: '12px', width: '100%', justifyContent: 'flex-end', marginTop: '8px'}}>
              <button type="button" onClick={() => setShowCropModal(false)} className={styles.primaryBtn} style={{padding: '6px 16px', fontSize: '13px'}}>Cancel</button>
              <button type="button" onClick={handleApplyCrop} className={styles.primaryBtn} style={{padding: '6px 16px', fontSize: '13px'}}>Apply</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
