import { useEffect, useRef, useState } from 'react';
import DataTable from 'datatables.net-dt';
import 'datatables.net-dt/css/dataTables.dataTables.css';
import { apiRequest } from '../lib/apiClient';
import { canAccessPage, clearAuth, readAuth, writeAuth } from '../lib/authSession';
import StaffLogin from './StaffLogin';
import { sanitizePhoneInput, validatePassword, validatePhoneNumber } from '../features/auth/validators';
import styles from './AdminPortal.module.css';

function getItemId(item) {
  return item?.id || item?._id || '';
}

function formatLabel(key) {
  if (key === 'contactnumber') return 'Contact Number';
  if (key === 'clinicName') return 'Clinic / Hospital';
  if (key === 'doctorDegree') return 'Degree';
  return key.charAt(0).toUpperCase() + key.slice(1);
}

export default function UserPanel() {
  const [auth, setAuth] = useState(() => readAuth());
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginFieldErrors, setLoginFieldErrors] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({});
  const [formFieldErrors, setFormFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const hostRef = useRef(null);
  const tableRef = useRef(null);

  const isLoggedIn = canAccessPage(auth, 'userpanel');

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoginError('');

    const errors = {};
    if (!username.trim()) errors.username = 'Username or Employee ID is required';
    const loginPasswordError = validatePassword(password);
    if (loginPasswordError) errors.password = loginPasswordError;

    if (Object.keys(errors).length > 0) {
      setLoginFieldErrors(errors);
      return;
    }
    setLoginFieldErrors({});

    try {
      const result = await apiRequest('/userpanel/login', {
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

  const reloadTable = () => {
    tableRef.current?.ajax?.reload(null, false);
  };

  useEffect(() => {
    if (!isLoggedIn) return undefined;

    const openEdit = (item) => {
      setEditingItem(item);
      setFormData({ ...item });
      setShowModal(true);
    };

    const removeRow = async (id) => {
      if (!window.confirm('Delete this record? This cannot be undone.')) return;
      try {
        await apiRequest(`/admin/collections/doctors/${id}`, { method: 'DELETE' });
        reloadTable();
      } catch (err) {
        alert('Delete failed: ' + err.message);
      }
    };

    window.__userPanel = { openEdit, removeRow };
    return () => {
      delete window.__userPanel;
    };
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn || !hostRef.current) return undefined;

    const host = hostRef.current;
    host.innerHTML = '';
    const tableEl = document.createElement('table');
    tableEl.className = `display ${styles.table}`;
    tableEl.style.width = '100%';
    host.appendChild(tableEl);

    const table = new DataTable(tableEl, {
      serverSide: true,
      processing: true,
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
      ajax: (request, callback) => {
        const params = new URLSearchParams();
        params.set('draw', request.draw);
        params.set('start', request.start);
        params.set('length', request.length);
        params.set('search[value]', request.search?.value || '');
        params.set('order[0][column]', request.order?.[0]?.column ?? 0);
        params.set('order[0][dir]', request.order?.[0]?.dir ?? 'desc');
        apiRequest(`/admin/datatables/doctors?${params}`)
          .then((result) => callback(result))
          .catch(() => callback({
            draw: request.draw,
            recordsTotal: 0,
            recordsFiltered: 0,
            data: [],
          }));
      },
      columns: [
        {
          title: 'ID',
          data: 'id',
          className: styles.colId,
          render: (data) => `<code class="${styles.idCell}" title="${data}">${data}</code>`,
        },
        { title: 'Name', data: 'name', className: styles.nameCell },
        {
          title: 'Clinic / Hospital',
          data: 'clinicName',
          render: (data) => data || '—',
        },
        {
          title: 'Contact Number',
          data: 'contactnumber',
          render: (data) => data || '—',
        },
        {
          title: 'Degree',
          data: 'doctorDegree',
          render: (data) => data || '—',
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
          render: () => {
            return `<button type="button" class="${styles.deleteBtn}" data-action="delete">Delete</button>`;
          },
        },
      ],
      language: {
        search: 'Search:',
        lengthMenu: 'Show _MENU_',
        info: '_START_–_END_ of _TOTAL_',
        infoEmpty: 'No records',
        zeroRecords: 'No matching records found',
        processing: 'Loading…',
        paginate: { previous: 'Prev', next: 'Next' },
      },
    });

    function onClick(event) {
      const button = event.target.closest('button[data-action]');
      const row = event.target.closest('tbody tr');
      if (!row) return;
      const rowData = table.row(row).data();
      if (!rowData) return;
      event.preventDefault();
      event.stopPropagation();
      if (button?.getAttribute('data-action') === 'delete') {
        window.__userPanel?.removeRow(getItemId(rowData));
        return;
      }
      window.__userPanel?.openEdit(rowData);
    }

    host.addEventListener('click', onClick);
    tableRef.current = table;

    return () => {
      host.removeEventListener('click', onClick);
      table.destroy();
      tableRef.current = null;
      host.innerHTML = '';
    };
  }, [isLoggedIn]);

  const openCreate = () => {
    setEditingItem(null);
    setFormData({ name: '', clinicName: '', contactnumber: '', doctorDegree: '' });
    setFormFieldErrors({});
    setShowModal(true);
  };

  const handleSave = async (event) => {
    event.preventDefault();

    const errors = {};
    const requiredFields = ['name', 'doctorDegree', 'clinicName', 'contactnumber'];
    for (const f of requiredFields) {
      if (f === 'contactnumber') {
        const phoneError = validatePhoneNumber(formData.contactnumber);
        if (phoneError) errors.contactnumber = phoneError;
        continue;
      }
      if (!formData[f] || !String(formData[f]).trim()) {
        errors[f] = `${formatLabel(f)} is required`;
      }
    }
    if (Object.keys(errors).length > 0) {
      setFormFieldErrors(errors);
      return;
    }
    setFormFieldErrors({});

    setSaving(true);
    try {
      const id = getItemId(editingItem);
      if (editingItem && id) {
        await apiRequest(`/admin/collections/doctors/${id}`, {
          method: 'PUT',
          body: formData,
        });
      } else {
        await apiRequest('/admin/collections/doctors', {
          method: 'POST',
          body: formData,
        });
      }
      setShowModal(false);
      reloadTable();
    } catch (err) {
      alert('Save failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    try {
      const doctors = await apiRequest('/admin/collections/doctors');
      const rows = [
        ['Name', 'Degree', 'Clinic / Hospital', 'Contact Number'],
        ...doctors.map((doctor) => [
          doctor.name || '',
          doctor.doctorDegree || '',
          doctor.clinicName || '',
          doctor.contactnumber || '',
        ]),
      ];
      const csv = rows
        .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))
        .join('\n');
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'doctors.csv';
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Export failed: ' + err.message);
    }
  };

  if (!isLoggedIn) {
    return (
      <StaffLogin
        mark="U"
        subtitle="Userpanel"
        usernameLabel="Username or employee ID"
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
        <div className={styles.sidebarTop} onClick={() => { window.location.href = '/'; }} style={{ cursor: 'pointer' }}>
          <div className={styles.brandMark}>U</div>
          <div>
            <div className={styles.brandName}>MedPortal</div>
            <div className={styles.brandSub}>Userpanel</div>
          </div>
        </div>
        <nav className={styles.nav}>
          <p className={styles.navLabel}>Collections</p>
          <button type="button" className={`${styles.navItem} ${styles.navActive}`}>
            <span className={styles.navIcon}>D</span>
            Doctors
          </button>
        </nav>
      </aside>

      <div className={styles.main}>
        <header className={styles.topbar}>
          <h1 className={styles.pageTitle}>Doctors list</h1>
          <div className={styles.topbarRight}>
            <span className={styles.adminBadge}>
              {auth.role === 'superadmin'
                ? 'Superadmin'
                : auth.role === 'admin'
                  ? auth.username || 'Admin'
                  : auth.empid || 'User'}
            </span>
            <button type="button" className={styles.logoutBtn} onClick={handleLogout}>
              Log out
            </button>
          </div>
        </header>

        <section className={styles.panel}>
          <div className={styles.toolbar}>
            <div />
            <div className={styles.toolbarActions}>
              <button type="button" className={styles.secondaryBtn} onClick={handleExport}>
                Export
              </button>
              <button type="button" className={styles.primaryBtn} onClick={openCreate}>
                + Add doctor
              </button>
            </div>
          </div>
          <div className={styles.tableCard}>
            <div ref={hostRef} className={styles.dtHost} />
          </div>
        </section>
      </div>

      {showModal && (
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <h2 className={styles.modalTitle}>{editingItem ? 'Edit doctor' : 'Add doctor'}</h2>
            <form onSubmit={handleSave} className={styles.form}>
              {['name', 'doctorDegree', 'clinicName', 'contactnumber'].map((field) => (
                <label key={field} className={styles.field}>
                  <span>{formatLabel(field)}</span>
                  <input
                    type="text"
                    inputMode={field === 'contactnumber' ? 'numeric' : undefined}
                    maxLength={field === 'contactnumber' ? 10 : undefined}
                    value={formData[field] ?? ''}
                    onChange={(event) => {
                      const next = field === 'contactnumber'
                        ? sanitizePhoneInput(event.target.value)
                        : event.target.value;
                      setFormData((prev) => ({ ...prev, [field]: next }));
                      if (formFieldErrors[field]) setFormFieldErrors((prev) => ({ ...prev, [field]: null }));
                    }}
                  />
                  {formFieldErrors[field] && <span className={styles.fieldError}>{formFieldErrors[field]}</span>}
                </label>
              ))}
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
