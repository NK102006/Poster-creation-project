import os

css_path = r'd:\Project\react\src\components\PosterGenerator.module.css'

with open(css_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# find index of /* =========================================================
# EXACT USER POSTER THEME DEFINITIONS & CSS RULES
start_idx = -1
for i, line in enumerate(lines):
    if "EXACT USER POSTER THEME DEFINITIONS" in line:
        start_idx = i - 1
        break

if start_idx == -1:
    start_idx = 511

keep_lines = lines[:start_idx]

new_css = """
/* =========================================================
   EXACT USER POSTER THEME DEFINITIONS & CSS RULES
   ========================================================= */

.posterContainer {
  width: 500px;
  max-width: 100%;
  aspect-ratio: 4 / 5;
  background: #ffffff;
  position: relative;
  overflow: hidden;
  box-shadow: 0 16px 36px -8px rgba(0, 0, 0, 0.2);
  border-radius: 12px;
  font-family: 'Inter', -apple-system, sans-serif;
  color: #0f2942;
  user-select: none;
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
  right: 15%;
  top: 25%;
  width: 350px;
  height: 350px;
  z-index: 2;
  display: flex;
  justify-content: center;
  align-items: center;
}

.posterDoctorImage {
  position: absolute;
  right: -20px;
  bottom: 60px; /* Above the footers */
  width: 280px;
  max-height: 400px;
  object-fit: contain;
  object-position: bottom right;
  z-index: 3;
}

/* TOP SECTION */
.posterTopSection {
  position: absolute;
  top: 20px;
  left: 24px;
  width: calc(100% - 48px);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  z-index: 4;
}

.dateBadge {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #002244;
  font-weight: 800;
  font-size: 1.1rem;
}

.dateIcon {
  font-size: 1.3rem;
  color: #0056b3;
}

.clinicLogoBox {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.clinicLogoIcon {
  font-size: 2.2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  line-height: 1;
}

.blueCross { color: #0056b3; }
.greenLeaf { position: absolute; right: -12px; bottom: 0; font-size: 1.5rem; color: #28a745; transform: rotate(-20deg); }

.clinicLogoText {
  display: flex;
  flex-direction: column;
  align-items: center;
  font-size: 0.65rem;
  color: #002244;
  letter-spacing: 1.5px;
}

/* MAIN TEXT */
.posterMainText {
  position: absolute;
  top: 100px;
  left: 24px;
  z-index: 4;
}

.hopeScriptTop {
  font-family: 'Brush Script MT', cursive;
  font-size: 1.6rem;
  color: #003366;
  transform: rotate(-10deg);
  position: absolute;
  top: -20px;
  left: 170px;
  line-height: 1.1;
  width: 150px;
}

.titleHope {
  font-size: 56px;
  font-weight: 900;
  color: #002244;
  line-height: 0.95;
  margin: 0 0 20px 0;
  position: relative;
}

.leafAccent {
  color: #20b2aa;
  font-size: 2.5rem;
  position: absolute;
  right: -30px;
  bottom: 40px;
}

.expertCare {
  font-size: 20px;
  color: #002244;
  font-weight: 700;
  margin: 0;
}

.infertilityTreatment {
  font-size: 26px;
  color: #e11d48;
  font-weight: 800;
  margin: 2px 0 6px 0;
}

.scienceSubtitle {
  font-size: 13px;
  color: #003366;
  font-weight: 600;
  margin: 0;
  letter-spacing: 0.5px;
}

/* BADGES ROW */
.posterBadgesRow {
  position: absolute;
  top: 360px;
  left: 24px;
  z-index: 4;
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.featureBadge {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  width: 75px;
}

.featureIconWrap {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.4rem;
  margin-bottom: 6px;
  box-shadow: 0 4px 10px rgba(0,0,0,0.08);
}

.featureBadge span:last-child {
  font-size: 10px;
  font-weight: 700;
  color: #003366;
  line-height: 1.25;
}

/* DOCTOR NAME CARD */
.posterDoctorNameCard {
  position: absolute;
  bottom: 200px;
  right: 15px;
  background: #ffffff;
  padding: 12px 20px;
  border-radius: 30px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.15);
  z-index: 5;
  text-align: center;
  width: 240px;
  box-sizing: border-box;
}

.posterDoctorNameCard h3 {
  color: #0056b3;
  margin: 0 0 4px 0;
  font-size: 1.3rem;
  font-weight: 800;
}

.posterDoctorNameCard p {
  color: #002244;
  margin: 0;
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1.25;
}

/* FAMILY SCRIPT */
.posterFamilyScript {
  position: absolute;
  top: 450px;
  left: 20px;
  font-family: 'Brush Script MT', cursive;
  font-size: 1.8rem;
  color: #d81b60;
  transform: rotate(-6deg);
  line-height: 1.2;
  text-align: left;
  z-index: 4;
  width: 250px;
}

.heartRed {
  color: #e11d48;
}

/* BOTTOM SECTION */
.posterBottomSection {
  position: absolute;
  bottom: 75px;
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
  width: 45px;
  height: 45px;
  background: #25D366;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.6rem;
  color: white;
}

.waDetails {
  display: flex;
  flex-direction: column;
}

.waLabel {
  font-size: 0.8rem;
  color: #003366;
  font-weight: 600;
}

.waNumber {
  font-size: 1.6rem;
  font-weight: 900;
  color: #002244;
  line-height: 1.1;
}

.hopeScriptBottom {
  font-family: 'Brush Script MT', cursive;
  font-size: 1.6rem;
  color: #003366;
  transform: rotate(-10deg);
  text-align: right;
  line-height: 1.1;
  position: absolute;
  right: 0;
  bottom: 0;
  width: 200px;
}

/* FOOTERS */
.posterFooterEducation {
  position: absolute;
  bottom: 30px;
  left: 0;
  width: 100%;
  height: 30px;
  background: rgba(255,255,255,0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
  z-index: 4;
  font-size: 0.7rem;
  color: #003366;
  font-weight: 600;
}

.megaphoneIcon {
  color: #e11d48;
  font-size: 0.9rem;
}

.posterFooterBottom {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 30px;
  background: #d81b60;
  color: white;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 0.8rem;
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

print("CSS precisely aligned to 500x625 layout.")
