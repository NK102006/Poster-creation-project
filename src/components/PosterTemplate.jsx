import React, { forwardRef } from 'react';
import styles from './PosterTemplate.module.css';

// ─── Default Doctor Logo (SVG placeholder) ───────────────────────────────────
export const DEFAULT_DOCTOR_LOGO = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 120" width="240" height="120">
  <rect width="240" height="120" rx="10" fill="#ffffff"/>
  <g transform="translate(18, 20)">
    <circle cx="40" cy="40" r="36" fill="#0056b3" fill-opacity="0.1" stroke="#0056b3" stroke-width="3"/>
    <path d="M40 22 V58 M22 40 H58" stroke="#0056b3" stroke-width="7" stroke-linecap="round"/>
    <circle cx="40" cy="40" r="7" fill="#28a745"/>
  </g>
  <text x="104" y="52" font-family="'Segoe UI', Roboto, sans-serif" font-weight="800" font-size="24" fill="#0f2942">MEDICAL</text>
  <text x="104" y="76" font-family="'Segoe UI', Roboto, sans-serif" font-weight="700" font-size="13" fill="#007bff" letter-spacing="3">CLINIC +</text>
</svg>
`)}`;

export const POSTER_THEMES = [
  {
    id: 'theme-blue',
    name: 'Cool Blue',
    headerBg: '#1565C0',
    titleColors: ['#1565C0', '#00897B', '#2E7D32'],
    footerGradient: ['#E91E63', '#AD1457'],
    watercolorAccent: '#F8BBD0',
  },
  {
    id: 'theme-warm-red',
    name: 'Warm Red',
    headerBg: '#c62828',
    titleColors: ['#c62828', '#d32f2f', '#e53935'],
    footerGradient: ['#c62828', '#880E4F'],
    watercolorAccent: '#FFCDD2',
  },
  {
    id: 'theme-green',
    name: 'Emerald Green',
    headerBg: '#2E7D32',
    titleColors: ['#1B5E20', '#2E7D32', '#00695C'],
    footerGradient: ['#2E7D32', '#00695C'],
    watercolorAccent: '#C8E6C9',
  },
  {
    id: 'theme-purple',
    name: 'Royal Purple',
    headerBg: '#4A148C',
    titleColors: ['#4A148C', '#6A1B9A', '#7B1FA2'],
    footerGradient: ['#6A1B9A', '#AD1457'],
    watercolorAccent: '#E1BEE7',
  },
];

export const POSTER_THERAPIES = [
  {
    id: 'infertility',
    name: 'Infertility',
    badge: 'INFERTILITY',
    icon: '🌸',
    title: 'Guiding Hope, Nurturing Life',
    subtitle: 'Comprehensive fertility care and reproductive health guidance.',
    recommendedTheme: 'theme-blue',
  },
  {
    id: 'diabetes',
    name: 'Diabetes',
    badge: 'DIABETES',
    icon: '🩸',
    title: 'Mastering Diabetes, Empowering Life',
    subtitle: 'Simple steps today, healthier balance tomorrow.',
    recommendedTheme: 'theme-blue',
  },
  {
    id: 'cardio',
    name: 'Cardio',
    badge: 'CARDIO',
    icon: '❤️',
    title: 'Take Care of Your Heart',
    subtitle: 'Simple steps today, healthier beats tomorrow.',
    recommendedTheme: 'theme-warm-red',
  },
  {
    id: 'hypertension',
    name: 'Hypertension',
    badge: 'HYPERTENSION',
    icon: '🩺',
    title: 'Control Your Blood Pressure',
    subtitle: 'Proactive care today, a stronger and safer tomorrow.',
    recommendedTheme: 'theme-green',
  },
];

