import { useEffect, useRef, useState } from 'react';
import DataTable from 'datatables.net-dt';
import 'datatables.net-dt/css/dataTables.dataTables.css';
import { apiRequest } from '../lib/apiClient';
import { canAccessPage, clearAuth, readAuth, writeAuth } from '../lib/authSession';
import StaffLogin from './StaffLogin';
import UsersDoctorsBoard from './UsersDoctorsBoard';
import styles from './AdminPortal.module.css';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

const dataTableOptions = {
  pageLength: 10,
  lengthMenu: [5, 10, 25, 50],
  paging: true,
  pagingType: 'simple_numbers',
  autoWidth: false,
  scrollX: true,
  order: [[0, 'desc']],
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

const adminColumns = [
  {
    title: 'Created',
    data: 'createdAt',
    visible: false,
    render: (data) => (data ? new Date(data).toISOString() : ''),
  },
  {
    title: 'Admin',
    data: 'username',
    className: styles.nameCell,
    render: (data) => escapeHtml(data || '—'),
  },
  {
    title: 'Users',
    data: 'userCount',
    render: (data) => String(data ?? 0),
  },
  {
    title: 'Edit',
    data: null,
    orderable: false,
    searchable: false,
    className: styles.colActions,
    render: () => `<button type="button" class="${styles.editBtn}" data-action="edit">Edit</button>`,
  },
  {
    title: 'Delete',
    data: null,
    orderable: false,
    searchable: false,
    className: styles.colActions,
    render: () => `<button type="button" class="${styles.deleteBtn}" data-action="delete">Delete</button>`,
  },
];

export default function SuperAdminPortal() {
  const [auth, setAuth] = useState(() => readAuth());
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginFieldErrors, setLoginFieldErrors] = useState({});
  const [admins, setAdmins] = useState([]);
  const [selectedAdmin, setSelectedAdmin] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState(null);
  const [form, setForm] = useState({ username: '', password: '' });
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [boardContext, setBoardContext] = useState({ user: null, doctor: null });
  const hostRef = useRef(null);
  const actionRef = useRef({});

  const isLoggedIn = canAccessPage(auth, 'superadmin');

  const loadAdmins = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await apiRequest('/superadmin/admins');
      const list = [...(result.admins || [])].sort(
        (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      );
      setAdmins(list);
    } catch (err) {
      setError(err.message || 'Could not load admins');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoggedIn && !selectedAdmin) loadAdmins();
  }, [isLoggedIn, selectedAdmin]);

  actionRef.current = {
    open: (admin) => setSelectedAdmin(admin),
    edit: (admin) => {
      setEditingAdmin(admin);
      setForm({ username: admin.username || '', password: '' });
      setShowModal(true);
    },
    remove: async (admin) => {
      if (!window.confirm(`Delete admin ${admin.username} and every user and doctor under them?`)) return;
      try {
        await apiRequest(`/superadmin/admins/${admin.id}`, { method: 'DELETE' });
        loadAdmins();
      } catch (err) {
        setError(err.message || 'Could not delete admin');
      }
    },
  };

  useEffect(() => {
    if (!isLoggedIn || selectedAdmin || !hostRef.current) return undefined;

    const host = hostRef.current;
    host.innerHTML = '';
    const tableEl = document.createElement('table');
    tableEl.className = `display ${styles.table}`;
    tableEl.style.width = '100%';
    host.appendChild(tableEl);

    const table = new DataTable(tableEl, {
      ...dataTableOptions,
      data: admins,
      columns: adminColumns,
    });

    function onClick(event) {
      const button = event.target.closest('button[data-action]');
      const row = event.target.closest('tbody tr');
      if (!row) return;
      const admin = table.row(row).data();
      if (!admin) return;
      event.preventDefault();
      event.stopPropagation();
      const action = button?.getAttribute('data-action');
      if (action === 'edit') {
        actionRef.current.edit(admin);
        return;
      }
      if (action === 'delete') {
        actionRef.current.remove(admin);
        return;
      }
      actionRef.current.open(admin);
    }

    host.addEventListener('click', onClick);
    return () => {
      host.removeEventListener('click', onClick);
      table.destroy();
      host.innerHTML = '';
    };
  }, [isLoggedIn, selectedAdmin, admins]);

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
      const result = await apiRequest('/superadmin/login', {
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
    setSelectedAdmin(null);
    apiRequest('/logout', { method: 'POST' }).catch(() => {});
  };

  const openCreate = () => {
    setEditingAdmin(null);
    setForm({ username: '', password: '' });
    setFormErrors({});
    setShowModal(true);
  };

  const saveAdmin = async (event) => {
    event.preventDefault();

    const errors = {};
    if (!form.username.trim()) errors.username = 'Username is required';
    if (!editingAdmin && !form.password) errors.password = 'Password is required';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});

    setSaving(true);
    setError('');
    try {
      if (editingAdmin) {
        await apiRequest(`/superadmin/admins/${editingAdmin.id}`, {
          method: 'PUT',
          body: form,
        });
      } else {
        await apiRequest('/superadmin/admins', {
          method: 'POST',
          body: form,
        });
      }
      setShowModal(false);
      setSaving(false);
      loadAdmins();
    } catch (err) {
      setError(err.message || 'Could not save admin');
      setSaving(false);
    }
  };

  if (!isLoggedIn) {
    return (
      <StaffLogin
        mark="S"
        subtitle="Superadmin"
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
      <aside className={styles.sidebar}>
        <div className={styles.sidebarTop}>
          <div className={styles.brandMark}>S</div>
          <div>
            <div className={styles.brandName}>MedPortal</div>
            <div className={styles.brandSub}>Superadmin</div>
          </div>
        </div>
        <nav className={styles.nav}>
          <p className={styles.navLabel}>Oversight</p>
          <button
            type="button"
            className={`${styles.navItem} ${!selectedAdmin ? styles.navActive : ''}`}
            onClick={() => setSelectedAdmin(null)}
          >
            <span className={styles.navIcon}>A</span>Admins
          </button>
          {selectedAdmin && (
            <button type="button" className={`${styles.navItem} ${styles.navActive}`}>
              <span className={styles.navIcon}>U</span>
              {selectedAdmin.username}
            </button>
          )}
        </nav>
      </aside>

      <div className={styles.main}>
        <header className={styles.topbar}>
          {selectedAdmin ? (
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => {
                if (boardContext.onNavigateBack) {
                  boardContext.onNavigateBack();
                  return;
                }
                setBoardContext({ user: null, doctor: null });
                setSelectedAdmin(null);
              }}
            >
              {boardContext.backLabel || '← Admins'}
            </button>
          ) : (
            <h1 className={styles.pageTitle}>Admins</h1>
          )}
          <div className={styles.topbarRight}>
            <div id="topbar-actions" style={{ display: 'flex', gap: '10px' }} />
            <span className={styles.adminBadge}>Superadmin</span>
            <button type="button" className={styles.logoutBtn} onClick={handleLogout}>
              Log out
            </button>
          </div>
        </header>
        <section className={styles.panel}>
          {error && <p className={styles.error}>{error}</p>}

          {!selectedAdmin && (
            <>
              <div className={styles.toolbar}>
                <div />
                <button type="button" className={styles.primaryBtn} onClick={openCreate}>
                  + Add
                </button>
              </div>
              {loading && <p className={styles.statusText}>Loading…</p>}
              <div className={styles.tableCard}>
                <div ref={hostRef} className={styles.dtHost} />
                {!loading && admins.length === 0 && (
                  <p className={styles.emptyState}>No admins found.</p>
                )}
              </div>
            </>
          )}

          {selectedAdmin && (
            <UsersDoctorsBoard
              adminId={selectedAdmin.id}
              adminName={selectedAdmin.username}
              onBack={() => {
                setBoardContext({ user: null, doctor: null });
                setSelectedAdmin(null);
              }}
              onContextChange={setBoardContext}
            />
          )}
        </section>
      </div>

      {showModal && (
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <h2 className={styles.modalTitle}>{editingAdmin ? 'Edit admin' : 'Add admin'}</h2>
            <form onSubmit={saveAdmin} className={styles.form}>
              <label className={styles.field}>
                <span>Username</span>
                <input
                  value={form.username}
                  onChange={(event) => {
                    setForm((prev) => ({ ...prev, username: event.target.value }));
                    if (formErrors.username) setFormErrors((prev) => ({ ...prev, username: null }));
                  }}
                />
                {formErrors.username && <span className={styles.fieldError}>{formErrors.username}</span>}
              </label>
              <label className={styles.field}>
                <span>{editingAdmin ? 'Password (leave blank to keep)' : 'Password'}</span>
                <input
                  type="password"
                  value={form.password}
                  onChange={(event) => {
                    setForm((prev) => ({ ...prev, password: event.target.value }));
                    if (formErrors.password) setFormErrors((prev) => ({ ...prev, password: null }));
                  }}
                  autoComplete="new-password"
                />
                {formErrors.password && <span className={styles.fieldError}>{formErrors.password}</span>}
              </label>
              <div className={styles.modalActions}>
                <button type="button" className={styles.secondaryBtn} onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className={styles.primaryBtn} disabled={saving}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
