const LEGACY_KEY = 'auth_session';

const AUTH_KEYS = {
  portal: 'portal_auth_session',
  admin: 'admin_session',
  superadmin: 'super_admin_session',
  userpanel: 'userpanel_auth_session',
};

function parseStored(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed?.role ? parsed : null;
  } catch {
    return null;
  }
}

export function authScopeFromPath() {
  const path = window.location.pathname;
  if (path === '/admin') return 'admin';
  if (path === '/superadmin' || path === '/super-admin') return 'superadmin';
  if (path === '/userpanel') return 'userpanel';
  return 'portal';
}

function scopeFromRole(role) {
  if (role === 'superadmin') return 'superadmin';
  if (role === 'admin') return 'admin';
  return 'portal';
}

function migrateLegacy(scope) {
  const legacy = parseStored(localStorage.getItem(LEGACY_KEY));
  if (!legacy) return null;

  const inferred = scopeFromRole(legacy.role);
  if (scope === 'userpanel') {
    localStorage.setItem(AUTH_KEYS.userpanel, JSON.stringify(legacy));
    localStorage.removeItem(LEGACY_KEY);
    return legacy;
  }
  if (inferred !== scope) return null;

  localStorage.setItem(AUTH_KEYS[scope], JSON.stringify(legacy));
  localStorage.removeItem(LEGACY_KEY);
  return legacy;
}

export function readAuth(scope = authScopeFromPath()) {
  const stored = parseStored(localStorage.getItem(AUTH_KEYS[scope]));
  if (stored) return stored;
  return migrateLegacy(scope);
}

export function writeAuth(auth, scope = authScopeFromPath()) {
  if (!auth?.role) {
    clearAuth(scope);
    return null;
  }
  localStorage.setItem(AUTH_KEYS[scope], JSON.stringify(auth));
  localStorage.removeItem(LEGACY_KEY);
  return auth;
}

export function clearAuth(scope = authScopeFromPath()) {
  localStorage.removeItem(AUTH_KEYS[scope]);
  if (scope === 'portal') localStorage.removeItem(LEGACY_KEY);
}

export function canAccessPage(auth, page) {
  const role = auth?.role;
  if (!role) return false;
  if (page === 'superadmin') return role === 'superadmin';
  if (page === 'admin') return role === 'admin' || role === 'superadmin';
  if (page === 'userpanel') return role === 'superadmin' || role === 'admin' || role === 'user';
  if (page === 'portal') return role === 'user';
  return false;
}

export function authHeaders(auth = readAuth()) {
  if (!auth?.role) return {};
  return {
    'X-Auth-Role': auth.role,
    'X-Auth-Id': auth.id || '',
  };
}