const POSTER_CONTENT = {
  infertility: {
    titleWords: ['Hope', 'Grows', 'Here'],
    expertLine: 'Expert Care in',
    treatmentLine: 'Infertility Treatment',
    tagline: 'Science   |   Compassion   |   New Beginnings',
    features: [
      { emoji: '❤️', bg: '#FCE4EC', border: '#E91E63', label: ['Personalized', 'Treatment Plans'] },
      { emoji: '🔬', bg: '#F3E5F5', border: '#9C27B0', label: ['Advanced', 'Fertility Solutions'] },
      { emoji: '👥', bg: '#E8F5E9', border: '#4CAF50', label: ['Support', 'at Every Step'] },
    ],
    specialty: ['Consultant in Reproductive Medicine', '& Infertility Specialist'],
    handwrittenTop: ['Small Steps', 'Big Miracles ♡'],
    handwrittenQuote: ['Because every family', '  has a story worth waiting for ♡'],
    handwrittenCorner: ['New Hope', 'Brighter Tomorrows ♡'],
    footerText: 'HEALTHY  FAMILIES   •   HAPPIER  TOMORROWS',
    infoBar: '🩺  Personalized Patient Education   •   Informative Health Posts   •   A Healthier Community Together',
  },
  diabetes: {
    titleWords: ['Life', 'In', 'Balance'],
    expertLine: 'Expert Care in',
    treatmentLine: 'Diabetes Management',
    tagline: 'Monitor   |   Manage   |   Thrive',
    features: [
      { emoji: '🩸', bg: '#FFF3E0', border: '#FF9800', label: ['Blood Sugar', 'Monitoring'] },
      { emoji: '🥗', bg: '#E8F5E9', border: '#4CAF50', label: ['Diet &', 'Lifestyle Plans'] },
      { emoji: '👨‍⚕️', bg: '#E3F2FD', border: '#2196F3', label: ['Expert', 'Guidance'] },
    ],
    specialty: ['Consultant Endocrinologist', '& Diabetes Specialist'],
    handwrittenTop: ['Small Changes', 'Big Results ♡'],
    handwrittenQuote: ['Because your health', '  is your greatest wealth ♡'],
    handwrittenCorner: ['Healthy Living', 'Starts Here ♡'],
    footerText: 'HEALTHY  LIVING   •   BRIGHTER  FUTURES',
    infoBar: '🩺  Personalized Patient Education   •   Informative Health Posts   •   A Healthier Community Together',
  },
  cardio: {
    titleWords: ['Heart', 'Beats', 'Strong'],
    expertLine: 'Expert Care in',
    treatmentLine: 'Cardiac Health',
    tagline: 'Prevention   |   Care   |   Recovery',
    features: [
      { emoji: '❤️', bg: '#FCE4EC', border: '#E91E63', label: ['Heart', 'Health Checks'] },
      { emoji: '🫀', bg: '#FFEBEE', border: '#F44336', label: ['Advanced', 'Cardiac Care'] },
      { emoji: '🏃', bg: '#E8F5E9', border: '#4CAF50', label: ['Lifestyle', 'Guidance'] },
    ],
    specialty: ['Consultant Cardiologist', '& Cardiac Care Specialist'],
    handwrittenTop: ['Every Beat', 'Matters ♡'],
    handwrittenQuote: ['Because a healthy heart', '  means a happy life ♡'],
    handwrittenCorner: ['Strong Heart', 'Happy Life ♡'],
    footerText: 'STRONG  HEARTS   •   HEALTHY  LIVES',
    infoBar: '🩺  Personalized Patient Education   •   Informative Health Posts   •   A Healthier Community Together',
  },
  hypertension: {
    titleWords: ['Calm', 'Flow', 'Within'],
    expertLine: 'Expert Care in',
    treatmentLine: 'Hypertension Control',
    tagline: 'Monitor   |   Control   |   Live Well',
    features: [
      { emoji: '🩺', bg: '#E3F2FD', border: '#2196F3', label: ['Blood Pressure', 'Management'] },
      { emoji: '💊', bg: '#F3E5F5', border: '#9C27B0', label: ['Personalized', 'Medication'] },
      { emoji: '🧘', bg: '#E8F5E9', border: '#4CAF50', label: ['Stress', 'Reduction'] },
    ],
    specialty: ['Consultant Physician', '& Hypertension Specialist'],
    handwrittenTop: ['Steady Flow', 'Healthy Glow ♡'],
    handwrittenQuote: ['Because peace of mind', '  starts with healthy numbers ♡'],
    handwrittenCorner: ['Stay Calm', 'Stay Healthy ♡'],
    footerText: 'BALANCED  PRESSURE   •   BALANCED  LIFE',
    infoBar: '🩺  Personalized Patient Education   •   Informative Health Posts   •   A Healthier Community Together',
  },
};

