const AUTH_KEY = 'auth_session';

export function readAuth() {
  try {
    const stored = localStorage.getItem(AUTH_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    if (!parsed?.role) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeAuth(auth) {
  if (!auth?.role) {
    clearAuth();
    return null;
  }
  localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
  localStorage.removeItem('admin_session');
  localStorage.removeItem('super_admin_session');
  return auth;
}

export function clearAuth() {
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem('admin_session');
  localStorage.removeItem('super_admin_session');
}

export function canAccessPage(auth, page) {
  const role = auth?.role;
  if (!role) return false;
  if (page === 'superadmin') return role === 'superadmin';
  if (page === 'admin') return role === 'superadmin' || role === 'admin';
  if (page === 'userpanel' || page === 'portal') return role === 'superadmin' || role === 'admin' || role === 'user';
  return false;
}

export function authHeaders(auth = readAuth()) {
  if (!auth?.role) return {};
  return {
    'X-Auth-Role': auth.role,
    'X-Auth-Id': auth.id || '',
  };
}
