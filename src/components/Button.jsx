import styles from './Button.module.css';

export default function Button({ children, isLoading = false, ...rest }) {
  return (
    <button
      className={styles.button}
      disabled={isLoading || rest.disabled}
      aria-busy={isLoading}
      {...rest}
    >
      {isLoading ? 'Signing in…' : children}
    </button>
  );
}
