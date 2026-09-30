/** Shared helpers for doctor field config ordering and layout. */

const STANDARD_BEFORE_CUSTOM = ['name', 'clinicName', 'doctorDegree', 'contactnumber'];

function fieldRank(field) {
  if (!field) return 9999;
  if (field.key === 'logo' || field.key === 'photo' || field.type === 'file') return 5000;
  const standardIndex = STANDARD_BEFORE_CUSTOM.indexOf(field.key);
  if (standardIndex >= 0) return standardIndex;
  // Custom / other fields sit after degree & contact, before logo
  return 100 + (Number(field.order) || 0);
}

export function sortDoctorFields(fields = []) {
  return [...fields].sort((a, b) => {
    const diff = fieldRank(a) - fieldRank(b);
    if (diff !== 0) return diff;
    return String(a.label || '').localeCompare(String(b.label || ''));
  });
}

export function isFullWidthDoctorField(field) {
  if (!field) return false;
  if (field.fullWidth) return true;
  if (field.type === 'file' || field.type === 'textarea') return true;
  if (field.key === 'logo' || field.key === 'photo') return true;
  const label = String(field.label || '');
  return label.length >= 22;
}

export function enabledFormFields(fields = []) {
  return sortDoctorFields(fields).filter(
    (f) => f.enabled && f.key !== 'logo' && f.key !== 'photo' && f.type !== 'file'
  );
}
