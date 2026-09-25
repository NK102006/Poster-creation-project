import { useEffect, useRef, useState } from 'react';
import DataTable from 'datatables.net-dt';
import 'datatables.net-dt/css/dataTables.dataTables.css';
import JSZip from 'jszip';
import { apiRequest } from '../lib/apiClient';
import { canAccessPage, clearAuth, readAuth, writeAuth } from '../lib/authSession';
import StaffLogin from './StaffLogin';
import { validatePassword } from '../features/auth/validators';
import UsersDoctorsBoard from './UsersDoctorsBoard';
import styles from './AdminPortal.module.css';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api').replace(
  /\/$/,
  ''
);

function getItemId(item) {
  return item?.id || item?._id || '';
}

const safeFilePart = (str, fallback) => {
  const safe = String(str || '').replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  return safe || fallback;
};

const inferPosterKind = (poster) => poster.kind || 'education';
const posterExtension = (poster, kind) => {
  if (kind === 'video') return 'mp4';
  if (poster.image && poster.image.startsWith('data:image/png')) return 'png';
  return 'jpg';
};

const addFileToZip = async (zip, path, urlOrData) => {
  if (!urlOrData) return;
  if (urlOrData.startsWith('data:')) {
    const [, base64 = ''] = urlOrData.split(',', 2);
    if (base64) zip.file(path, base64, { base64: true });
  } else if (urlOrData.startsWith('http') || urlOrData.startsWith('/')) {
    try {
      const res = await fetch(urlOrData);
      if (res.ok) zip.file(path, await res.blob());
    } catch (err) {
      console.warn('Failed to fetch file for zip:', urlOrData, err);
    }
  }
};

function formatLabel(key) {
  if (key === 'empid') return 'Employee ID';
  if (key === 'contactnumber') return 'Contact Number';
  if (key === 'clinicName') return 'Clinic / Hospital';
  if (key === 'doctorDegree') return 'Degree';
  if (key === 'password') return 'Password';
  if (key === 'createdAt') return 'Created';
  return key.charAt(0).toUpperCase() + key.slice(1);
}

