export function validateEmployeeId(value) {
  const v = String(value ?? '').trim();
  if (!v) return 'Enter your employee ID or username.';
  if (!/^[\w.-]{1,40}$/.test(v)) return 'Enter a valid employee ID or username.';
  return null;
}

export function validatePassword(value) {
  const v = String(value ?? '');
  if (!v.trim()) return 'Enter your password.';
  if (v.length < 4) return 'Password must be at least 4 characters.';
  return null;
}
