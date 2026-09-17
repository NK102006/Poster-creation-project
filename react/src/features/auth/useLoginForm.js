import { useCallback, useState } from 'react';
import { login } from './authService';
import { validateEmployeeId } from './validators';

export function useLoginForm({ onSuccess } = {}) {
  const [values, setValues] = useState({ id: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const setField = useCallback((field, value) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: null }));
    setFormError(null);
  }, []);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      setFormError(null);

      const errors = {
        id: validateEmployeeId(values.id),
      };

      setFieldErrors(errors);

      if (Object.values(errors).some(Boolean)) {
        return;
      }

      setIsSubmitting(true);

      try {
        const result = await login({ id: values.id });
        onSuccess?.(result);
      } catch {
        setFormError('Something went wrong. Please try again.');
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
