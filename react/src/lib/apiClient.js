import { authHeaders } from './authSession';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api').replace(/\/$/, '');

export { API_BASE_URL };

export class ApiError extends Error {
  constructor(message, { status, code } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export async function apiRequest(path, { method = 'GET', body, signal } = {}) {
  const isFormData = body instanceof FormData;
  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...authHeaders(),
  };
  const formattedBody = isFormData ? body : body ? JSON.stringify(body) : undefined;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: formattedBody,
    credentials: 'include',
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
