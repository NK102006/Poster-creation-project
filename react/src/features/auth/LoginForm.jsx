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
        label="Employee ID"
        inputMode="numeric"
        autoComplete="username"
        value={values.id}
        onChange={(v) => setField('id', v)}
        error={fieldErrors.id}
      />

      <Button type="submit" isLoading={isSubmitting}>
        Sign in
      </Button>
    </form>
  );
}
