import { useState } from 'react';
import { apiRequest } from '../lib/apiClient';
import { canAccessPage, clearAuth, readAuth, writeAuth } from '../lib/authSession';
import StaffLogin from './StaffLogin';
import UsersDoctorsBoard from './UsersDoctorsBoard';
import styles from './AdminPortal.module.css';

export default function AdminPortal() {
  const [auth, setAuth] = useState(() => readAuth());
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const isLoggedIn = canAccessPage(auth, 'admin');

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoginError('');
    try {
      const result = await apiRequest('/admin/login', {
        method: 'POST',
        body: { username, password },
      });
      if (result.success) {
        setAuth(writeAuth(result.auth));
      }
    } catch (err) {
      setLoginError(err.message || 'Login failed');
    }
  };

  const handleLogout = () => {
    clearAuth();
    setAuth(null);
    apiRequest('/logout', { method: 'POST' }).catch(() => {});
  };

  if (!isLoggedIn) {
    return (
      <StaffLogin
        mark="A"
        subtitle="Admin"
        error={loginError}
        username={username}
        password={password}
        onUsername={setUsername}
        onPassword={setPassword}
        onSubmit={handleLogin}
      />
    );
  }

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarTop}>
          <div className={styles.brandMark}>A</div>
          <div>
            <div className={styles.brandName}>MedPortal</div>
            <div className={styles.brandSub}>Admin</div>
          </div>
        </div>
        <nav className={styles.nav}>
          <p className={styles.navLabel}>Collections</p>
          <button type="button" className={`${styles.navItem} ${styles.navActive}`}>
            <span className={styles.navIcon}>U</span>Users
          </button>
        </nav>
      </aside>

      <div className={styles.main}>
        <header className={styles.topbar}>
          <h1 className={styles.pageTitle}>Users</h1>
          <div className={styles.topbarRight}>
            <span className={styles.adminBadge}>
              {auth.role === 'superadmin' ? 'Superadmin' : auth.username || 'Admin'}
            </span>
            <button type="button" className={styles.logoutBtn} onClick={handleLogout}>
              Log out
            </button>
          </div>
        </header>
        <section className={styles.panel}>
          <UsersDoctorsBoard showAdminColumn={auth.role === 'superadmin'} />
        </section>
      </div>
    </div>
  );
}
