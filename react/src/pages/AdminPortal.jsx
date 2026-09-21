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
  if (key === 'contactnumber') return 'Contact Number';
  if (key === 'clinicName') return 'Clinic / Hospital';
  if (key === 'doctorDegree') return "Doctor's Degree";
  return key.charAt(0).toUpperCase() + key.slice(1);
}

const DOCTOR_FIELDS = ['name', 'clinicName', 'doctorDegree', 'contactnumber', 'logo', 'poster'];

export default function AdminPortal() {
  const [isLoggedIn, setIsLoggedIn] = useState(
    () => localStorage.getItem('admin_session') === 'true'
  );
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);
  const [previewItem, setPreviewItem] = useState(null);

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
        await apiRequest(`/admin/collections/doctors/${id}`, { method: 'DELETE' });
        reloadTable();
      } catch (err) {
        alert('Delete failed: ' + err.message);
      }
    };

    window.__adminPortal = { openEdit, removeRow, setPreviewItem };
    return () => {
      delete window.__adminPortal;
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

    const columns = [
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
        title: "Doctor's Degree",
        data: 'doctorDegree',
        render: (data) => data || '—',
      },
      {
        title: 'Contact Number',
        data: 'contactnumber',
        render: (data) => data || '—',
      },
      {
        title: 'Logo',
        data: 'logo',
        orderable: false,
        searchable: false,
        render: (data) =>
          data
            ? `<img src="${data}" alt="" class="${styles.logoThumb}" />`
            : `<span class="${styles.muted}">—</span>`,
      },
      {
        title: 'Poster',
        data: 'poster',
        orderable: false,
        searchable: false,
        render: (data) =>
          data
            ? `<img src="${data}" alt="" class="${styles.posterThumb}" />`
            : `<span class="${styles.muted}">null</span>`,
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
        url: `${API_BASE_URL}/admin/datatables/doctors`,
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
      rowCallback(row) {
        row.style.cursor = 'pointer';
        row.dataset.hasMedia = 'true';
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

      if (!tr || !host.contains(tr) || tr.parentElement?.tagName !== 'TBODY') return;
      const rowData = table.row(tr).data();
      if (rowData) window.__adminPortal?.setPreviewItem(rowData);
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
    setFormData({
      name: '',
      clinicName: '',
      doctorDegree: '',
      contactnumber: '',
      logo: '',
      poster: '',
    });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
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

  const handleFieldChange = (key, val) => {
    setFormData((prev) => ({ ...prev, [key]: val }));
  };

  const handleFileChange = (key, file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setFormData((prev) => ({ ...prev, [key]: ev.target.result }));
    };
    reader.readAsDataURL(file);
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
          <p className={styles.loginHint}>Manage doctors in MedPortal.</p>
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
          <button type="button" className={`${styles.navItem} ${styles.navActive}`}>
            <span className={styles.navIcon}>D</span>
            Doctors
          </button>
        </nav>

        <button type="button" className={styles.sidebarLogout} onClick={handleLogout}>
          Log out
        </button>
      </aside>

      <div className={styles.main}>
        <header className={styles.topbar}>
          <div>
            <p className={styles.breadcrumb}>Admin / Doctors</p>
            <h1 className={styles.pageTitle}>Doctors list</h1>
            <p className={styles.pageHint}>
              DataTables with server-side pagination. Click a doctor row to preview logo & poster.
            </p>
          </div>
          <div className={styles.topbarRight}>
            <span className={styles.adminBadge}>Administrator</span>
          </div>
        </header>

        <section className={styles.panel}>
          <div className={styles.toolbar}>
            <p className={styles.toolbarHint}>
              Page size + search are handled by DataTables against MongoDB.
            </p>
            <button type="button" className={styles.primaryBtn} onClick={openCreate}>
              + Add doctor
            </button>
          </div>

          <div className={styles.tableCard}>
            <div ref={hostRef} className={styles.dtHost} />
          </div>
        </section>
      </div>

      {previewItem && (
        <div className={styles.modalOverlay} onClick={() => setPreviewItem(null)}>
          <div
            className={styles.previewModal}
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.previewHeader}>
              <div>
                <p className={styles.previewEyebrow}>Doctor preview</p>
                <h2 className={styles.modalTitle}>{previewItem.name || 'Doctor'}</h2>
                <p className={styles.previewMeta}>
                  Contact: {previewItem.contactnumber || '—'} · ID:{' '}
                  <code>{getItemId(previewItem)}</code>
                </p>
              </div>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => setPreviewItem(null)}
              >
                Close
              </button>
            </div>
            <div className={styles.previewGrid}>
              <div className={styles.previewPane}>
                <h3>Logo</h3>
                {previewItem.logo ? (
                  <img src={previewItem.logo} alt="Logo" className={styles.previewLogo} />
                ) : (
                  <p className={styles.muted}>No logo</p>
                )}
              </div>
              <div className={styles.previewPane}>
                <h3>Poster</h3>
                {previewItem.poster ? (
                  <img src={previewItem.poster} alt="Poster" className={styles.previewPoster} />
                ) : (
                  <p className={styles.muted}>No poster</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className={styles.modalTitle}>
              {editingItem ? 'Edit doctor' : 'Add doctor'}
            </h2>
            <form onSubmit={handleSave} className={styles.form}>
              {DOCTOR_FIELDS.map((f) => (
                <label key={f} className={styles.field}>
                  <span>{formatLabel(f)}</span>
                  {f === 'logo' || f === 'poster' ? (
                    <div className={styles.fileBlock}>
                      {formData[f] ? (
                        <img
                          src={formData[f]}
                          alt=""
                          className={f === 'logo' ? styles.formLogo : styles.formPoster}
                        />
                      ) : (
                        <span className={styles.muted}>No image</span>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileChange(f, e.target.files?.[0])}
                      />
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={formData[f] ?? ''}
                      onChange={(e) => handleFieldChange(f, e.target.value)}
                      required={f !== 'logo' && f !== 'poster'}
                    />
                  )}
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
