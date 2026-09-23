import { useEffect, useRef, useState } from 'react';
import DataTable from 'datatables.net-dt';
import 'datatables.net-dt/css/dataTables.dataTables.css';
import { apiRequest } from '../lib/apiClient';
import styles from './AdminPortal.module.css';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api').replace(
  /\/$/,
  ''
);

function getItemId(item) {
  return item?.id || item?._id || '';
}

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
  const [isLoggedIn, setIsLoggedIn] = useState(
    () => localStorage.getItem('admin_session') === 'true'
  );
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const [activeTab, setActiveTab] = useState('doctors');
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);

  const hostRef = useRef(null);
  const tableRef = useRef(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await apiRequest('/admin/login', {
        method: 'POST',
        body: { username, password },
      });
      if (res.success) {
        setIsLoggedIn(true);
        localStorage.setItem('admin_session', 'true');
      }
    } catch (err) {
      setLoginError(err.message || 'Login failed');
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    localStorage.removeItem('admin_session');
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
        await apiRequest(`/admin/collections/${activeTab}/${id}`, { method: 'DELETE' });
        reloadTable();
      } catch (err) {
        alert('Delete failed: ' + err.message);
      }
    };

    window.__adminPortal = { openEdit, removeRow };
    return () => {
      delete window.__adminPortal;
    };
  }, [isLoggedIn, activeTab]);

  useEffect(() => {
    if (!isLoggedIn || !hostRef.current) return undefined;

    const host = hostRef.current;
    host.innerHTML = '';
    const tableEl = document.createElement('table');
    tableEl.className = `display ${styles.table}`;
    tableEl.style.width = '100%';
    host.appendChild(tableEl);

    const isDoctors = activeTab === 'doctors';

    const columns = isDoctors
      ? [
          {
            title: 'ID',
            data: 'id',
            className: styles.colId,
            render: (data) =>
              `<code class="${styles.idCell}" title="${data}">${data}</code>`,
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
            title: 'Actions',
            data: null,
            orderable: false,
            searchable: false,
            className: styles.colActions,
            render: (_data, _type, row) => {
              const id = getItemId(row);
              return `<div class="${styles.actions}">
                <button type="button" class="${styles.editBtn}" data-action="edit">Edit</button>
                <button type="button" class="${styles.deleteBtn}" data-action="delete" data-id="${id}">Delete</button>
              </div>`;
            },
          },
        ]
      : [
          {
            title: 'ID',
            data: 'id',
            className: styles.colId,
            render: (data) =>
              `<code class="${styles.idCell}" title="${data}">${data}</code>`,
          },
          {
            title: 'Employee ID',
            data: 'empid',
            className: styles.nameCell,
            render: (data, _type, row) => data ?? row.id ?? '—',
          },
          {
            title: 'Actions',
            data: null,
            orderable: false,
            searchable: false,
            className: styles.colActions,
            render: (_data, _type, row) => {
              const id = getItemId(row);
              return `<div class="${styles.actions}">
                <button type="button" class="${styles.editBtn}" data-action="edit">Edit</button>
                <button type="button" class="${styles.deleteBtn}" data-action="delete" data-id="${id}">Delete</button>
              </div>`;
            },
          },
        ];

    const table = new DataTable(tableEl, {
      serverSide: true,
      processing: true,
      pageLength: 10,
      lengthMenu: [5, 10, 25, 50],
      paging: true,
      pagingType: 'simple_numbers',
      autoWidth: false,
      scrollX: true,
      order: [[1, 'asc']],
      layout: {
        topStart: 'pageLength',
        topEnd: 'search',
        bottomStart: 'info',
        bottomEnd: 'paging',
      },
      ajax: {
        url: `${API_BASE_URL}/admin/datatables/${activeTab}`,
        dataSrc: 'data',
      },
      columns,
      language: {
        search: 'Search:',
        lengthMenu: 'Show _MENU_',
        info: '_START_–_END_ of _TOTAL_',
        infoEmpty: 'No records',
        zeroRecords: 'No matching records found',
        processing: 'Loading…',
        paginate: {
          previous: 'Prev',
          next: 'Next',
        },
      },
    });

    function onClick(e) {
      const btn = e.target.closest('button[data-action]');
      const tr = e.target.closest('tr');
      if (btn) {
        e.preventDefault();
        e.stopPropagation();
        const rowData = table.row(tr).data();
        const action = btn.getAttribute('data-action');
        if (action === 'edit') window.__adminPortal?.openEdit(rowData);
        if (action === 'delete') {
          window.__adminPortal?.removeRow(btn.getAttribute('data-id') || getItemId(rowData));
        }
        return;
      }

    }

    host.addEventListener('click', onClick);
    tableRef.current = table;

    return () => {
      host.removeEventListener('click', onClick);
      table.destroy();
      tableRef.current = null;
      host.innerHTML = '';
    };
  }, [isLoggedIn, activeTab]);

  const openCreate = () => {
    setEditingItem(null);
    if (activeTab === 'doctors') {
      setFormData({ name: '', clinicName: '', contactnumber: '', doctorDegree: '' });
    } else {
      setFormData({ empid: '', password: '' });
    }
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const id = getItemId(editingItem);
      if (editingItem && id) {
        await apiRequest(`/admin/collections/${activeTab}/${id}`, {
          method: 'PUT',
          body: formData,
        });
      } else {
        await apiRequest(`/admin/collections/${activeTab}`, {
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

  const handleFieldChange = (key, val) => {
    setFormData((prev) => ({ ...prev, [key]: val }));
  };

  const formFields =
    activeTab === 'doctors'
      ? ['name', 'doctorDegree', 'clinicName', 'contactnumber']
      : ['empid', 'password'];

  const handleExport = async () => {
    try {
      const doctors = await apiRequest('/admin/collections/doctors');
      const rows = [
        ['Name', 'Degree', 'Clinic / Hospital', 'Contact Number', 'Posters'],
        ...doctors.map((doctor) => [
          doctor.name || '',
          doctor.doctorDegree || '',
          doctor.clinicName || '',
          doctor.contactnumber || '',
          (doctor.posters || []).map(p => p.image).join('\n') || doctor.poster || '',
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
      <div className={styles.loginPage}>
        <form onSubmit={handleLogin} className={styles.loginCard}>
          <div className={styles.loginBrand}>
            <div className={styles.brandMark}>M</div>
            <div>
              <div className={styles.brandName}>MedPortal</div>
              <div className={styles.brandSub}>Admin access</div>
            </div>
          </div>
          <h1 className={styles.loginTitle}>Sign in</h1>
          {loginError && <p className={styles.error}>{loginError}</p>}
          <label className={styles.field}>
            <span>Username</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label className={styles.field}>
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <button type="submit" className={styles.primaryBtn}>
            Login
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarTop}>
          <div className={styles.brandMark}>M</div>
          <div>
            <div className={styles.brandName}>MedPortal</div>
            <div className={styles.brandSub}>Admin</div>
          </div>
        </div>

        <nav className={styles.nav}>
          <p className={styles.navLabel}>Collections</p>
          <button
            type="button"
            className={`${styles.navItem} ${activeTab === 'doctors' ? styles.navActive : ''}`}
            onClick={() => setActiveTab('doctors')}
          >
            <span className={styles.navIcon}>D</span>
            Doctors
          </button>
        </nav>
      </aside>

      <div className={styles.main}>
        <header className={styles.topbar}>
          <div>
            <h1 className={styles.pageTitle}>Doctors list</h1>
          </div>
          <div className={styles.topbarRight}>
            <span className={styles.adminBadge}>Administrator</span>
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
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className={styles.modalTitle}>
              {editingItem
                ? `Edit ${activeTab === 'doctors' ? 'doctor' : 'user'}`
                : `Add ${activeTab === 'doctors' ? 'doctor' : 'user'}`}
            </h2>
            <form onSubmit={handleSave} className={styles.form}>
              {formFields.map((f) => (
                <label key={f} className={styles.field}>
                  <span>{formatLabel(f)}</span>
                  <input
                    type={f === 'password' ? 'password' : 'text'}
                    value={formData[f] ?? ''}
                    onChange={(e) => handleFieldChange(f, e.target.value)}
                    required
                    autoComplete={f === 'password' ? 'new-password' : undefined}
                  />
                </label>
              ))}
              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => setShowModal(false)}
                >
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
