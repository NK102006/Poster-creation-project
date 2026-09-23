import { useEffect, useRef, useState } from 'react';
import DataTable from 'datatables.net-dt';
import 'datatables.net-dt/css/dataTables.dataTables.css';
import JSZip from 'jszip';
import { apiRequest } from '../lib/apiClient';
import styles from './AdminPortal.module.css';

const csvCell = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;

const POSTER_FOLDERS = ['education', 'festival', 'video'];

function downloadFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function inferPosterKind(poster) {
  const raw = String(poster?.kind || '').toLowerCase();
  if (raw === 'festival' || raw === 'video' || raw === 'education') return raw;
  if (raw === 'gk') return 'education';
  const src = String(poster?.image || '');
  if (src.includes('.mp4') || src.includes('video') || src.startsWith('data:video')) {
    return 'video';
  }
  return 'education';
}

function posterExtension(poster, kind) {
  const src = String(poster?.image || '');
  if (kind === 'video' || src.includes('.mp4') || src.startsWith('data:video')) return 'mp4';
  if (src.includes('.png')) return 'png';
  return 'jpg';
}

function posterGalleryStyle(count) {
  if (count <= 1) {
    return { gridTemplateColumns: 'minmax(320px, 480px)', justifyContent: 'center' };
  }
  if (count <= 2) {
    return { gridTemplateColumns: 'repeat(2, minmax(280px, 1fr))' };
  }
  if (count <= 4) {
    return { gridTemplateColumns: 'repeat(2, minmax(260px, 1fr))' };
  }
  if (count <= 6) {
    return { gridTemplateColumns: 'repeat(3, minmax(240px, 1fr))' };
  }
  return { gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' };
}

function safeFilePart(value, fallback) {
  const cleaned = String(value || '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return cleaned || fallback;
}

async function addFileToZip(zip, path, urlOrData) {
  if (!urlOrData) return;
  if (urlOrData.startsWith('data:')) {
    const [, base64 = ''] = urlOrData.split(',', 2);
    if (base64) zip.file(path, base64, { base64: true });
  } else if (urlOrData.startsWith('http')) {
    try {
      const res = await fetch(urlOrData);
      if (res.ok) zip.file(path, await res.blob());
    } catch (err) {
      console.warn('Failed to fetch file for zip:', urlOrData, err);
    }
  }
}

const dataTableOptions = {
  pageLength: 10,
  lengthMenu: [5, 10, 25, 50],
  paging: true,
  pagingType: 'simple_numbers',
  autoWidth: false,
  scrollX: true,
  layout: {
    topStart: 'pageLength',
    topEnd: 'search',
    bottomStart: 'info',
    bottomEnd: 'paging',
  },
  language: {
    search: 'Search:',
    lengthMenu: 'Show _MENU_',
    info: '_START_–_END_ of _TOTAL_',
    infoEmpty: 'No records',
    zeroRecords: 'No matching records found',
    processing: 'Loading…',
    paginate: { previous: 'Prev', next: 'Next' },
  },
};

const userColumns = [
  {
    title: 'ID',
    data: 'id',
    className: styles.colId,
    render: (data) => `<code class="${styles.idCell}" title="${escapeHtml(data)}">${escapeHtml(data)}</code>`,
  },
  {
    title: 'Employee ID',
    data: 'empid',
    className: styles.nameCell,
    render: (data) => escapeHtml(data || '—'),
  },
  {
    title: 'Doctors made',
    data: 'doctorCount',
    render: (data) => String(data ?? 0),
  },
  {
    title: '',
    data: null,
    orderable: false,
    searchable: false,
    className: styles.colActions,
    render: () => `<button type="button" class="${styles.editBtn}" data-action="view-doctors">View doctors</button>`,
  },
];

const doctorColumns = [
  {
    title: 'Logo',
    data: 'logo',
    orderable: false,
    searchable: false,
    render: (logo) =>
      logo ? `<img src="${escapeHtml(logo)}" alt="" class="${styles.logoThumb}" />` : '—',
  },
  {
    title: 'Name',
    data: 'name',
    className: styles.nameCell,
    render: (data) => escapeHtml(data || '—'),
  },
  {
    title: 'Degree',
    data: 'doctorDegree',
    render: (data) => escapeHtml(data || '—'),
  },
  {
    title: 'Clinic / Hospital',
    data: 'clinicName',
    render: (data) => escapeHtml(data || '—'),
  },
  {
    title: 'Contact Number',
    data: 'contactnumber',
    render: (data) => escapeHtml(data || '—'),
  },
  {
    title: 'Posters made',
    data: 'postersMade',
    render: (data) => String(data ?? 0),
  },
  {
    title: '',
    data: null,
    orderable: false,
    searchable: false,
    className: styles.colActions,
    render: () => `<button type="button" class="${styles.editBtn}" data-action="view-details">View details</button>`,
  },
];

function useDataTable({ enabled, data, columns, onRowAction }) {
  const hostRef = useRef(null);
  const tableRef = useRef(null);
  const actionRef = useRef(onRowAction);
  actionRef.current = onRowAction;

  useEffect(() => {
    if (!enabled || !hostRef.current) return undefined;

    const host = hostRef.current;
    host.innerHTML = '';
    const tableEl = document.createElement('table');
    tableEl.className = `display ${styles.table}`;
    tableEl.style.width = '100%';
    host.appendChild(tableEl);

    const table = new DataTable(tableEl, {
      ...dataTableOptions,
      data,
      columns,
    });

    function onClick(event) {
      const button = event.target.closest('button[data-action]');
      const row = event.target.closest('tr');
      if (!button || !row) return;
      event.preventDefault();
      event.stopPropagation();
      actionRef.current?.(button.getAttribute('data-action'), table.row(row).data());
    }

    host.addEventListener('click', onClick);
    tableRef.current = table;

    return () => {
      host.removeEventListener('click', onClick);
      table.destroy();
      tableRef.current = null;
      host.innerHTML = '';
    };
  }, [enabled, data, columns]);

  return hostRef;
}

export default function SuperAdminPortal() {
  const [isLoggedIn, setIsLoggedIn] = useState(
    () => localStorage.getItem('super_admin_session') === 'true'
  );
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginFieldErrors, setLoginFieldErrors] = useState({});
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPosters, setShowPosters] = useState(false);
  const [selectedPosterToDownload, setSelectedPosterToDownload] = useState(null);

  const handleForceDownload = async (url, filename) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Download failed', err);
      window.open(url, '_blank');
    }
  };

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

  useEffect(() => {
    if (!showPosters) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setShowPosters(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showPosters]);

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoginError('');

    const errors = {};
    if (!username.trim()) errors.username = 'Username is required';
    if (!password) errors.password = 'Password is required';
    if (Object.keys(errors).length > 0) {
      setLoginFieldErrors(errors);
      return;
    }
    setLoginFieldErrors({});

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
    setShowPosters(false);
  };

  const selectUser = async (user) => {
    setSelectedUser(user);
    setSelectedDoctor(null);
    setShowPosters(false);
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
      setShowPosters(false);
    } catch (err) {
      setError(err.message || 'Could not load doctor details');
    } finally {
      setLoading(false);
    }
  };

  const usersHostRef = useDataTable({
    enabled: isLoggedIn && !selectedUser,
    data: users,
    columns: userColumns,
    onRowAction: (_action, user) => {
      if (user) selectUser(user);
    },
  });

  const doctorsHostRef = useDataTable({
    enabled: isLoggedIn && Boolean(selectedUser) && !selectedDoctor,
    data: doctors,
    columns: doctorColumns,
    onRowAction: (_action, doctor) => {
      if (doctor) selectDoctor(doctor);
    },
  });

  const exportUsers = () => {
    const rows = [
      ['ID', 'Employee ID', 'Doctors made'],
      ...users.map((user) => [user.id, user.empid, user.doctorCount ?? 0]),
    ];
    downloadFile(
      new Blob([rows.map((row) => row.map(csvCell).join(',')).join('\r\n')], {
        type: 'text/csv;charset=utf-8;',
      }),
      'users.csv'
    );
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
      POSTER_FOLDERS.forEach((folder) => zip.folder(folder));
      zip.folder('logos');

      const rows = [[
        'ID',
        'Name',
        'Degree',
        'Clinic / Hospital',
        'Contact Number',
        'Active',
        'Posters Made',
        'Downloads',
        'Logo File',
        'Education Files',
        'Festival Files',
        'Video Files',
      ]];

      for (const doctor of details) {
        const safeName = `${doctor.id}-${safeFilePart(doctor.name, 'doctor')}`;
        const filesByKind = { education: [], festival: [], video: [] };
        const counts = { education: 0, festival: 0, video: 0 };

        for (const poster of doctor.posters || []) {
          const kind = inferPosterKind(poster);
          counts[kind] += 1;
          const ext = posterExtension(poster, kind);
          const label = safeFilePart(poster.label, `poster-${counts[kind]}`);
          const filename = `${kind}/${safeName}-${label}.${ext}`;
          await addFileToZip(zip, filename, poster.image);
          filesByKind[kind].push(filename);
        }

        const logoFile = doctor.logo ? `logos/${safeName}.png` : '';
        if (logoFile) await addFileToZip(zip, logoFile, doctor.logo);

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
          filesByKind.education.join('; '),
          filesByKind.festival.join('; '),
          filesByKind.video.join('; '),
        ]);
      }

      zip.file('doctors.csv', rows.map((row) => row.map(csvCell).join(',')).join('\r\n'));
      downloadFile(
        await zip.generateAsync({ type: 'blob' }),
        `${selectedUser.empid || 'user'}-doctors.zip`
      );
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
          <label className={styles.field}>
            <span>Username</span>
            <input 
              value={username} 
              onChange={(e) => {
                setUsername(e.target.value);
                if (loginFieldErrors.username) setLoginFieldErrors((prev) => ({ ...prev, username: null }));
              }} 
            />
            {loginFieldErrors.username && <span className={styles.fieldError}>{loginFieldErrors.username}</span>}
          </label>
          <label className={styles.field}>
            <span>Password</span>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => {
                setPassword(e.target.value);
                if (loginFieldErrors.password) setLoginFieldErrors((prev) => ({ ...prev, password: null }));
              }} 
            />
            {loginFieldErrors.password && <span className={styles.fieldError}>{loginFieldErrors.password}</span>}
          </label>
          <button type="submit" className={styles.primaryBtn}>Login</button>
        </form>
      </div>
    );
  }

  const page = selectedDoctor
    ? 'Doctor details'
    : selectedUser
      ? `${selectedUser.empid || 'User'}’s doctors`
      : 'Users';

  const doctorPosters = selectedDoctor?.posters || [];

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarTop}>
          <div className={styles.brandMark}>S</div>
          <div>
            <div className={styles.brandName}>MedPortal</div>
            <div className={styles.brandSub}>Super admin</div>
          </div>
        </div>
        <nav className={styles.nav}>
          <p className={styles.navLabel}>Oversight</p>
          <button
            type="button"
            className={`${styles.navItem} ${!selectedUser ? styles.navActive : ''}`}
            onClick={() => {
              setSelectedUser(null);
              setSelectedDoctor(null);
              loadUsers();
            }}
          >
            <span className={styles.navIcon}>U</span>Users
          </button>
          {selectedUser && (
            <button
              type="button"
              className={`${styles.navItem} ${!selectedDoctor ? styles.navActive : ''}`}
              onClick={() => setSelectedDoctor(null)}
            >
              <span className={styles.navIcon}>D</span>Doctors
            </button>
          )}
        </nav>
      </aside>

      <div className={styles.main}>
        <header className={styles.topbar}>
          <h1 className={styles.pageTitle}>{page}</h1>
          <div className={styles.topbarRight}>
            <span className={styles.adminBadge}>Super Administrator</span>
            <button type="button" className={styles.logoutBtn} onClick={handleLogout}>Log out</button>
          </div>
        </header>
        <section className={styles.panel}>
          {error && <p className={styles.error}>{error}</p>}
          {loading && <p className={styles.statusText}>Loading…</p>}

          {!selectedUser && (
            <>
              <div className={styles.toolbar}>
                <div />
                <button type="button" className={styles.secondaryBtn} onClick={exportUsers}>
                  Export users
                </button>
              </div>
              <div className={styles.tableCard}>
                <div ref={usersHostRef} className={styles.dtHost} />
                {!loading && users.length === 0 && <p className={styles.emptyState}>No users found.</p>}
              </div>
            </>
          )}

          {selectedUser && !selectedDoctor && (
            <>
              <div className={styles.toolbar}>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => {
                    setSelectedUser(null);
                    setDoctors([]);
                  }}
                >
                  ← Users
                </button>
                <button type="button" className={styles.secondaryBtn} onClick={exportDoctors}>
                  Export doctors
                </button>
              </div>
              <div className={styles.tableCard}>
                <div ref={doctorsHostRef} className={styles.dtHost} />
                {!loading && doctors.length === 0 && (
                  <p className={styles.emptyState}>This user has not created any doctors yet.</p>
                )}
              </div>
            </>
          )}

          {selectedDoctor && (
            <>
              <div className={styles.toolbar}>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => {
                    setShowPosters(false);
                    setSelectedPosterToDownload(null);
                    setSelectedDoctor(null);
                  }}
                >
                  ← Doctors
                </button>
                <div className={styles.toolbarActions}>
                  <button type="button" className={styles.primaryBtn} onClick={() => setShowPosters(true)}>
                    Show posters
                  </button>
                  <button type="button" className={styles.secondaryBtn} onClick={exportDoctors}>
                    Export doctors
                  </button>
                </div>
              </div>
              <div className={styles.detailCard}>
                <div className={styles.detailLogo}>
                  {selectedDoctor.logo ? (
                    <img src={selectedDoctor.logo} alt={`${selectedDoctor.name} logo`} />
                  ) : (
                    <span>—</span>
                  )}
                </div>
                <div className={styles.detailGrid}>
                  {[
                    ['Doctor ID', selectedDoctor.id],
                    ['Name', selectedDoctor.name],
                    ['Degree', selectedDoctor.doctorDegree],
                    ['Clinic / Hospital', selectedDoctor.clinicName],
                    ['Contact Number', selectedDoctor.contactnumber],
                    ['Status', selectedDoctor.active ? 'Active' : 'Inactive'],
                    ['Posters made', selectedDoctor.postersMade],
                    ['Downloads', selectedDoctor.downloadCount],
                    ['Created', selectedDoctor.createdAt ? new Date(selectedDoctor.createdAt).toLocaleString() : '—'],
                    ['Last updated', selectedDoctor.updatedAt ? new Date(selectedDoctor.updatedAt).toLocaleString() : '—'],
                  ].map(([label, value]) => (
                    <div key={label} className={styles.detailField}>
                      <span>{label}</span>
                      <strong>{value || '—'}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      {showPosters && selectedDoctor && (
        <div className={styles.posterOverlay} role="dialog" aria-modal="true" aria-label="Doctor posters">
          <div className={styles.posterOverlayHeader}>
            <div>
              <p className={styles.previewEyebrow}>Posters</p>
              <h2>{selectedDoctor.name}</h2>
              <p className={styles.previewMeta}>
                {doctorPosters.length} {doctorPosters.length === 1 ? 'poster' : 'posters'}
              </p>
            </div>
            <button type="button" className={styles.secondaryBtn} onClick={() => setShowPosters(false)}>
              Close
            </button>
          </div>
          <div className={styles.posterOverlayBody}>
            {doctorPosters.length === 0 ? (
              <p className={styles.posterEmpty}>No posters yet.</p>
            ) : (
              <div className={styles.posterGallery} style={posterGalleryStyle(doctorPosters.length)}>
                {doctorPosters.map((poster, index) => {
                  const kind = inferPosterKind(poster);
                  return (
                    <div 
                      key={poster.id || index} 
                      className={styles.posterOverlayItem}
                      onClick={() => setSelectedPosterToDownload(poster)}
                      style={{ cursor: 'pointer' }}
                    >
                      {kind === 'video' ? (
                        <video src={poster.image} controls playsInline preload="metadata" />
                      ) : (
                        <img src={poster.image} alt={poster.label || `Poster ${index + 1}`} />
                      )}
                      <em>{poster.label || `Poster ${index + 1}`}</em>
                      <small>{kind}</small>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {selectedPosterToDownload && selectedDoctor && (
        <div className={styles.posterOverlay} style={{ zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }} onClick={() => setSelectedPosterToDownload(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', padding: 20, borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: '90%', maxHeight: '90%' }}>
            {inferPosterKind(selectedPosterToDownload) === 'video' ? (
              <video src={selectedPosterToDownload.image} controls style={{ maxHeight: '70vh', maxWidth: '100%' }} />
            ) : (
              <img src={selectedPosterToDownload.image} alt="Poster" style={{ maxHeight: '70vh', maxWidth: '100%', objectFit: 'contain' }} />
            )}
            <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
              <button className={styles.secondaryBtn} onClick={() => setSelectedPosterToDownload(null)}>Close</button>
              <button 
                type="button"
                onClick={() => handleForceDownload(selectedPosterToDownload.image, `Poster_${selectedDoctor.name}_${selectedPosterToDownload.label || 'download'}`)}
                className={styles.primaryBtn} 
              >
                Download
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
