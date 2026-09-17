import React from "react";

/**
 * DoctorPoster
 * -------------------------------------------------------
 * Recreation of the "Hope Grows Here" infertility-treatment
 * poster. Everything except the doctor's photo, name,
 * credentials line and the therapy/treatment name is fixed
 * design — exactly like the original artwork.
 *
 * Usage:
 * <DoctorPoster
 *    doctorName="Dr. Ananya Mehta"
 *    credentials="Consultant in Reproductive Medicine & Infertility Specialist"
 *    therapyName="Infertility Treatment"
 *    photo="/images/dr-ananya.jpg"
 *    date="25 April 2025"
 *    whatsapp="+91 98765 43210"
 * />
 */

const FontImports = () => (
  <>
    <link
      rel="preconnect"
      href="https://fonts.googleapis.com"
    />
    <link
      href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&family=Caveat:wght@600;700&display=swap"
      rel="stylesheet"
    />
  </>
);

export default function DoctorPoster({
  doctorName = "Dr. Ananya Mehta",
  credentials = "Consultant Specialist",
  therapyName = "Infertility Treatment",
  photo,
  date = "25 April 2025",
  whatsapp = "+91 98765 43210",
  clinicName = "YOUR HEALTH",
  clinicTagline = "OUR PRIORITY",
  theme,
}) {
  const styles = getStyles(theme);
  return (
    <div style={styles.page}>
      <FontImports />

      <div style={styles.poster} id="doctor-poster-capture">
        {/* ---------- decorative background blobs ---------- */}
        <div style={styles.bgWash} />
        <div style={styles.pinkBlob} />

        {/* ---------- top bar ---------- */}
        <div style={styles.topBar}>
          <div style={styles.dateChip}>
            <CalendarIcon />
            <span style={styles.dateText}>{date}</span>
          </div>

          <div style={styles.clinicBrand}>
            <LogoMark />
            <div style={styles.clinicNameWrap}>
              <span style={styles.clinicName}>{clinicName}</span>
              <span style={styles.clinicTagline}>{clinicTagline}</span>
            </div>
          </div>
        </div>

        <div style={styles.scriptTopRight}>
          Small Steps
          <br />
          Big Miracles <HeartGlyph color="#e0507e" size={16} />
        </div>

        {/* ---------- headline ---------- */}
        <div style={styles.headlineBlock}>
          <h1 style={styles.headlineNavy}>Hope</h1>
          <h1 style={{ ...styles.headlineTeal, position: "relative", width: "fit-content" }}>
            Grows
            <LeafGlyph style={styles.leafOnGrows} />
          </h1>
          <h1 style={styles.headlineNavy}>Here</h1>
        </div>

        {/* ---------- subheading ---------- */}
        <div style={styles.subheadBlock}>
          <p style={styles.subheadLine}>Expert Care in</p>
          <p style={styles.subheadTherapy}>{therapyName}</p>
          <p style={styles.subheadTags}>
            Science&nbsp;&nbsp;|&nbsp;&nbsp;Compassion&nbsp;&nbsp;|&nbsp;&nbsp;New
            Beginnings
          </p>
        </div>

        {/* ---------- feature icons row ---------- */}
        <div style={styles.featureRow}>
          <Feature
            color={theme?.highlight || "#e8608f"}
            label={["Personalized", "Treatment Plans"]}
            icon={<HeartsIcon />}
            styles={styles}
          />
          <Feature
            color={theme?.accentColor || "#8a5fd6"}
            label={["Advanced", "Fertility Solutions"]}
            icon={<MicroscopeIcon />}
            styles={styles}
          />
          <Feature
            color={theme?.headerBg || "#69b83e"}
            label={["Support", "at Every Step"]}
            icon={<PeopleIcon />}
            styles={styles}
          />
        </div>

        {/* ---------- mother/child silhouette illustration ---------- */}
        {!photo && <MotherChildGlyph style={styles.motherChild} />}
        <HeartGlyph color="#f2a4bd" size={34} style={styles.floatingHeart1} />
        <HeartGlyph color="#f2a4bd" size={20} style={styles.floatingHeart2} />

        {/* ---------- doctor photo ---------- */}
        {photo && (
          <div style={styles.photoWrap}>
            <img src={photo} alt={doctorName} style={styles.photoImg} />
          </div>
        )}

        {/* ---------- name card ---------- */}
        <div style={styles.nameCard}>
          <p style={styles.nameCardName}>{doctorName}</p>
          <p style={styles.nameCardCred}>{credentials}</p>
        </div>

        {/* ---------- pink script strip ---------- */}
        <div style={styles.scriptStrip}>
          <p style={styles.scriptStripText}>
            Because every family
            <br />
            has a story worth waiting for{" "}
            <HeartGlyph color="#c22458" size={16} outline />
          </p>
        </div>

        {/* ---------- whatsapp + secondary script ---------- */}
        <div style={styles.contactRow}>
          <div style={styles.whatsappBlock}>
            <div style={styles.whatsappCircle}>
              <WhatsAppIcon />
            </div>
            <div>
              <p style={styles.whatsappLabel}>Chat with us on WhatsApp</p>
              <p style={styles.whatsappNumber}>{whatsapp}</p>
            </div>
          </div>

          <div style={styles.scriptBottomRight}>
            New Hope
            <br />
            Brighter Tomorrows <HeartGlyph color="#14276b" size={14} outline />
          </div>
        </div>

        {/* ---------- footer line ---------- */}
        <div style={styles.footerLine}>
          <MegaphoneIcon />
          <span style={styles.footerText}>
            Personalized Patient Education&nbsp;&nbsp;•&nbsp;&nbsp;Informative
            Health Posts&nbsp;&nbsp;•&nbsp;&nbsp;A Healthier Community
            Together
          </span>
        </div>

        {/* ---------- bottom banner ---------- */}
        <div style={styles.bottomBanner}>
          <span style={styles.bottomBannerText}>
            HEALTHY FAMILIES&nbsp;&nbsp;•&nbsp;&nbsp;HAPPIER TOMORROWS
          </span>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Small inline icon / decorative components (no external deps)
   ============================================================ */

function Feature({ color, label, icon, styles }) {
  return (
    <div style={styles.feature}>
      <div style={{ ...styles.featureCircle, background: color }}>{icon}</div>
      <p style={styles.featureLabel}>
        {label[0]}
        <br />
        {label[1]}
      </p>
    </div>
  );
}

function HeartGlyph({ color = "#e0507e", size = 20, outline = false, style }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{ display: "inline-block", verticalAlign: "middle", ...style }}
    >
      <path
        d="M12 21s-7.5-4.6-10-9.3C0.4 8.4 2 5 5.4 5c2 0 3.4 1.1 4.6 2.7C11.2 6.1 12.6 5 14.6 5 18 5 19.6 8.4 22 11.7 19.5 16.4 12 21 12 21z"
        fill={outline ? "none" : color}
        stroke={color}
        strokeWidth={outline ? 1.6 : 0}
      />
    </svg>
  );
}

