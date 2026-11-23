/** Resolve app media consistently for previews, exports, videos and saved records. */
export function resolveMediaUrl(value, {
  base = import.meta.env?.BASE_URL || '/Poster-Creater/',
  origin = globalThis.location?.origin,
} = {}) {
  if (typeof value !== 'string' || !value) return value;
  if (/^(data:|blob:)/i.test(value)) return value;
  const prefix = `/${base.replace(/^\/+|\/+$/g, '')}`.replace(/^\/$/, '');
  let pathname = value.replace(/\\/g, '/');
  if (/^(https?:)?\/\//i.test(pathname)) {
    let url;
    try { url = new URL(pathname, origin); } catch { return value; }
    if (!origin || url.origin !== origin) return value;
    pathname = `${url.pathname}${url.search}${url.hash}`;
  }
  if (prefix && (pathname === prefix || pathname.startsWith(`${prefix}/`))) return pathname;
  return `${prefix}/${pathname.replace(/^\/+/, '')}`;
}

// Normalize persisted upload paths without treating arbitrary text fields as URLs.
export function normalizeUploadPaths(value) {
  if (typeof value === 'string') {
    let pathname = value.replace(/\\/g, '/');
    if (/^https?:\/\//i.test(pathname)) {
      try {
        const url = new URL(pathname);
        if (url.origin !== globalThis.location?.origin) return value;
        pathname = url.pathname;
      } catch { return value; }
    }
    return /^\/?uploads\//.test(pathname) ? resolveMediaUrl(value) : value;
  }
  if (Array.isArray(value)) return value.map(normalizeUploadPaths);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeUploadPaths(item)]));
  }
  return value;
}
