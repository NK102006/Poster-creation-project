import { isUiOnly } from './uiOnly';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message, { status, code } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

function mockResponse(path, { method = 'GET', body } = {}) {
  if (path === '/login' && method === 'POST') {
    const id = body?.id ?? 'ui-dev';
    return {
      id,
      empid: id,
      name: 'UI Dev User',
    };
  }

  if (path === '/doctors/current') {
    return { doctor: null };
  }

  if (path === '/doctors' && method === 'POST') {
    return {
      doctor: {
        name: body instanceof FormData ? body.get('name') || '' : '',
        contactnumber: body instanceof FormData ? body.get('contactnumber') || '' : '',
      },
    };
  }

  return {};
}

export async function apiRequest(path, { method = 'GET', body, signal } = {}) {
  if (isUiOnly) {
    return mockResponse(path, { method, body });
  }

  const isFormData = body instanceof FormData;
  const headers = isFormData ? {} : { 'Content-Type': 'application/json' };
  const formattedBody = isFormData ? body : body ? JSON.stringify(body) : undefined;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: formattedBody,
    signal,
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    // Response had no JSON body
  }

  if (!response.ok) {
    throw new ApiError(data?.message || 'Something went wrong. Please try again.', {
      status: response.status,
      code: data?.code,
    });
  }

  return data;
}