function LeafGlyph({ style }) {
  return (
    <svg
      width="46"
      height="60"
      viewBox="0 0 46 60"
      style={{ position: "absolute", ...style }}
    >
      <path
        d="M23 60 C23 40 23 22 23 2"
        stroke="#3aa16b"
        strokeWidth="3"
        fill="none"
      />
      <path
        d="M23 20 C33 14 42 16 44 8 C34 8 26 10 23 20Z"
        fill="#57c27d"
      />
      <path
        d="M23 32 C13 26 4 28 2 20 C12 20 20 22 23 32Z"
        fill="#3aa16b"
      />
    </svg>
  );
}

function MotherChildGlyph({ style }) {
  return (
    <svg viewBox="0 0 300 300" style={style}>
      <circle cx="150" cy="150" r="150" fill="#f6c9d6" opacity="0.55" />
      <path
        d="M150 60c-28 0-46 22-46 48 0 14 6 24 12 32-18 10-30 30-30 56v20h128v-20c0-26-12-46-30-56 6-8 12-18 12-32 0-26-18-48-46-48z"
        fill="#f2a9c0"
        opacity="0.9"
      />
      <circle cx="150" cy="205" r="26" fill="#f2a9c0" opacity="0.9" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="#14276b" strokeWidth="2" />
      <path d="M3 10h18" stroke="#14276b" strokeWidth="2" />
      <path d="M8 3v4M16 3v4" stroke="#14276b" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function LogoMark() {
  return (
    <svg width="34" height="34" viewBox="0 0 40 40">
      <rect x="12" y="2" width="16" height="16" rx="3" fill="#1a4fd6" />
      <path d="M4 30c10-2 14-10 22-14 6 8 2 18-8 20-8 2-14-2-14-6Z" fill="#4cb04f" />
    </svg>
  );
}

function HeartsIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
      <path d="M12 17s-5.5-3.3-7.3-6.7C3.6 8 5 5.4 7.4 5.4c1.4 0 2.4.8 3.2 1.9.8-1.1 1.8-1.9 3.2-1.9 2.4 0 3.8 2.6 2.7 4.9C14.5 13.7 12 17 12 17Z" stroke="#fff" strokeWidth="1.7" />
    </svg>
  );
}

function MicroscopeIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
      <path d="M9 20h6M10 20v-3a2 2 0 1 1 4 0v3M8 9l4-4 4 4M12 5v6M6 20h1" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="12" cy="11" r="2.4" stroke="#fff" strokeWidth="1.7" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
      <circle cx="8" cy="8" r="2.6" stroke="#fff" strokeWidth="1.7" />
      <circle cx="16" cy="8" r="2.6" stroke="#fff" strokeWidth="1.7" />
      <path d="M3 19c0-3 2.5-5 5-5s5 2 5 5M11 19c0-3 2.5-5 5-5s5 2 5 5" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="#fff">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Z" />
      <path d="M17 14.3c-.3-.1-1.6-.8-1.9-.9-.2-.1-.4-.1-.6.1s-.7.9-.9 1.1c-.2.2-.3.2-.6.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.4 0-.5L9.6 8.4c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-1 2.3c0 1.3 1 2.6 1.1 2.8.1.2 2 3.1 4.9 4.3.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.5-.1 1.6-.6 1.8-1.3.2-.6.2-1.1.2-1.2-.1-.2-.3-.2-.6-.4Z" fill="#25d366" />
    </svg>
  );
}

function MegaphoneIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M3 11v2a2 2 0 0 0 2 2h1l2 5h2l-1.5-5H12l6 4V5l-6 4H5a2 2 0 0 0-2 2Z" stroke="#c22458" strokeWidth="1.5" fill="#c22458" />
    </svg>
  );
}

const SCRIPT = "'Caveat', cursive";
const BODY = "'Poppins', sans-serif";

