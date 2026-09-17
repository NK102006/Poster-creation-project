// src/components/PosterGenerator.jsx
import { useState, useRef } from 'react';
import { POSTER_THERAPIES, POSTER_THEMES, DEFAULT_DOCTOR_LOGO, renderPosterToCanvas } from './Poster';
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
      setLogoPreview?.(URL.createObjectURL(file));
      if (stepError) setStepError(null);
    }
  };

  const handleRemoveLogo = () => {
    setLogoFile?.(null);
    setLogoPreview?.(null);
  };

  const handleContinueToDesign = () => {
    const hasLogo = Boolean(logoFile || logoPreview || doctor?.logo);

    if (!formData.name?.trim() || !formData.contactnumber?.trim()) {
      setStepError('Please enter all the details');
      return;
    }

    if (!hasLogo) {
      setStepError('Please upload a doctor photo or clinic logo before continuing.');
      return;
    }

    setStepError(null);
    setCurrentStep(2);
  };

  const checkCanNavigate = (targetStep) => {
    const hasLogo = Boolean(logoFile || logoPreview || doctor?.logo);

    if (targetStep > 1 && (!formData.name?.trim() || !formData.contactnumber?.trim())) {
      setStepError('Please enter both Doctor Name and WhatsApp Contact Number first.');
      return false;
    }

    if (targetStep > 1 && !hasLogo) {
      setStepError('Please upload a doctor photo or clinic logo before continuing.');
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
        dateText: todayFormatted,
      });

      const cleanDocName = formattedDoctorName
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .replace(/_+/g, '_');
      const fileName = `Poster_${selectedTherapy.name}_${cleanDocName}.jpg`;

      const posterBlob = await new Promise((resolve) => {
        canvas.toBlob(resolve, 'image/jpeg', 0.95);
      });

      if (onAutoSave) {
        onAutoSave(formData, logoFile, posterBlob).catch((err) => {
          console.warn('Auto save notice:', err);
        });
      }

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
                    Doctor full name <span className={styles.requiredStar}>*</span>
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
                    required
                  />
                </label>

                {logoPreview && (
                  <div className={styles.filePreviewWrap}>
                    <img src={logoPreview} alt="Doctor Logo Preview" className={styles.fileThumb} />
                    <div className={styles.fileDetails}>
                      <span className={styles.fileName}>{logoFile?.name || 'Selected logo'}</span>
                    </div>
                    <button type="button" onClick={handleRemoveLogo} className={styles.removeFileBtn}>
                      Remove
                    </button>
                  </div>
                )}

                <LogoCanvas logoSrc={logoPreview} />
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
              <div
                className={`${styles.posterContainer} ${getThemeClass(selectedThemeId)}`}
                style={{
                  '--poster-bg': selectedTheme.bgGradient,
                  '--poster-title': selectedTheme.textTitle,
                  '--poster-accent': selectedTheme.accentColor,
                  '--poster-highlight': selectedTheme.highlight || selectedTheme.accentColor,
                  '--poster-wash': selectedTheme.wash,
                  '--poster-wash-2': selectedTheme.washSecondary || selectedTheme.wash,
                  '--poster-leaf': selectedTheme.softLeaf,
                  '--poster-footer': selectedTheme.highlight || selectedTheme.headerBg,
                  '--poster-ribbon': selectedTheme.ribbon || selectedTheme.wash,
                }}
              >
                <div className={styles.posterDecor} aria-hidden="true">
                  <span className={`${styles.blob} ${styles.blobMain}`} />
                  <span className={`${styles.blob} ${styles.blobSoft}`} />
                  <span className={`${styles.leaf} ${styles.leafA}`} />
                  <span className={`${styles.leaf} ${styles.leafB}`} />
                  <span className={`${styles.leaf} ${styles.leafC}`} />
                </div>

                <div className={styles.posterTop}>
                  <div className={styles.posterDateRow}>
                    <span className={styles.dateIcon} aria-hidden="true" />
                    <span className={styles.posterDate}>{todayFormatted}</span>
                  </div>
                  <p className={styles.posterScript}>Small Steps Big Miracles ♡</p>
                </div>

                <div className={styles.posterLayout}>
                  <div className={styles.posterCopy}>
                    <h1 className={styles.posterTitle}>{selectedTherapy.title}</h1>
                    <p className={styles.posterTherapyLine}>
                      Expert Care in{' '}
                      <span>{selectedTherapy.therapyLabel || selectedTherapy.name}</span>
                    </p>
                    <p className={styles.posterPillars}>
                      {selectedTherapy.pillars || 'Science | Compassion | Care'}
                    </p>

                    <div className={styles.featureRow}>
                      {(selectedTherapy.features || []).map((feature) => (
                        <div key={feature.label} className={styles.featureItem}>
                          <span
                            className={styles.featureDot}
                            style={{ background: feature.color }}
                          />
                          <span className={styles.featureLabel}>{feature.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className={styles.posterPhotoCol}>
                    <div className={styles.photoGlow} aria-hidden="true" />
                    <div className={styles.posterPhotoFrame}>
                      <img src={activeLogo} alt="" className={styles.posterPhoto} />
                    </div>
                    <div className={styles.doctorNameCard}>
                      <div className={styles.doctorName}>{formattedDoctorName}</div>
                      <div className={styles.doctorRole}>Consultant Specialist</div>
                    </div>
                  </div>
                </div>

                <p className={styles.quoteRibbon}>
                  “{selectedTherapy.quote || 'Care that feels personal'} ♡”
                </p>

                <div className={styles.whatsappBlock}>
                  <span className={styles.whatsappBadge} aria-hidden="true">✆</span>
                  <div className={styles.whatsappText}>
                    <span className={styles.whatsappLabel}>Chat with us on WhatsApp</span>
                    <span className={styles.whatsappNumber}>{whatsappNumber}</span>
                  </div>
                </div>

                <p className={styles.infoStrip}>
                  Personalized Patient Education • Informative Health Posts • A Healthier Community Together
                </p>

                <div className={styles.posterFooterBar}>
                  HEALTHY FAMILIES • HAPPIER TOMORROWS
                </div>
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
    </section>
  );
}
