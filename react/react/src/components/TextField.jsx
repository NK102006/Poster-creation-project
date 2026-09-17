import { useId } from 'react';
import styles from './TextField.module.css';

export default function TextField({
  label,
  type = 'text',
  value,
  onChange,
  error,
  autoComplete,
  required = true,
  endAdornment,
  ...rest
}) {
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>

      <div className={styles.inputWrapper}>
        <input
          id={id}
          className={`${styles.input} ${error ? styles.inputError : ''}`}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          {...rest}
        />
        {endAdornment}
      </div>

      {error && (
        <p id={errorId} className={styles.errorText} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