const getStyles = (theme) => {
  const bgGradient = theme?.bgGradient || "linear-gradient(160deg, #eaf6fb 0%, #ffffff 45%, #eaf6fb 100%)";
  const textTitle = theme?.textTitle || "#14276b";
  const accentColor = theme?.accentColor || "#1cb0ae";
  const highlight = theme?.highlight || "#d81b60";
  const wash = theme?.wash || "rgba(244,180,200,0.55)";
  const washSecondary = theme?.washSecondary || "rgba(244,180,200,0.15)";
  const scriptColor = theme?.scriptColor || textTitle;
  const ribbon = theme?.ribbon || "rgba(244,180,200,0.4)";
  const footerBg = theme?.footerBg || highlight;
  
  return {
    page: {
      display: "flex",
      justifyContent: "center",
      background: "transparent",
      padding: "0",
      fontFamily: BODY,
      width: "100%",
    },
    poster: {
      position: "relative",
      width: "100%",
      maxWidth: "700px",
      aspectRatio: "1123 / 1499",
      background: bgGradient,
      borderRadius: "6px",
      overflow: "hidden",
      boxShadow: "0 10px 40px rgba(20,39,107,0.15)",
    },
    bgWash: {
      position: "absolute",
      inset: 0,
      background: `radial-gradient(circle at 15% 90%, ${washSecondary}, transparent 40%), radial-gradient(circle at 85% 5%, ${washSecondary}, transparent 35%)`,
    },
    pinkBlob: {
      position: "absolute",
      top: "22%",
      right: "4%",
      width: "58%",
      height: "42%",
      background: `radial-gradient(circle, ${wash} 0%, ${washSecondary} 60%, transparent 75%)`,
      borderRadius: "50%",
      filter: "blur(4px)",
    },
    topBar: {
      position: "absolute",
      top: "3%",
      left: "4%",
      right: "4%",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
    },
    dateChip: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      background: "rgba(255,255,255,0.7)",
      padding: "6px 10px",
      borderRadius: "8px",
    },
    dateText: {
      fontWeight: 600,
      color: textTitle,
      fontSize: "clamp(11px, 1.6vw, 15px)",
    },
    clinicBrand: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
    },
    clinicNameWrap: {
      display: "flex",
      flexDirection: "column",
      lineHeight: 1.1,
    },
    clinicName: {
      fontWeight: 800,
      color: textTitle,
      fontSize: "clamp(11px, 1.6vw, 15px)",
      letterSpacing: "0.5px",
    },
    clinicTagline: {
      fontWeight: 500,
      color: textTitle,
      opacity: 0.8,
      fontSize: "clamp(8px, 1.1vw, 10px)",
      letterSpacing: "0.5px",
    },
    scriptTopRight: {
      position: "absolute",
      top: "8%",
      left: "44%",
      fontFamily: SCRIPT,
      fontWeight: 700,
      color: scriptColor,
      fontSize: "clamp(18px, 3vw, 26px)",
      lineHeight: 1.05,
      transform: "rotate(-6deg)",
      textAlign: "center",
    },
    headlineBlock: {
      position: "absolute",
      top: "13%",
      left: "4%",
    },
    headlineNavy: {
      margin: 0,
      fontFamily: BODY,
      fontWeight: 800,
      fontStyle: "italic",
      color: textTitle,
      fontSize: "clamp(34px, 7vw, 58px)",
      lineHeight: 0.95,
    },
    headlineTeal: {
      margin: 0,
      fontFamily: BODY,
      fontWeight: 800,
      fontStyle: "italic",
      color: accentColor,
      fontSize: "clamp(34px, 7vw, 58px)",
      lineHeight: 0.95,
    },
    leafOnGrows: {
      top: "-12px",
      left: "calc(100% + 14px)",
    },
    subheadBlock: {
      position: "absolute",
      top: "40%",
      left: "4%",
      maxWidth: "50%",
    },
    subheadLine: {
      margin: 0,
      color: textTitle,
      fontWeight: 500,
      fontSize: "clamp(14px, 2.3vw, 20px)",
    },
    subheadTherapy: {
      margin: "2px 0 6px",
      color: highlight,
      fontWeight: 800,
      fontSize: "clamp(18px, 3vw, 26px)",
    },
    subheadTags: {
      margin: 0,
      color: textTitle,
      fontWeight: 500,
      fontSize: "clamp(10px, 1.6vw, 13px)",
    },
    featureRow: {
      position: "absolute",
      top: "52%",
      left: "4%",
      display: "flex",
      gap: "clamp(10px, 3vw, 24px)",
    },
    feature: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      width: "clamp(64px, 11vw, 90px)",
      textAlign: "center",
    },
    featureCircle: {
      width: "clamp(44px, 7vw, 62px)",
      height: "clamp(44px, 7vw, 62px)",
      borderRadius: "50%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: "0 4px 10px rgba(0,0,0,0.15)",
      marginBottom: "6px",
    },
    featureLabel: {
      margin: 0,
      fontSize: "clamp(8px, 1.3vw, 11px)",
      color: textTitle,
      fontWeight: 500,
      lineHeight: 1.3,
    },
    motherChild: {
      position: "absolute",
      top: "20%",
      right: "6%",
      width: "40%",
      height: "34%",
      zIndex: 0,
    },
    floatingHeart1: {
      position: "absolute",
      top: "18%",
      right: "38%",
    },
    floatingHeart2: {
      position: "absolute",
      top: "34%",
      right: "10%",
    },
    photoWrap: {
      position: "absolute",
      top: "22%",
      right: "6%",
      width: "36%",
      aspectRatio: "1 / 1",
      background: wash,
      borderRadius: "50%",
      padding: "6px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1,
    },
    photoImg: {
      width: "100%",
      height: "100%",
      objectFit: "contain",
      borderRadius: "50%",
    },
    photoPlaceholder: {
      width: "100%",
      height: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#dbe7f0",
      color: "#7a8aa8",
      fontSize: "14px",
      fontWeight: 500,
    },
    nameCard: {
      position: "absolute",
      top: "47%",
      right: "24%",
      transform: "translateX(50%)",
      background: "#fff",
      borderRadius: "10px",
      padding: "14px 20px",
      boxShadow: "0 6px 18px rgba(0,0,0,0.12)",
      textAlign: "center",
      width: "42%",
      zIndex: 2,
    },
    nameCardName: {
      margin: 0,
      color: accentColor,
      fontWeight: 800,
      fontSize: "clamp(15px, 2.4vw, 22px)",
    },
    nameCardCred: {
      margin: "2px 0 0",
      color: textTitle,
      fontWeight: 500,
      fontSize: "clamp(9px, 1.4vw, 13px)",
      lineHeight: 1.4,
    },
    scriptStrip: {
      position: "absolute",
      top: "71%",
      left: "3%",
      right: "44%",
      background: ribbon,
      borderRadius: "10px",
      padding: "10px 16px",
      transform: "rotate(-2deg)",
    },
    scriptStripText: {
      margin: 0,
      fontFamily: SCRIPT,
      fontWeight: 700,
      color: highlight,
      fontSize: "clamp(16px, 2.6vw, 22px)",
      lineHeight: 1.15,
    },
    contactRow: {
      position: "absolute",
      top: "82%",
      left: "4%",
      right: "4%",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
    },
    whatsappBlock: {
      display: "flex",
      alignItems: "center",
      gap: "10px",
    },
    whatsappCircle: {
      width: "clamp(36px, 6vw, 52px)",
      height: "clamp(36px, 6vw, 52px)",
      borderRadius: "50%",
      background: "#25d366",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    whatsappLabel: {
      margin: 0,
      color: textTitle,
      fontWeight: 500,
      fontSize: "clamp(10px, 1.6vw, 14px)",
    },
    whatsappNumber: {
      margin: 0,
      color: textTitle,
      fontWeight: 800,
      fontSize: "clamp(14px, 2.4vw, 20px)",
    },
    scriptBottomRight: {
      fontFamily: SCRIPT,
      fontWeight: 700,
      color: scriptColor,
      fontSize: "clamp(15px, 2.4vw, 20px)",
      textAlign: "right",
      lineHeight: 1.1,
      transform: "rotate(-4deg)",
    },
    footerLine: {
      position: "absolute",
      top: "89%",
      left: "4%",
      right: "4%",
      display: "flex",
      alignItems: "center",
      gap: "6px",
    },
    footerText: {
      color: textTitle,
      fontSize: "clamp(7px, 1.1vw, 10px)",
      fontWeight: 500,
    },
    bottomBanner: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      background: footerBg,
      padding: "12px 0",
      textAlign: "center",
    },
    bottomBannerText: {
      color: "#fff",
      fontWeight: 600,
      letterSpacing: "2px",
      fontSize: "clamp(9px, 1.6vw, 13px)",
    },
  };
};
