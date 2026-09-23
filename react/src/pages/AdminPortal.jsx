import { useEffect, useRef, useState } from 'react';
import DataTable from 'datatables.net-dt';
import 'datatables.net-dt/css/dataTables.dataTables.css';
import JSZip from 'jszip';
import { apiRequest } from '../lib/apiClient';
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
  const [loginFieldErrors, setLoginFieldErrors] = useState({});
  const [formFieldErrors, setFormFieldErrors] = useState({});

  const hostRef = useRef(null);
  const tableRef = useRef(null);

  const handleLogin = async (e) => {
    e.preventDefault();
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
      setFormData({ name: '', clinicName: '', contactnumber: '', doctorDegree: '', logo: null });
    } else {
      setFormData({ empid: '', password: '' });
    }
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();

    const errors = {};
    for (const f of formFields) {
      if (!formData[f] || !String(formData[f]).trim()) {
        errors[f] = `${formatLabel(f)} is required`;
      }
    }
    if (activeTab === 'doctors' && !formData.logo) {
      errors.logo = 'Logo is required';
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
    if (formFieldErrors[key]) setFormFieldErrors((prev) => ({ ...prev, [key]: null }));
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
          (doctor.posters || []).map(p => p.image).join('\r\n') || doctor.poster || '',
        ]),
      ];
      const csv = rows
        .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))
        .join('\r\n');
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

  const handleExportAll = async () => {
    try {
      const [users, doctors] = await Promise.all([
        apiRequest('/admin/collections/users'),
        apiRequest('/admin/collections/doctors')
      ]);

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
      link.download = 'All_Users_And_Doctors.zip';
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Export All failed: ' + err.message);
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
              onChange={(e) => {
                setUsername(e.target.value);
                if (loginFieldErrors.username) setLoginFieldErrors((prev) => ({ ...prev, username: null }));
              }}
              autoComplete="username"
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
              autoComplete="current-password"
            />
            {loginFieldErrors.password && <span className={styles.fieldError}>{loginFieldErrors.password}</span>}
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
              <button type="button" className={styles.secondaryBtn} onClick={handleExportAll}>
                Export All
              </button>
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
                    autoComplete={f === 'password' ? 'new-password' : undefined}
                  />
                  {formFieldErrors[f] && <span className={styles.fieldError}>{formFieldErrors[f]}</span>}
                </label>
              ))}
              
              {activeTab === 'doctors' && (
                <div className={styles.bsMb3}>
                  <label htmlFor="logoUpload" className={styles.bsFormLabel}>
                    Logo *
                  </label>
                  <input
                    id="logoUpload"
                    className={styles.bsFormControl}
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (ev) => handleFieldChange('logo', ev.target.result);
                        reader.readAsDataURL(file);
                      } else {
                        handleFieldChange('logo', null);
                      }
                    }}
                  />
                  {formData.logo && typeof formData.logo === 'string' && (
                     <div style={{ marginTop: '8px' }}>
                       <img 
                          src={formData.logo} 
                          alt="Preview" 
                          style={{ maxHeight: '100px', objectFit: 'contain', borderRadius: '4px', border: '1px solid #ced4da' }} 
                       />
                     </div>
                  )}
                  {formFieldErrors['logo'] && <span className={styles.fieldError}>{formFieldErrors['logo']}</span>}
                </div>
              )}
              
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
