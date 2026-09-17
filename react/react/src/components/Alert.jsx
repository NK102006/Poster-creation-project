import styles from './Alert.module.css';

export default function Alert({ children }) {
  if (!children) return null;

  return (
    <div className={styles.alert} role="alert">
      {children}
    </div>
  );
}
