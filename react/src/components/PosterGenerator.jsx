// src/components/PosterGenerator.jsx
import { useState, useRef } from 'react';
import { POSTER_THERAPIES, POSTER_THEMES, DEFAULT_DOCTOR_LOGO, renderPosterToCanvas } from './Poster';
import styles from './PosterGenerator.module.css';

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

  // Automatic today's date formatted (e.g. "SEP 11, 2026")
  const todayFormatted = new Date()
    .toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
    .toUpperCase();

  const canvasRef = useRef(null);

  const selectedTherapy =
    POSTER_THERAPIES.find((t) => t.id === selectedTherapyId) || POSTER_THERAPIES[0];
  const selectedTheme =
    POSTER_THEMES.find((t) => t.id === selectedThemeId) || POSTER_THEMES[0];
  const isStepComplete = (step) => currentStep > step;

  // Whenever user changes therapy, suggest the recommended theme
  const handleSelectTherapy = (therapy) => {
    setSelectedTherapyId(therapy.id);
    setSelectedThemeId(therapy.recommendedTheme);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile?.(file);
      setLogoPreview?.(URL.createObjectURL(file));
      if (stepError) setStepError(null);
    }
  };

  const handleRemoveLogo = () => {
    setLogoFile?.(null);
    setLogoPreview?.(null);
  };

  const handleContinueToTherapy = () => {
    if (!formData.name?.trim() || !formData.contactnumber?.trim()) {
      setStepError('Please enter both Doctor Name and WhatsApp Contact Number to continue.');
      return;
    }
    setStepError(null);
    setCurrentStep(2);
  };

  const checkCanNavigate = (targetStep) => {
    if (targetStep > 1 && (!formData.name?.trim() || !formData.contactnumber?.trim())) {
      setStepError('Please enter both Doctor Name and WhatsApp Contact Number first.');
      return false;
    }
    setStepError(null);
    return true;
  };

  const rawDocName = formData.name?.trim() || doctor?.name || 'Doctor Name';
  const formattedDoctorName = rawDocName.startsWith('Dr.') ? rawDocName : `Dr. ${rawDocName}`;
  const whatsappNumber = formData.contactnumber?.trim() || doctor?.contactnumber || 'Contact for Consultation';
  const activeLogo = logoPreview || doctor?.logo || DEFAULT_DOCTOR_LOGO;

  // Map theme id to CSS module class
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

  // High-Resolution Generate & Download Handler
  const handleGenerateAndDownload = async () => {
    try {
      setIsGenerating(true);
      setDownloadSuccess(false);

      const canvas = canvasRef.current || document.createElement('canvas');

      await renderPosterToCanvas(canvas, {
        themeId: selectedThemeId,
        therapyId: selectedTherapyId,
        doctor: {
          name: formattedDoctorName,
          contactnumber: whatsappNumber,
          logo: activeLogo,
        },
        customTitle: selectedTherapy.title,
        customSubtitle: selectedTherapy.subtitle,
        dateText: todayFormatted,
      });

      const cleanDocName = formattedDoctorName
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .replace(/_+/g, '_');
      const fileName = `Poster_${selectedTherapy.name}_${cleanDocName}.jpg`;

      // Create high-res poster Blob for MongoDB database storage
      const posterBlob = await new Promise((resolve) => {
        canvas.toBlob(resolve, 'image/jpeg', 0.95);
      });

      // Automatically trigger background save of doctor details AND poster in database upon download
      if (onAutoSave) {
        onAutoSave(formData, logoFile, posterBlob).catch((err) => {
          console.warn('Auto save notice:', err);
        });
      }

      // Download poster
      try {
        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
        const link = document.createElement('a');
        link.style.display = 'none';
        link.setAttribute('href', dataUrl);
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();

        setTimeout(() => {
          if (link.parentNode) {
            link.parentNode.removeChild(link);
          }
        }, 1000);

        setIsGenerating(false);
        setDownloadSuccess(true);
        setTimeout(() => setDownloadSuccess(false), 6000);
      } catch (dataErr) {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              setIsGenerating(false);
              alert('Could not render poster. Please try again.');
              return;
            }

            const objectUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.style.display = 'none';
            link.href = objectUrl;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();

            setTimeout(() => {
              URL.revokeObjectURL(objectUrl);
              if (link.parentNode) {
                link.parentNode.removeChild(link);
              }
            }, 1000);

            setIsGenerating(false);
            setDownloadSuccess(true);
            setTimeout(() => setDownloadSuccess(false), 6000);
          },
          'image/jpeg',
          0.95
        );
      }
    } catch (err) {
      console.error('Failed to render poster:', err);
      setIsGenerating(false);
      alert('Could not render poster. Please try again.');
    }
  };

  return (
    <section className={styles.container} id="poster-studio-section">
      {/* Hidden canvas for high-resolution 1200x1500 poster generation */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      <div className={styles.shell}>
        <aside className={styles.sidebar} aria-label="Poster setup steps">
          <div className={styles.stepper} role="tablist">
            <button
              type="button"
              className={`${styles.stepTab} ${currentStep === 1 ? styles.stepTabActive : ''} ${isStepComplete(1) ? styles.stepTabComplete : ''}`}
              onClick={() => setCurrentStep(1)}
            >
              <span className={styles.stepNumber}>{isStepComplete(1) ? '✓' : '1'}</span>
              <span>Doctor Details</span>
            </button>

            <button
              type="button"
              className={`${styles.stepTab} ${currentStep === 2 ? styles.stepTabActive : ''} ${isStepComplete(2) ? styles.stepTabComplete : ''}`}
              onClick={() => {
                if (checkCanNavigate(2)) setCurrentStep(2);
              }}
            >
              <span className={styles.stepNumber}>{isStepComplete(2) ? '✓' : '2'}</span>
              <span>Select Therapy</span>
            </button>

            <button
              type="button"
              className={`${styles.stepTab} ${currentStep === 3 ? styles.stepTabActive : ''} ${isStepComplete(3) ? styles.stepTabComplete : ''}`}
              onClick={() => {
                if (checkCanNavigate(3)) setCurrentStep(3);
              }}
            >
              <span className={styles.stepNumber}>{isStepComplete(3) ? '✓' : '3'}</span>
              <span>Select Theme</span>
            </button>

          </div>
        </aside>

        <div className={styles.content}>
          {/* STEP 1: Enter Doctor Details */}
          {currentStep === 1 && (
            <div className={styles.stepContent}>
          {stepError && (
            <div className={styles.stepAlert} role="alert">
              <span>⚠️</span>
              <span>{stepError}</span>
            </div>
          )}

          <div className={styles.docFormCard}>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="step-doc-name">
                  Doctor Full Name <span className={styles.requiredStar}>*</span>
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
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="step-doc-contact">
                  WhatsApp Contact Number <span className={styles.requiredStar}>*</span>
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
                Doctor Photo or Clinic Logo <span className={styles.optionalTag}>(Optional)</span>
              </label>

              <label className={styles.fileDrop} htmlFor="step-doc-logo">
                <span className={styles.fileDropTitle}>📷 Click to upload photo or logo</span>
                <p className={styles.fileDropText}>Supports PNG, JPG, WEBP formats</p>
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
                    <span className={styles.fileName}>{logoFile?.name || 'Selected Doctor Logo'}</span>
                    <span className={styles.fileHint}>Will be embedded on all generated posters</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className={styles.removeFileBtn}
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
              onClick={handleContinueToTherapy}
              id="continue-to-therapy-button"
            >
              Continue to Select Therapy →
            </button>
          </div>
        </div>
      )}

          {/* STEP 2: Select Therapy */}
          {currentStep === 2 && (
            <div className={styles.stepContent}>
          <div className={styles.therapyGrid}>
            {POSTER_THERAPIES.map((item) => {
              const isSelected = item.id === selectedTherapyId;
              return (
                <div
                  key={item.id}
                  className={`${styles.therapyCard} ${isSelected ? styles.therapyCardActive : ''}`}
                  onClick={() => handleSelectTherapy(item)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleSelectTherapy(item)}
                >
                  <span className={styles.therapyIcon}>{item.icon}</span>
                  <h4 className={styles.therapyTitle}>{item.name}</h4>
                  {isSelected && <span className={styles.activeCheck}>✓</span>}
                </div>
              );
            })}
          </div>

          <div className={styles.navRow}>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => setCurrentStep(1)}
            >
              ← Back to Doctor Details
            </button>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={() => setCurrentStep(3)}
            >
              Continue to Select Theme →
            </button>
          </div>
        </div>
      )}

          {/* STEP 3: Select Theme */}
          {currentStep === 3 && (
            <div className={styles.stepContent}>
              <div className={styles.themeGrid}>
                {POSTER_THEMES.map((theme) => {
                  const isSelected = theme.id === selectedThemeId;
                  return (
                    <div
                      key={theme.id}
                      className={`${styles.themeCard} ${isSelected ? styles.themeCardActive : ''}`}
                      onClick={() => setSelectedThemeId(theme.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && setSelectedThemeId(theme.id)}
                    >
                      <div className={styles.themePalette}>
                        <div className={styles.paletteSlice} style={{ background: theme.headerBg }} />
                      </div>
                      <div className={styles.themeMeta}>
                        <h5 className={styles.themeName}>{theme.name}</h5>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className={styles.previewLayout}>
                <div className={styles.mockupColumn}>
                  <div className={`${styles.posterContainer} ${getThemeClass(selectedThemeId)}`}>
                    <div className={styles.posterOverlay}></div>
                    <div className={styles.posterHeader}>
                      <div className={styles.doctorLogo}>
                        <img src={activeLogo} alt="Doctor Logo" />
                      </div>
                      <div className={styles.posterDate}>DATE: {todayFormatted}</div>
                    </div>

                    <div className={styles.posterBody}>
                      <div className={styles.therapyType}>
                        THERAPY TYPE: {selectedTherapy.badge}
                      </div>
                      <h1 className={styles.posterTitle}>{selectedTherapy.title}</h1>
                      <p className={styles.posterSubtitle}>{selectedTherapy.subtitle}</p>
                    </div>

                    <div className={styles.posterFooter}>
                      <div className={styles.doctorInfo}>
                        <div className={styles.doctorName}>{formattedDoctorName}</div>
                        <div className={styles.doctorTitle}>Consultant Specialist</div>
                      </div>

                      <div className={styles.doctorWhatsapp}>
                        <span className={styles.whatsappIcon}>📞</span> {whatsappNumber}
                      </div>
                    </div>
                  </div>
                </div>

                <div className={styles.controlColumn}>
                  <div className={styles.actionCard}>
                    <h4 className={styles.actionTitle}>Generate JPG Poster</h4>

                    {downloadSuccess && (
                      <div className={styles.successAlert} role="status">
                        <span>✅</span>
                        <span>Poster successfully downloaded! Changes automatically saved.</span>
                      </div>
                    )}

                    <button
                      type="button"
                      className={styles.generateBtn}
                      onClick={handleGenerateAndDownload}
                      disabled={isGenerating}
                      id="generate-download-poster-button"
                    >
                      <span>{isGenerating ? 'Rendering & Saving…' : '⬇ Generate & Download JPG Poster'}</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className={styles.navRow}>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => setCurrentStep(2)}
                >
                  ← Back to Therapy
                </button>
                <div />
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
