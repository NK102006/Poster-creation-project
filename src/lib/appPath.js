export const APP_BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

export function appPath(route = '/') {
  return `${APP_BASE}${route}`;
}

export function currentAppPath() {
  const pathname = window.location.pathname;
  if (pathname === APP_BASE || pathname === `${APP_BASE}/`) return '/';
  if (!APP_BASE || pathname.startsWith(`${APP_BASE}/`)) {
    return pathname.slice(APP_BASE.length).replace(/\/$/, '') || '/';
  }
  return pathname;
}
