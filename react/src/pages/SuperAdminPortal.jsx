import { useEffect, useState } from 'react';
import JSZip from 'jszip';
import { apiRequest } from '../lib/apiClient';
import styles from './AdminPortal.module.css';

const csvCell = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;

function downloadFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function addDataUrlFile(zip, path, dataUrl) {
  if (!dataUrl?.startsWith('data:')) return;
  const [, base64 = ''] = dataUrl.split(',', 2);
  if (base64) zip.file(path, base64, { base64: true });
}

export default function SuperAdminPortal() {
  const [isLoggedIn, setIsLoggedIn] = useState(
    () => localStorage.getItem('super_admin_session') === 'true'
  );
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await apiRequest('/super-admin/users');
      setUsers(result.users || []);
    } catch (err) {
      setError(err.message || 'Could not load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoggedIn) loadUsers();
  }, [isLoggedIn]);

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoginError('');
    try {
      const result = await apiRequest('/super-admin/login', {
        method: 'POST',
        body: { username, password },
      });
      if (result.success) {
        localStorage.setItem('super_admin_session', 'true');
        setIsLoggedIn(true);
      }
    } catch (err) {
      setLoginError(err.message || 'Login failed');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('super_admin_session');
    setIsLoggedIn(false);
    setSelectedUser(null);
    setSelectedDoctor(null);
  };

  const selectUser = async (user) => {
    setSelectedUser(user);
    setSelectedDoctor(null);
    setLoading(true);
    setError('');
    try {
      const result = await apiRequest(`/super-admin/users/${user.id}/doctors`);
      setDoctors(result.doctors || []);
    } catch (err) {
      setError(err.message || 'Could not load doctors');
      setDoctors([]);
    } finally {
      setLoading(false);
    }
  };

  const selectDoctor = async (doctor) => {
    setLoading(true);
    setError('');
    try {
      const result = await apiRequest(
        `/super-admin/users/${selectedUser.id}/doctors/${doctor.id}`
      );
      setSelectedDoctor(result.doctor);
    } catch (err) {
      setError(err.message || 'Could not load doctor details');
    } finally {
      setLoading(false);
    }
  };

  const exportUsers = () => {
    const rows = [
      ['ID', 'Employee ID', 'Name', 'Created'],
      ...users.map((user) => [user.id, user.empid, user.name, user.createdAt || '']),
    ];
    downloadFile(new Blob([rows.map((row) => row.map(csvCell).join(',')).join('\n')], {
      type: 'text/csv;charset=utf-8;',
    }), 'users.csv');
  };

  const exportDoctors = async () => {
    if (!selectedUser) return;
    setLoading(true);
    setError('');
    try {
      const details = await Promise.all(
        doctors.map(async (doctor) => {
          const result = await apiRequest(
            `/super-admin/users/${selectedUser.id}/doctors/${doctor.id}`
          );
          return result.doctor;
        })
      );
      const zip = new JSZip();
      const rows = [['ID', 'Name', 'Degree', 'Clinic / Hospital', 'Contact Number', 'Active', 'Posters Made', 'Downloads', 'Logo File', 'Poster Files']];
      details.forEach((doctor) => {
        const safeName = `${doctor.id}-${(doctor.name || 'doctor').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
        const posterFiles = (doctor.posters || []).map((poster, index) => {
          const filename = `posters/${safeName}-${index + 1}.jpg`;
          addDataUrlFile(zip, filename, poster.image);
          return filename;
        });
        const logoFile = doctor.logo ? `logos/${safeName}.png` : '';
        if (logoFile) addDataUrlFile(zip, logoFile, doctor.logo);
        rows.push([
          doctor.id,
          doctor.name,
          doctor.doctorDegree,
          doctor.clinicName,
          doctor.contactnumber,
          doctor.active ? 'Active' : 'Inactive',
          doctor.postersMade,
          doctor.downloadCount,
          logoFile,
          posterFiles.join('; '),
        ]);
      });
      zip.file('doctors.csv', rows.map((row) => row.map(csvCell).join(',')).join('\n'));
      downloadFile(await zip.generateAsync({ type: 'blob' }), `${selectedUser.name || 'user'}-doctors.zip`);
    } catch (err) {
      setError(err.message || 'Could not export doctors');
    } finally {
      setLoading(false);
    }
  };

  if (!isLoggedIn) {
    return (
      <div className={styles.loginPage}>
        <form onSubmit={handleLogin} className={styles.loginCard}>
          <div className={styles.loginBrand}>
            <div className={styles.brandMark}>S</div>
            <div>
              <div className={styles.brandName}>MedPortal</div>
              <div className={styles.brandSub}>Super admin</div>
            </div>
          </div>
          <h1 className={styles.loginTitle}>Sign in</h1>
          {loginError && <p className={styles.error}>{loginError}</p>}
          <label className={styles.field}><span>Username</span><input value={username} onChange={(e) => setUsername(e.target.value)} required /></label>
          <label className={styles.field}><span>Password</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
          <button type="submit" className={styles.primaryBtn}>Login</button>
        </form>
      </div>
    );
  }

  const page = selectedDoctor ? 'Doctor details' : selectedUser ? `${selectedUser.name || 'User'}’s doctors` : 'Users';

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarTop}>
          <div className={styles.brandMark}>S</div>
          <div><div className={styles.brandName}>MedPortal</div><div className={styles.brandSub}>Super admin</div></div>
        </div>
        <nav className={styles.nav}>
          <p className={styles.navLabel}>Oversight</p>
          <button type="button" className={`${styles.navItem} ${!selectedUser ? styles.navActive : ''}`} onClick={() => { setSelectedUser(null); setSelectedDoctor(null); loadUsers(); }}>
            <span className={styles.navIcon}>U</span>Users
          </button>
          {selectedUser && <button type="button" className={`${styles.navItem} ${!selectedDoctor ? styles.navActive : ''}`} onClick={() => setSelectedDoctor(null)}><span className={styles.navIcon}>D</span>Doctors</button>}
        </nav>
      </aside>

      <div className={styles.main}>
        <header className={styles.topbar}>
          <h1 className={styles.pageTitle}>{page}</h1>
          <div className={styles.topbarRight}><span className={styles.adminBadge}>Super Administrator</span><button type="button" className={styles.logoutBtn} onClick={handleLogout}>Log out</button></div>
        </header>
        <section className={styles.panel}>
          {error && <p className={styles.error}>{error}</p>}
          {loading && <p className={styles.statusText}>Loading…</p>}

          {!selectedUser && <>
            <div className={styles.toolbar}><div /><button type="button" className={styles.secondaryBtn} onClick={exportUsers}>Export users</button></div>
            <div className={styles.tableCard}><table className={styles.superTable}><thead><tr><th>ID</th><th>Employee ID</th><th>Name</th><th>Created</th><th>Doctors made</th><th /></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td><code className={styles.idCell}>{user.id}</code></td><td>{user.empid || '—'}</td><td>{user.name || '—'}</td><td>{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}</td><td>{user.doctorCount}</td><td><button type="button" className={styles.editBtn} onClick={() => selectUser(user)}>View doctors</button></td></tr>)}</tbody></table>{!loading && users.length === 0 && <p className={styles.emptyState}>No users found.</p>}</div>
          </>}

          {selectedUser && !selectedDoctor && <>
            <div className={styles.toolbar}><button type="button" className={styles.secondaryBtn} onClick={() => { setSelectedUser(null); setDoctors([]); }}>← Users</button><button type="button" className={styles.secondaryBtn} onClick={exportDoctors}>Export doctors</button></div>
            <div className={styles.tableCard}><table className={styles.superTable}><thead><tr><th>Logo</th><th>Name</th><th>Degree</th><th>Clinic / Hospital</th><th>Contact Number</th><th>Posters made</th><th /></tr></thead><tbody>{doctors.map((doctor) => <tr key={doctor.id}><td>{doctor.logo ? <img src={doctor.logo} alt="" className={styles.logoThumb} /> : '—'}</td><td>{doctor.name}</td><td>{doctor.doctorDegree || '—'}</td><td>{doctor.clinicName || '—'}</td><td>{doctor.contactnumber || '—'}</td><td>{doctor.postersMade || 0}</td><td><button type="button" className={styles.editBtn} onClick={() => selectDoctor(doctor)}>View details</button></td></tr>)}</tbody></table>{!loading && doctors.length === 0 && <p className={styles.emptyState}>This user has not created any doctors yet.</p>}</div>
          </>}

          {selectedDoctor && <>
            <div className={styles.toolbar}><button type="button" className={styles.secondaryBtn} onClick={() => setSelectedDoctor(null)}>← Doctors</button><button type="button" className={styles.secondaryBtn} onClick={exportDoctors}>Export doctors</button></div>
            <div className={styles.detailCard}>
              <div className={styles.detailLogo}>{selectedDoctor.logo ? <img src={selectedDoctor.logo} alt={`${selectedDoctor.name} logo`} /> : <span>—</span>}</div>
              <div className={styles.detailGrid}>
                {[["Doctor ID", selectedDoctor.id], ["Name", selectedDoctor.name], ["Degree", selectedDoctor.doctorDegree], ["Clinic / Hospital", selectedDoctor.clinicName], ["Contact Number", selectedDoctor.contactnumber], ["Status", selectedDoctor.active ? 'Active' : 'Inactive'], ["Posters made", selectedDoctor.postersMade], ["Downloads", selectedDoctor.downloadCount], ["Created", selectedDoctor.createdAt ? new Date(selectedDoctor.createdAt).toLocaleString() : '—'], ["Last updated", selectedDoctor.updatedAt ? new Date(selectedDoctor.updatedAt).toLocaleString() : '—']].map(([label, value]) => <div key={label} className={styles.detailField}><span>{label}</span><strong>{value || '—'}</strong></div>)}
              </div>
            </div>
          </>}
        </section>
      </div>
    </div>
  );
}
