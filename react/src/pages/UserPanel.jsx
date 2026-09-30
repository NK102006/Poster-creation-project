import { useEffect, useMemo, useRef, useState } from 'react';
import DataTable from 'datatables.net-dt';
import 'datatables.net-dt/css/dataTables.dataTables.css';
import { apiRequest } from '../lib/apiClient';
import { canAccessPage, clearAuth, readAuth, writeAuth } from '../lib/authSession';
import StaffLogin from './StaffLogin';
import StudioShell from '../components/StudioShell';
import Datepicker from '../components/DatePicker';
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
  const hostRef = useRef(null);
  const tableRef = useRef(null);
  const dateFromRef = useRef('');
  const dateToRef = useRef('');

  const inputProps = useMemo(
    () => ({
      className: 'md-mobile-picker-input',
      placeholder: 'Choose date',
    }),
    []
  );

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
          title: 'Created',
          data: 'createdAt',
          render: (data) => {
            if (!data) return '—';
            const d = new Date(data);
            return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
          },
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

  const handleExport = async () => {
    try {
      const doctors = await apiRequest('/admin/collections/doctors');
      const list = doctors || [];
      const rows = [
        ['Name', 'Degree', 'Clinic / Hospital', 'Contact Number', 'Posters Made', 'Downloads'],
      ];

      for (const doctor of list) {
        if (!doctorMatchesDateRange(doctor)) continue;
        const activity = Array.isArray(doctor.posterActivity)
          ? doctor.posterActivity
          : (doctor.posters || []).map((p) => ({
            createdAt: p.createdAt,
            downloads: Number(p.downloads) || 0,
          }));
        let postersMade = doctor.postersMade || 0;
        let downloadCount = doctor.downloadCount || 0;
        if (dateFrom || dateTo) {
          postersMade = 0;
          downloadCount = 0;
          for (const entry of activity) {
            if (!dateInRange(entry.createdAt, dateFrom, dateTo)) continue;
            postersMade += 1;
            downloadCount += Number(entry.downloads) || 0;
          }
        }
        rows.push([
          doctor.name || '',
          doctor.doctorDegree || '',
          doctor.clinicName || '',
          doctor.contactnumber || '',
          postersMade,
          downloadCount,
        ]);
      }

      if (rows.length === 1) {
        setExportError('No data available to export');
        setTimeout(() => setExportError(''), 3000);
        return;
      }
      const csv = rows
        .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))
        .join('\r\n');
      const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = dateFrom || dateTo
        ? `doctors_${dateFrom || 'start'}_${dateTo || 'end'}.csv`
        : 'doctors.csv';
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

  const dateFilters = (
    <div className={styles.dateFilter} style={{ alignItems: 'center', flexWrap: 'nowrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <div style={{ width: '230px' }}>
          <Datepicker
            controls={['calendar']}
            select="range"
            inputComponent="input"
            inputProps={inputProps}
            value={[dateFrom, dateTo]}
            onChange={(args) => {
              const [from, to] = Array.isArray(args?.value) ? args.value : ['', ''];
              setDateFrom(from || '');
              setDateTo(to || '');
            }}
          />
        </div>
        <button
          type="button"
          className={`${styles.clearDatesBtn} ${!(dateFrom || dateTo) ? styles.clearDatesBtnHidden : ''}`}
        onClick={() => {
          setDateFrom('');
          setDateTo('');
        }}
          disabled={!(dateFrom || dateTo)}
          aria-hidden={!(dateFrom || dateTo)}
        >
          Clear
        </button>
      </div>
    </div>
  );

  const listActions = (
    <>
      <button type="button" className={`${styles.secondaryBtn} ${styles.toolbarBtn}`} onClick={handleExport}>
        Export
      </button>
      <button type="button" className={`${styles.primaryBtn} ${styles.toolbarBtn}`} onClick={openCreate}>
        + Add doctor
      </button>
    </>
  );

  const listBody = (
    <>
      {exportError && <p className={styles.error} style={{ margin: '0 0 16px' }}>{exportError}</p>}
      <div className={styles.tableCard}>
        <div ref={hostRef} className={`${styles.dtHost} ${embedded ? styles.dtHostClickable : ''}`} />
      </div>

      {showModal && (
        <div className={`${styles.modalOverlay} ${closingModal ? styles.closing : ''}`} onClick={closeModal}>
          <div className={styles.modal} role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <h2 className={styles.modalTitle}>{editingItem ? 'Edit doctor' : 'Add doctor'}</h2>
            <form onSubmit={handleSave} className={styles.form}>
              {doctorFields.filter(f => f.enabled && f.key !== 'logo' && f.key !== 'photo' && f.type !== 'file').map((field) => {
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
    </>
  );

  if (embedded) {
    return (
      <StudioShell
        user={auth}
        onLogout={handleLogout}
        onBrandClick={onBrandClick}
        onBack={onBack}
        backLabel="Home"
        wide
        subheaderExtra={<h1 className={styles.pageTitle}>Doctors list</h1>}
      >
        <div className={styles.toolbar}>
          {dateFilters}
          <div className={styles.toolbarActions}>{listActions}</div>
        </div>
        {listBody}
      </StudioShell>
    );
  }

  return (
    <div className={`${styles.shell} ${styles.shellFull}`}>
      <div className={styles.main}>
        <header className={styles.topbar}>
          <div id="topbar-left" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <h1 className={styles.pageTitle}>Doctors list</h1>
          </div>
          <div className={styles.topbarRight}>
            <span className={styles.adminBadge}>
              {auth.role === 'superadmin'
                ? 'Superadmin'
                : auth.role === 'admin'
                  ? auth.username || 'Admin'
                  : auth.empid ? `Employee ${auth.empid}` : 'User'}
            </span>
            <button type="button" className={styles.logoutBtn} onClick={handleLogout}>
              Log out
            </button>
          </div>
        </header>
        <section className={styles.panel}>
          <div className={styles.toolbar}>
            {dateFilters}
            <div className={styles.toolbarActions}>{listActions}</div>
          </div>
          {listBody}
        </section>
      </div>
    </div>
  );
}
