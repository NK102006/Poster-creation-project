import os

css_path = r'd:\Project\react\src\components\PosterGenerator.module.css'

with open(css_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# The modal css ends around line 511. We keep lines 0 to 510.
keep_lines = lines[:511]

new_css = """
/* =========================================================
   EXACT USER POSTER THEME DEFINITIONS & CSS RULES
   ========================================================= */

.posterContainer {
  width: 100%;
  max-width: 500px;
  aspect-ratio: 4 / 5;
  background: #ffffff;
  position: relative;
  overflow: hidden;
  box-shadow: 0 16px 36px -8px rgba(0, 0, 0, 0.2);
  border-radius: 12px;
  font-family: 'Inter', -apple-system, sans-serif;
  color: #0f2942;
  user-select: none;
  /* Make sure the text sizing scales reasonably if needed, though for html-to-image we keep it fixed */
  font-size: 14px;
}

.posterWatercolorBg {
  position: absolute;
  top: 0; left: 0; width: 100%; height: 100%;
  background: 
    radial-gradient(circle at 80% -10%, rgba(135,206,235,0.4) 0%, transparent 40%),
    radial-gradient(circle at -10% 20%, rgba(200,230,250,0.5) 0%, transparent 50%),
    radial-gradient(circle at 100% 60%, rgba(255,192,203,0.5) 0%, transparent 60%),
    radial-gradient(circle at -20% 80%, rgba(144,238,144,0.3) 0%, transparent 40%);
  z-index: 1;
}

.posterMotherSilhouette {
  position: absolute;
  right: 20%;
  top: 25%;
  width: 50%;
  height: 50%;
  z-index: 2;
  display: flex;
  justify-content: center;
  align-items: center;
}

.posterDoctorImage {
  position: absolute;
  right: -5%;
  bottom: 8%; 
  width: 55%;
  max-height: 70%;
  object-fit: contain;
  object-position: bottom right;
  z-index: 3;
}

/* TOP SECTION */
.posterTopSection {
  position: absolute;
  top: 0; left: 0; width: 100%;
  padding: 24px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  z-index: 4;
}

.dateBadge {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #003366;
  font-weight: 700;
  font-size: 1.1rem;
}

.dateIcon {
  font-size: 1.3rem;
  color: #007bff;
}

.clinicLogoBox {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.clinicLogoIcon {
  font-size: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.blueCross { color: #0056b3; }
.greenLeaf { position: absolute; right: -10px; bottom: 0; font-size: 1.4rem; color: #28a745; transform: rotate(-20deg); }

.clinicLogoText {
  display: flex;
  flex-direction: column;
  align-items: center;
  font-size: 0.75rem;
  color: #003366;
  letter-spacing: 1px;
}

/* MAIN TEXT */
.posterMainText {
  position: absolute;
  top: 14%;
  left: 24px;
  z-index: 4;
}

.hopeScriptTop {
  font-family: 'Brush Script MT', cursive;
  font-size: 2rem;
  color: #003366;
  transform: rotate(-10deg);
  margin-left: 220px;
  margin-bottom: -10px;
  line-height: 1;
}

.titleHope {
  font-size: 4.8rem;
  font-weight: 900;
  color: #002244;
  line-height: 0.95;
  margin: 0 0 12px 0;
  position: relative;
}

.leafAccent {
  color: #20b2aa;
  font-size: 2.5rem;
  position: absolute;
  right: -30px;
  bottom: 30px;
}

.expertCare {
  font-size: 1.6rem;
  color: #002244;
  font-weight: 700;
  margin: 0;
}

.infertilityTreatment {
  font-size: 2rem;
  color: #e11d48;
  font-weight: 800;
  margin: 0 0 8px 0;
}

.scienceSubtitle {
  font-size: 0.95rem;
  color: #003366;
  font-weight: 600;
  margin: 0;
  letter-spacing: 0.5px;
}

/* BADGES ROW */
.posterBadgesRow {
  position: absolute;
  top: 48%;
  left: 24px;
  z-index: 4;
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.featureBadge {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  width: 90px;
}

.featureIconWrap {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.8rem;
  margin-bottom: 8px;
  box-shadow: 0 4px 10px rgba(0,0,0,0.05);
}

.featureBadge span:last-child {
  font-size: 0.75rem;
  font-weight: 600;
  color: #003366;
  line-height: 1.2;
}

/* DOCTOR NAME CARD */
.posterDoctorNameCard {
  position: absolute;
  top: 55%;
  right: 12px;
  background: #ffffff;
  padding: 12px 20px;
  border-radius: 30px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.1);
  z-index: 5;
  text-align: center;
}

.posterDoctorNameCard h3 {
  color: #0056b3;
  margin: 0 0 4px 0;
  font-size: 1.4rem;
  font-weight: 800;
}

.posterDoctorNameCard p {
  color: #002244;
  margin: 0;
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1.2;
}

/* FAMILY SCRIPT */
.posterFamilyScript {
  position: absolute;
  top: 67%;
  left: 10%;
  font-family: 'Brush Script MT', cursive;
  font-size: 2.2rem;
  color: #d81b60;
  transform: rotate(-5deg);
  line-height: 1.1;
  text-align: center;
  z-index: 4;
}

.heartRed {
  color: #e11d48;
}

/* BOTTOM SECTION */
.posterBottomSection {
  position: absolute;
  bottom: 8.5%;
  left: 24px;
  width: calc(100% - 48px);
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  z-index: 4;
}

.whatsappBanner {
  display: flex;
  align-items: center;
  gap: 12px;
}

.waIconBox {
  width: 50px;
  height: 50px;
  background: #25D366;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.8rem;
  color: white;
}

.waDetails {
  display: flex;
  flex-direction: column;
}

.waLabel {
  font-size: 0.85rem;
  color: #003366;
  font-weight: 600;
}

.waNumber {
  font-size: 1.8rem;
  font-weight: 900;
  color: #002244;
  line-height: 1.1;
}

.hopeScriptBottom {
  font-family: 'Brush Script MT', cursive;
  font-size: 2rem;
  color: #003366;
  transform: rotate(-10deg);
  text-align: right;
  line-height: 1.1;
  margin-right: 30px;
  margin-bottom: 20px;
}

/* FOOTERS */
.posterFooterEducation {
  position: absolute;
  bottom: 4%;
  left: 0;
  width: 100%;
  background: rgba(255,255,255,0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  padding: 6px 0;
  z-index: 4;
  font-size: 0.75rem;
  color: #003366;
  font-weight: 600;
}

.megaphoneIcon {
  color: #e11d48;
  font-size: 1rem;
}

.posterFooterBottom {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  background: #d81b60;
  color: white;
  text-align: center;
  padding: 8px 0;
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 2px;
  z-index: 5;
}

/* Common Control Elements preserved below here */
.previewLayout {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 36px;
  width: 100%;
}

.mockupColumn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.controlColumn {
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;
  max-width: 500px;
}

.actionCard {
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(17, 24, 39, 0.06);
  border-radius: 22px;
  padding: 22px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  box-shadow: 0 12px 24px rgba(17, 33, 30, 0.03);
}

.successAlert {
  padding: 12px 16px;
  border-radius: var(--radius-sm);
  background: #edf7ed;
  border: 1px solid #c8e6c9;
  color: #1e4620;
  font-size: 13.5px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}

.navRow {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border);
}

.secondaryBtn {
  background: transparent;
  border: 1px solid var(--color-border);
  padding: 10px 18px;
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  cursor: pointer;
  transition: all 0.15s ease;
}

.secondaryBtn:hover {
  background: #f4f6f5;
  border-color: #adb8b4;
}

.primaryBtn, .generateBtn {
  width: 100%;
  background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
  border: none;
  padding: 14px 22px;
  border-radius: var(--radius-sm);
  font-size: 15px;
  font-weight: 700;
  color: #ffffff;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(0, 198, 255, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.primaryBtn:hover, .generateBtn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 198, 255, 0.35);
}

.generateBtn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}
"""

with open(css_path, 'w', encoding='utf-8') as f:
    f.writelines(keep_lines)
    f.write(new_css)

print("CSS updated successfully.")