const PosterTemplate = forwardRef(({ themeId, therapyId, doctor, dateText, className }, ref) => {
  const theme = POSTER_THEMES.find((t) => t.id === themeId) || POSTER_THEMES[0];
  const therapy = POSTER_THERAPIES.find((t) => t.id === therapyId) || POSTER_THERAPIES[0];
  const content = POSTER_CONTENT[therapy.id] || POSTER_CONTENT.infertility;
  
  const dateStr = dateText || new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const docName = doctor?.name || 'Doctor Name';
  const docPhone = doctor?.contactnumber ? String(doctor.contactnumber) : '+91 98765 43210';
  const logoUrl = doctor?.logo || DEFAULT_DOCTOR_LOGO;

  return (
    <div className={`${styles.previewWrap} ${className || ''}`}>
      <div className={styles.scaleInner}>
        <div 
          ref={ref} 
        className={styles.poster}
        style={{
          '--watercolor-accent': theme.watercolorAccent,
          '--title-color-1': theme.titleColors[0],
          '--title-color-2': theme.titleColors[1],
          '--title-color-3': theme.titleColors[2],
          '--footer-grad-1': theme.footerGradient[0],
          '--footer-grad-2': theme.footerGradient[1],
        }}
      >
        {/* Watercolor Backgrounds */}
        <div className={styles.bgBlob1} />
        <div className={styles.bgBlob2} />
        <div className={styles.bgBlob3} />

        {/* Decorative Hearts */}
        <div className={styles.heartDecor1}>♥</div>
        <div className={styles.heartDecor2}>♥</div>

        {/* Header */}
        <header className={styles.header}>
          <div className={styles.datePill}>
            <svg className={styles.calendarIcon} viewBox="0 0 24 24" fill="none" stroke="#1565C0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            {dateStr}
          </div>
          <div className={styles.handwrittenTop}>
            <span>{content.handwrittenTop[0]}</span>
            <span>{content.handwrittenTop[1]}</span>
          </div>
          <div className={styles.brandLogo}>
            <div className={styles.brandIcon}>
              <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="15" y="0" width="30" height="60" rx="4" fill="#1565C0" />
                <rect x="0" y="15" width="60" height="30" rx="4" fill="#1565C0" />
                <path d="M45 -5 C 55 -20, 80 -15, 75 5 C 70 15, 50 10, 45 -5 Z" fill="#2E7D32" />
              </svg>
            </div>
            <span className={styles.brandTitle}>YOUR HEALTH</span>
            <span className={styles.brandSubtitle}>OUR PRIORITY</span>
          </div>
        </header>

        {/* Main Content */}
        <div className={styles.mainContent}>
          <div className={styles.leftColumn}>
            <div className={styles.titleBlock}>
              <h1 className={styles.titleWord1}>{content.titleWords[0]}</h1>
              <div className={styles.titleWord2Row}>
                <h1 className={styles.titleWord2}>{content.titleWords[1]}</h1>
                <svg className={styles.leafStem} viewBox="0 0 40 80">
                  <path d="M10,80 Q30,40 25,0" fill="none" stroke="#2E7D32" strokeWidth="4" />
                  <path d="M22,30 C35,20 40,25 35,35 C30,45 20,40 22,30 Z" fill="#4CAF50" />
                  <path d="M15,15 C0,10 -5,20 5,25 C15,30 20,20 15,15 Z" fill="#2E7D32" />
                </svg>
              </div>
              <h1 className={styles.titleWord3}>{content.titleWords[2]}</h1>
            </div>

            <h2 className={styles.expertLine}>{content.expertLine}</h2>
            <h3 className={styles.treatmentLine}>
              <span className={styles.treatmentHighlight}>{content.treatmentLine}</span>
            </h3>
            <p className={styles.tagline}>{content.tagline}</p>

            <div className={styles.features}>
              {content.features.map((feat, idx) => (
                <div key={idx} className={styles.featureItem}>
                  <div className={styles.featureCircle} style={{ background: feat.bg, borderColor: feat.border }}>
                    {feat.emoji}
                  </div>
                  <div className={styles.featureLabel}>
                    {feat.label.map((line, lidx) => (
                      <span key={lidx}>{line}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.rightColumn}>
            {/* Mother-Child Silhouette Graphic */}
            <div className={styles.motherChildGraphic}>
              <svg viewBox="0 0 200 250" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M90 240 C30 240, 0 180, 10 120 C20 70, 70 30, 110 30 C150 30, 180 70, 180 120 C180 180, 150 240, 90 240 Z" fill="#FCE4EC" />
                <path d="M110 40 C75 40, 45 70, 45 120 C45 160, 65 190, 95 210 C105 216, 120 216, 130 210 C160 190, 175 160, 175 120 C175 70, 145 40, 110 40 Z" fill="#F8BBD0" />
                {/* Silhouette profiles */}
                <path d="M60 130 C60 100, 75 70, 105 70 C125 70, 140 85, 140 105 C140 120, 125 130, 115 130 C110 130, 105 135, 105 140 L105 150 C105 170, 85 190, 60 190 L60 130 Z" fill="#F48FB1" />
                <path d="M125 145 C125 130, 140 115, 155 115 C165 115, 175 125, 175 135 C175 145, 165 155, 155 155 L150 155 L150 165 C150 175, 140 185, 125 185 L125 145 Z" fill="#F48FB1" />
              </svg>
            </div>

            <div className={styles.doctorPhotoWrap}>
              <img src={logoUrl} alt="Doctor" className={styles.doctorPhoto} />
            </div>
            <div className={styles.nameplate}>
              <h3 className={styles.nameplateTitle}>{docName}</h3>
              {content.specialty.map((spec, idx) => (
                <p key={idx} className={styles.nameplateSubtitle}>{spec}</p>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.quoteBlock}>
          <div className={styles.quoteHighlight}>
            <p className={styles.quoteLine}>{content.handwrittenQuote[0]}</p>
            <p className={styles.quoteLine}>&nbsp;&nbsp;{content.handwrittenQuote[1]}</p>
          </div>
        </div>

        <div className={styles.contactRow}>
          <div className={styles.whatsappSection}>
            <div className={styles.whatsappIcon}>📞</div>
            <div>
              <p className={styles.whatsappLabel}>Chat with us on WhatsApp</p>
              <p className={styles.whatsappNumber}>{docPhone}</p>
            </div>
          </div>
          <div className={styles.cornerQuote}>
            <div className={styles.cornerLine1}>{content.handwrittenCorner[0]}</div>
            <div className={styles.cornerLine2}>{content.handwrittenCorner[1]}</div>
          </div>
        </div>

        <div className={styles.infoBar}>
          <span className={styles.megaphone}>📣</span>
          {content.infoBar}
        </div>

        {/* Botanical Leaves at bottom */}
        <div className={styles.botanicalLeft} />
        <div className={styles.botanicalRight} />

        <footer className={styles.footer}>
          <span className={styles.footerText}>{content.footerText}</span>
        </footer>
      </div>
      </div>
    </div>
  );
});

export default PosterTemplate;
