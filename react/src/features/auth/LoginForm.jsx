import TextField from '../../components/TextField';
import Button from '../../components/Button';
import Alert from '../../components/Alert';
import { useLoginForm } from './useLoginForm';
import styles from './LoginForm.module.css';

export default function LoginForm({ onSuccess }) {
  const {
    values,
    setField,
    fieldErrors,
    formError,
    isSubmitting,
    handleSubmit,
  } = useLoginForm({ onSuccess });

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <Alert>{formError}</Alert>

      <TextField
        label="Employee ID or username"
        inputMode="numeric"
        autoComplete="username"
        value={values.id}
        onChange={(v) => setField('id', v)}
        error={fieldErrors.id}
      />

      <TextField
        label="Password"
        type="password"
        autoComplete="current-password"
        value={values.password}
        onChange={(v) => setField('password', v)}
        error={fieldErrors.password}
      />

      <Button type="submit" isLoading={isSubmitting}>
        Sign in
      </Button>
    </form>
  );
}
