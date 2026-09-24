export function validateEmployeeId(value) {
  const v = String(value ?? '').trim();
  if (!v) return 'Enter your employee ID or username.';
  if (!/^[\w.-]{1,40}$/.test(v)) return 'Enter a valid employee ID or username.';
  return null;
}

export function validatePassword(value) {
  const v = String(value ?? '');
  if (!v.trim()) return 'Enter your password.';
  if (v.length < 6) return 'Password must be at least 6 characters.';
  return null;
}

export function sanitizePasswordInput(value) {
  return String(value ?? '').replace(/\s/g, '');
}

export function validateNewPassword(value, { required = true } = {}) {
  const v = String(value ?? '');
  if (!v) return required ? 'Password is required' : null;
  if (/\s/.test(v)) return 'Password cannot contain spaces';
  if (v.length < 6) return 'Password must be at least 6 characters';
  return null;
}
