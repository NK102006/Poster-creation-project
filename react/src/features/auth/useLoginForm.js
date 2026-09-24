import { useCallback, useState } from 'react';
import { login } from './authService';
import { sanitizePasswordInput, sanitizeUsernameInput, validateEmployeeId, validatePassword } from './validators';
import { ApiError } from '../../lib/apiClient';

const GENERIC_AUTH_ERROR =
  'The employee ID / username or password you entered is incorrect. Please try again.';

export function useLoginForm({ onSuccess } = {}) {
  const [values, setValues] = useState({ id: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const setField = useCallback((field, value) => {
    const next =
      field === 'password'
        ? sanitizePasswordInput(value)
        : field === 'id'
          ? sanitizeUsernameInput(value)
          : value;
    setValues((prev) => ({ ...prev, [field]: next }));
    setFieldErrors((prev) => ({ ...prev, [field]: null }));
    setFormError(null);
  }, []);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      setFormError(null);

      const errors = {
        id: validateEmployeeId(values.id),
        password: validatePassword(values.password),
      };

      setFieldErrors(errors);

      if (Object.values(errors).some(Boolean)) {
        return;
      }

      setIsSubmitting(true);

      try {
        const result = await login({ id: values.id, password: values.password });
        onSuccess?.(result);
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 400)) {
          setFormError(err.message || GENERIC_AUTH_ERROR);
        } else if (err instanceof ApiError && err.status === 429) {
          setFormError('Too many attempts. Please wait and try again.');
        } else {
          setFormError("We couldn't reach the server. Check your connection and try again.");
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [values, onSuccess]
  );

  return {
    values,
    setField,
    fieldErrors,
    formError,
    isSubmitting,
    handleSubmit,
  };
}