export default function AdminPortal() {
  const [auth, setAuth] = useState(() => readAuth('admin'));
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginFieldErrors, setLoginFieldErrors] = useState({});
  const [exportError, setExportError] = useState('');
  const [boardContext, setBoardContext] = useState({ backLabel: '', onNavigateBack: null });
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isLoggedIn = canAccessPage(auth, 'admin');

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoginError('');

    const errors = {};
    if (!username.trim()) errors.username = 'Username is required';
    const loginPasswordError = validatePassword(password);
    if (loginPasswordError) errors.password = loginPasswordError;
    if (Object.keys(errors).length > 0) {
      setLoginFieldErrors(errors);
      return;
    }
    setLoginFieldErrors({});
    try {
      const result = await apiRequest('/admin/login', {
        method: 'POST',
        body: { username, password },
      });
      if (result.success) {
        setAuth(writeAuth(result.auth, 'admin'));
      }
    } catch (err) {
      setLoginError(err.message || 'Login failed');
    }
  };

  const handleLogout = () => {
    clearAuth('admin');
    setAuth(null);
    setUsername('');
    setPassword('');
    setLoginError('');
    setLoginFieldErrors({});
    apiRequest('/logout', { method: 'POST' }).catch(() => {});
  };

  const handleExportAll = async () => {
    try {
      const [users, doctors] = await Promise.all([
        apiRequest('/admin/collections/users'),
        apiRequest('/admin/collections/doctors')
      ]);

      if ((!users || users.length === 0) && (!doctors || doctors.length === 0)) {
        setExportError('No data available to export');
        setTimeout(() => setExportError(''), 3000);
        return;
      }

      const zip = new JSZip();

      for (const user of users) {
        const userFolderName = safeFilePart(user.empid || user.id, `User_${user.id}`);
        const userFolder = zip.folder(userFolderName);
        const userDoctors = doctors.filter(d => d.ownerUser === user.id);
        
        for (const doctor of userDoctors) {
          const docFolderName = safeFilePart(doctor.name, `Doctor_${doctor.id}`);
          const docFolder = userFolder.folder(docFolderName);
          
          if (doctor.logo) {
            await addFileToZip(docFolder, `logos/${docFolderName}.png`, doctor.logo);
          }
          
          const counts = { education: 0, festival: 0, video: 0 };
          for (const poster of doctor.posters || []) {
            const kind = inferPosterKind(poster);
            counts[kind] += 1;
            const ext = posterExtension(poster, kind);
            const label = safeFilePart(poster.label, `poster-${counts[kind]}`);
            const filename = `${kind}/${label}.${ext}`;
            await addFileToZip(docFolder, filename, poster.image);
          }
        }
      }
      
      const unassigned = doctors.filter(d => !d.ownerUser);
      if (unassigned.length > 0) {
        const unassignedFolder = zip.folder('Unassigned_Doctors');
        for (const doctor of unassigned) {
          const docFolderName = safeFilePart(doctor.name, `Doctor_${doctor.id}`);
          const docFolder = unassignedFolder.folder(docFolderName);
          
          if (doctor.logo) {
            await addFileToZip(docFolder, `logos/${docFolderName}.png`, doctor.logo);
          }
          
          const counts = { education: 0, festival: 0, video: 0 };
          for (const poster of doctor.posters || []) {
            const kind = inferPosterKind(poster);
            counts[kind] += 1;
            const ext = posterExtension(poster, kind);
            const label = safeFilePart(poster.label, `poster-${counts[kind]}`);
            const filename = `${kind}/${label}.${ext}`;
            await addFileToZip(docFolder, filename, poster.image);
          }
        }
      }

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'All_Employees_And_Doctors.zip';
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Export All failed: ' + err.message);
    }
  };

  if (!isLoggedIn) {
    return (
      <StaffLogin
        mark="A"
        subtitle="Admin"
        error={loginError}
        username={username}
        password={password}
        onUsername={(val) => {
          setUsername(val);
          if (loginFieldErrors.username) setLoginFieldErrors((prev) => ({ ...prev, username: null }));
        }}
        onPassword={(val) => {
          setPassword(val);
          if (loginFieldErrors.password) setLoginFieldErrors((prev) => ({ ...prev, password: null }));
        }}
        onSubmit={handleLogin}
        fieldErrors={loginFieldErrors}
      />
    );
  }

  return (
    <div className={styles.shell}>
      <div 
        className={`${styles.sidebarOverlay} ${sidebarOpen ? styles.open : ''} ${styles.mobileOnly}`} 
        onClick={() => setSidebarOpen(false)}
      />
      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.open : ''}`}>
        <div className={styles.sidebarTop} onClick={() => { window.location.href = '/'; }} style={{ cursor: 'pointer' }}>
          <div className={styles.brandMark}>A</div>
          <div>
            <div className={styles.brandName}>MedPortal</div>
            <div className={styles.brandSub}>Admin</div>
          </div>
        </div>
        <nav className={styles.nav}>
          <p className={styles.navLabel}>Collections</p>
          <button type="button" className={`${styles.navItem} ${styles.navActive}`}>
            <span className={styles.navIcon}>E</span>Employees
          </button>
        </nav>

        <div className={`${styles.sidebarMobileActions} ${styles.mobileOnly}`}>
          <div id="topbar-actions-mobile" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }} />
          <button type="button" className={styles.sidebarLogout} onClick={handleLogout}>
            Log out
          </button>
        </div>
      </aside>

      <div className={styles.main}>
        <header className={styles.topbar}>
          <button 
            type="button" 
            className={`${styles.hamburgerBtn} ${styles.mobileOnly}`} 
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
          <div id="topbar-left" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {boardContext.backLabel && (
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => boardContext.onNavigateBack?.()}
              >
                {boardContext.backLabel}
              </button>
            )}
          </div>
          <div className={styles.topbarRight}>
            <div id="topbar-actions" className={styles.desktopOnly} style={{ gap: '10px' }} />
            <span className={styles.adminBadge}>
              {auth.role === 'superadmin' ? 'Superadmin' : auth.username || 'Admin'}
            </span>
            <button type="button" className={`${styles.logoutBtn} ${styles.desktopOnly}`} onClick={handleLogout}>
              Log out
            </button>
          </div>
        </header>
        {exportError && <p className={styles.error} style={{ margin: '16px 24px 0' }}>{exportError}</p>}
        <section className={styles.panel}>
          <UsersDoctorsBoard
            showAdminColumn={auth.role === 'superadmin'}
            adminName={auth.username || 'Admin'}
            onContextChange={setBoardContext}
          />
        </section>
      </div>
    </div>
  );
}
