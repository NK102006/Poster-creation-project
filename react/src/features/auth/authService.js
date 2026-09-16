import { apiRequest } from '../../lib/apiClient';

export function login({ id }) {
  return apiRequest('/login', {
    method: 'POST',
    body: { id },
  });
}
