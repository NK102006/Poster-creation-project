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

function posterGalleryStyle(count) {
  if (count <= 1) return { gridTemplateColumns: 'minmax(320px, 480px)', justifyContent: 'center' };
  if (count <= 2) return { gridTemplateColumns: 'repeat(2, minmax(280px, 1fr))' };
  if (count <= 4) return { gridTemplateColumns: 'repeat(2, minmax(260px, 1fr))' };
  if (count <= 6) return { gridTemplateColumns: 'repeat(3, minmax(240px, 1fr))' };
  return { gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' };
}

function formatPosterSendDate(value) {
  if (!value) return 'Send date not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Send date not set';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const compare = new Date(date);
  compare.setHours(0, 0, 0, 0);
  const label = date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  return compare > today ? `Send ${label}` : `Sent ${label}`;
}

function dateInRange(value, fromStr, toStr) {
  if (!fromStr && !toStr) return true;
  if (!value) return false;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return false;
  if (fromStr) {
    const from = new Date(fromStr);
    from.setHours(0, 0, 0, 0);
    if (time < from.getTime()) return false;
  }
  if (toStr) {
    const to = new Date(toStr);
    to.setHours(23, 59, 59, 999);
    if (time > to.getTime()) return false;
  }
  return true;
}

export default function UserPanel({
  user = null,
  onLogout,
  onBack,
  onBrandClick,
  onSelectDoctor,
  onAddNew,
} = {}) {
  const embedded = Boolean(user);
  const [auth, setAuth] = useState(() => user || readAuth('userpanel'));
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginFieldErrors, setLoginFieldErrors] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [closingModal, setClosingModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({ dynamicFields: {} });
  const [formFieldErrors, setFormFieldErrors] = useState({});
  const [doctorFields, setDoctorFields] = useState([]);
  const [saving, setSaving] = useState(false);
  const [exportError, setExportError] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showPosters, setShowPosters] = useState(false);
  const [posterItems, setPosterItems] = useState([]);
  const [postersLoading, setPostersLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [posterError, setPosterError] = useState('');
  const hostRef = useRef(null);
  const tableRef = useRef(null);
  const dateFromRef = useRef('');
  const dateToRef = useRef('');

  useEffect(() => {
    if (user) setAuth(user);
  }, [user]);

  const isLoggedIn = embedded || canAccessPage(auth, 'userpanel');

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
        setAuth(writeAuth(result.auth, 'userpanel'));
      }
    } catch (err) {
      setLoginError(err.message || 'Login failed');
    }
  };

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
      return;
    }
    clearAuth('userpanel');
    setAuth(null);
    setUsername('');
    setPassword('');
    setLoginError('');
    setLoginFieldErrors({});
    apiRequest('/logout', { method: 'POST' }).catch(() => { });
  };

  const openDoctor = (item) => {
    if (!onSelectDoctor) return false;
    const id = getItemId(item);
    onSelectDoctor({ ...item, id });
    return true;
  };

  const reloadTable = () => {
    tableRef.current?.ajax?.reload(null, false);
  };

  useEffect(() => {
    if (!isLoggedIn) return undefined;

    const openEdit = (item) => {
      if (openDoctor(item)) return;
      setEditingItem(item);
      setFormData({ dynamicFields: {}, ...item });
      setShowModal(true);
      setClosingModal(false);
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

    window.__userPanel = { openEdit, removeRow, openDoctor };
    return () => {
      delete window.__userPanel;
    };
  }, [isLoggedIn, onSelectDoctor]);

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
        if (dateFromRef.current) params.set('from', dateFromRef.current);
        if (dateToRef.current) params.set('to', dateToRef.current);
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
          title: 'Logo',
          data: 'logo',
          orderable: false,
          searchable: false,
          className: styles.colId,
          render: (data, _type, row) => {
            const initial = (row.name || 'D').charAt(0).toUpperCase();
            if (data) {
              return `<img src="${data}" alt="" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:2px solid #e8f0fe;" />`;
            }
            return `<div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#4285f4,#34a853);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15px;">${initial}</div>`;
          },
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
          title: 'Created',
          data: 'createdAt',
          render: (data) => {
            if (!data) return '—';
            const d = new Date(data);
            return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
          },
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
      if (window.__userPanel?.openDoctor?.(rowData)) return;
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

  useEffect(() => {
    dateFromRef.current = dateFrom;
    dateToRef.current = dateTo;
    if (isLoggedIn) tableRef.current?.ajax?.reload(null, false);
  }, [dateFrom, dateTo, isLoggedIn]);

  useEffect(() => {
    if (!showPosters) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setShowPosters(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showPosters]);

  const openCreate = () => {
    if (onAddNew) {
      onAddNew();
      return;
    }
    setEditingItem(null);
    setFormData({ dynamicFields: {} });
    setFormFieldErrors({});
    setShowModal(true);
    setClosingModal(false);
  };

  const closeModal = () => {
    setClosingModal(true);
    setTimeout(() => {
      setShowModal(false);
      setClosingModal(false);
    }, 400);
  };

  const handleSave = async (event) => {
    event.preventDefault();

    const errors = {};
    const enabledFields = doctorFields.filter(f => f.enabled);

    for (const f of enabledFields) {
      const isDynamic = !f.isStandard;
      const val = isDynamic ? (formData.dynamicFields?.[f.key] || '') : (formData[f.key] || '');

      if (f.key === 'contactnumber') {
        const phoneError = validatePhoneNumber(val);
        if (phoneError) {
          errors[f.key] = phoneError;
        } else if (f.required && !String(val).trim()) {
          errors[f.key] = `${f.label} is required`;
        }
        continue;
      }

      if (f.required && !String(val).trim()) {
        errors[f.key] = `${f.label} is required`;
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
      closeModal();
      reloadTable();
    } catch (err) {
      alert('Save failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const doctorMatchesDateRange = (doctor) => {
    if (!dateFrom && !dateTo) return true;
    const dates = [
      doctor.createdAt,
      doctor.updatedAt,
      ...(Array.isArray(doctor.posters) ? doctor.posters.map((poster) => poster.createdAt) : []),
    ];
    return dates.some((value) => dateInRange(value, dateFrom, dateTo));
  };

  const openPosters = async () => {
    setShowPosters(true);
    setPostersLoading(true);
    setPosterError('');
    try {
      const doctors = await apiRequest('/admin/collections/doctors');
      const items = (doctors || []).flatMap((doctor) =>
        (doctor.posters || []).map((poster, index) => ({
          ...poster,
          doctorName: doctor.name || 'Doctor',
          sendDate: poster.createdAt || doctor.createdAt,
          key: `${doctor.id || doctor._id || 'doctor'}-${poster.id || index}`,
        }))
      );
      setPosterItems(items);
    } catch (err) {
      setPosterError(err.message || 'Could not load posters');
      setPosterItems([]);
    } finally {
      setPostersLoading(false);
    }
  };

  const visiblePosters = posterItems.filter((poster) => dateInRange(poster.sendDate, dateFrom, dateTo));

  const handleExport = async () => {
    try {
      const doctors = await apiRequest('/admin/collections/doctors');
      const filtered = (doctors || []).filter(doctorMatchesDateRange);
      if (filtered.length === 0) {
        setExportError('No data available to export');
        setTimeout(() => setExportError(''), 3000);
        return;
      }
      const rows = [
        ['Name', 'Degree', 'Clinic / Hospital', 'Contact Number'],
        ...filtered.map((doctor) => [
          doctor.name || '',
          doctor.doctorDegree || '',
          doctor.clinicName || '',
          doctor.contactnumber || '',
        ]),
      ];
      const csv = rows
        .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))
        .join('\r\n');
      const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' }));
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
    <div className={`${styles.shell} ${styles.shellFull}`}>
      <div 
        className={`${styles.sidebarOverlay} ${sidebarOpen ? styles.open : ''} ${styles.mobileOnly}`} 
        onClick={() => setSidebarOpen(false)}
      />
      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.open : ''} ${styles.mobileOnly}`}>
        <div className={styles.sidebarTop} onClick={onBrandClick || undefined} style={{ cursor: 'pointer' }}>
          <div className={styles.brandMark}>M</div>
          <div>
            <div className={styles.brandName}>MedPortal</div>
            <div className={styles.brandSub}>User</div>
          </div>
        </div>
        
        <nav className={styles.nav}>
          <p className={styles.navLabel}>Actions</p>
          <button type="button" className={styles.navItem} onClick={() => { openPosters(); setSidebarOpen(false); }}>
            <span className={styles.navIcon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '18px', height: '18px' }}>
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <polyline points="21 15 16 10 5 21"></polyline>
              </svg>
            </span>
            Show posters
          </button>
          <button type="button" className={styles.navItem} onClick={() => { handleExport(); setSidebarOpen(false); }}>
            <span className={styles.navIcon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '18px', height: '18px' }}>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
            </span>
            Export
          </button>
          <button type="button" className={`${styles.navItem} ${styles.navActive}`} onClick={() => { openCreate(); setSidebarOpen(false); }}>
            <span className={styles.navIcon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '18px', height: '18px' }}>
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </span>
            Add doctor
          </button>
        </nav>

        <button type="button" className={styles.sidebarLogout} onClick={handleLogout}>
          Log out
        </button>
      </aside>

      <div className={styles.main}>
        <header className={styles.topbar} style={{ paddingBottom: '8px' }}>
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
            {onBack ? (
              <button type="button" className={`${styles.secondaryBtn} ${styles.desktopOnly}`} onClick={onBack}>
                ← Home
              </button>
            ) : onBrandClick ? (
              <button type="button" className={`${styles.secondaryBtn} ${styles.desktopOnly}`} onClick={onBrandClick}>
                ← Home
              </button>
            ) : null}
          </div>
          <div className={styles.topbarRight}>
            <span className={styles.adminBadge} style={{ gap: '6px' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '16px', height: '16px' }}>
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              {auth.role === 'superadmin'
                ? 'Superadmin'
                : auth.role === 'admin'
                  ? auth.username || 'Admin'
                  : auth.empid ? `Employee ${auth.empid}` : 'User'}
            </span>
            <button type="button" className={`${styles.logoutBtn} ${styles.desktopOnly}`} onClick={handleLogout}>
              Log out
            </button>
          </div>
        </header>

        <section className={styles.panel} style={{ paddingTop: '8px' }}>
          <h1 className={styles.pageTitle} style={{ margin: '0 0 16px' }}>Doctors list</h1>
          <div className={styles.toolbar}>
            <div className={styles.dateFilter}>
              <label>
                From
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(event) => setDateFrom(event.target.value)}
                />
              </label>
              <label>
                To
                <input
                  type="date"
                  value={dateTo}
                  onChange={(event) => setDateTo(event.target.value)}
                />
              </label>
              {dateFrom || dateTo ? (
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => {
                    setDateFrom('');
                    setDateTo('');
                  }}
                >
                  Clear dates
                </button>
              ) : null}
            </div>
            <div className={`${styles.toolbarActions} ${styles.desktopOnly}`}>
              <button type="button" className={styles.primaryBtn} onClick={openPosters}>
                Show posters
              </button>
              <button type="button" className={styles.secondaryBtn} onClick={handleExport}>
                Export
              </button>
              <button type="button" className={styles.primaryBtn} onClick={openCreate}>
                + Add doctor
              </button>
            </div>
          </div>
          {exportError && <p className={styles.error} style={{ margin: '0 0 16px' }}>{exportError}</p>}
          <div className={styles.tableCard}>
            <div ref={hostRef} className={`${styles.dtHost} ${embedded ? styles.dtHostClickable : ''}`} />
          </div>
        </section>
      </div>

      {showPosters && (
        <div className={styles.posterOverlay} role="dialog" aria-modal="true" aria-label="Doctor posters">
          <div className={styles.posterOverlayHeader}>
            <div>
              <p className={styles.previewEyebrow}>Posters</p>
              <h2>All posters</h2>
              <p className={styles.previewMeta}>
                {postersLoading
                  ? 'Loading…'
                  : `${visiblePosters.length} ${visiblePosters.length === 1 ? 'poster' : 'posters'}`}
              </p>
            </div>
            <button type="button" className={styles.secondaryBtn} onClick={() => setShowPosters(false)}>
              Close
            </button>
          </div>
          <div className={styles.posterOverlayBody}>
            {posterError ? (
              <p className={styles.posterEmpty}>{posterError}</p>
            ) : postersLoading ? (
              <p className={styles.posterEmpty}>Loading posters…</p>
            ) : visiblePosters.length === 0 ? (
              <p className={styles.posterEmpty}>
                {posterItems.length && (dateFrom || dateTo)
                  ? 'No posters in this date range.'
                  : 'No posters yet.'}
              </p>
            ) : (
              <div className={styles.posterGallery} style={posterGalleryStyle(visiblePosters.length)}>
                {visiblePosters.map((poster, index) => {
                  const kind = inferPosterKind(poster);
                  return (
                    <div key={poster.key || poster.id || index} className={styles.posterOverlayItem}>
                      {kind === 'video' ? (
                        <video src={poster.image} controls playsInline preload="metadata" />
                      ) : (
                        <img src={poster.image} alt={poster.label || `Poster ${index + 1}`} />
                      )}
                      <em>{poster.label || `Poster ${index + 1}`}</em>
                      <small>{kind}</small>
                      <span className={styles.posterSendDate}>{formatPosterSendDate(poster.sendDate)}</span>
                      {poster.doctorName ? (
                        <span className={styles.posterDoctorName}>{poster.doctorName}</span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {showModal && (
        <div className={`${styles.modalOverlay} ${closingModal ? styles.closing : ''}`} onClick={closeModal}>
          <div className={styles.modal} role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <h2 className={styles.modalTitle}>{editingItem ? 'Edit doctor' : 'Add doctor'}</h2>
            <form onSubmit={handleSave} className={styles.form}>
              {doctorFields.filter(f => f.enabled && f.key !== 'logo').map((field) => {
                const isDynamic = !field.isStandard;
                const value = isDynamic ? (formData.dynamicFields?.[field.key] ?? '') : (formData[field.key] ?? '');

                return (
                  <label key={field.key} className={styles.field}>
                    <span>{field.label} {field.required ? '*' : ''}</span>
                    <input
                      type={field.type || 'text'}
                      inputMode={field.key === 'contactnumber' ? 'numeric' : undefined}
                      minLength={field.key === 'contactnumber' ? 10 : undefined}
                      maxLength={field.key === 'contactnumber' ? 10 : undefined}
                      pattern={field.key === 'contactnumber' ? '[0-9]{10}' : undefined}
                      value={value}
                      onChange={(event) => {
                        const next = field.key === 'contactnumber'
                          ? sanitizePhoneInput(event.target.value)
                          : event.target.value;

                        setFormData((prev) => {
                          if (isDynamic) {
                            return { ...prev, dynamicFields: { ...prev.dynamicFields, [field.key]: next } };
                          }
                          return { ...prev, [field.key]: next };
                        });
                        if (formFieldErrors[field.key]) setFormFieldErrors((prev) => ({ ...prev, [field.key]: null }));
                      }}
                      onBlur={(event) => {
                        if (field.key === 'contactnumber') {
                          const err = validatePhoneNumber(event.target.value);
                          if (err) setFormFieldErrors((prev) => ({ ...prev, contactnumber: err }));
                        }
                      }}
                    />
                    {formFieldErrors[field.key] && <span className={styles.fieldError}>{formFieldErrors[field.key]}</span>}
                  </label>
                );
              })}
              <div className={styles.modalActions}>
                <button type="button" className={styles.secondaryBtn} onClick={closeModal}>
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
