import { apiRequest } from '../../lib/apiClient';

export function login({ id, password }) {
  return apiRequest('/login', {
    method: 'POST',
    body: { id, password },
  });
}
