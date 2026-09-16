export function validateEmployeeId(value) {
  const v = String(value ?? '').trim();
  if (!v) return 'Enter your employee ID.';
  if (!/^\d{1,20}$/.test(v)) return 'Enter a valid employee ID.';
  return null;
}
