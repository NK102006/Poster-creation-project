export function validateEmployeeId(value) {
  const v = String(value ?? '').trim();
  if (!v) return 'Enter your employee ID or username.';
  if (!/^[\w.-]{1,40}$/.test(v)) return 'Enter a valid employee ID or username.';
  return null;
}

export function validatePassword(value) {
  const v = String(value ?? '');
  if (!v) return 'Enter your password.';
  if (/\s/.test(v)) return 'Password cannot contain spaces';
  if (v.length < 6) return 'Password must be at least 6 characters.';
  return null;
}

export function sanitizeUsernameInput(value) {
  return String(value ?? '').replace(/\s/g, '');
}

export function sanitizePasswordInput(value) {
  return String(value ?? '').replace(/\s/g, '');
}

export function sanitizePhoneInput(value) {
  return String(value ?? '').replace(/\D/g, '').slice(0, 10);
}

export function validatePhoneNumber(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return 'Contact number is required';
  if (digits.length !== 10) return 'Contact number must be exactly 10 digits';
  return null;
}

export function validateNewPassword(value, { required = true } = {}) {
  const v = String(value ?? '');
  if (!v) return required ? 'Password is required' : null;
  if (/\s/.test(v)) return 'Password cannot contain spaces';
  if (v.length < 6) return 'Password must be at least 6 characters';
  return null;
}
