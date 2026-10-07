import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import DataTable from 'datatables.net-dt';
import 'datatables.net-dt/css/dataTables.dataTables.css';
import JSZip from 'jszip';
import { apiRequest } from '../lib/apiClient';
import { sanitizePasswordInput, sanitizeUsernameInput, validateNewPassword } from '../features/auth/validators';
import Datepicker from '../components/DatePicker';
import { isFullWidthDoctorField, sortDoctorFields } from '../lib/doctorFields';
import styles from './AdminPortal.module.css';
import { confirmDialog } from '../lib/alerts';

const csvCell = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
const POSTER_FOLDERS = ['education', 'festival', 'video'];

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
  if (count <= 1) return { gridTemplateColumns: 'minmax(320px, 480px)', justifyContent: 'center' };
  if (count <= 2) return { gridTemplateColumns: 'repeat(2, minmax(280px, 1fr))' };
  if (count <= 4) return { gridTemplateColumns: 'repeat(2, minmax(260px, 1fr))' };
  if (count <= 6) return { gridTemplateColumns: 'repeat(3, minmax(240px, 1fr))' };
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

const createdAtColumn = {
  title: 'Created',
  data: 'createdAt',
  render: (data) => (data ? new Date(data).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '-'),
};

const dataTableOptions = {
  pageLength: 10,
  lengthMenu: [5, 10, 25, 50],
  paging: true,
  pagingType: 'simple_numbers',
  autoWidth: false,

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

function userColumns({ showAdmin }) {
  return [
    {
      title: 'Employee ID',
      data: 'empid',
      className: styles.nameCell,
      render: (data) => escapeHtml(data || '—'),
    },
    ...(showAdmin
      ? [{
        title: 'Admin',
        data: 'adminUsername',
        render: (data) => escapeHtml(data || '—'),
      }]
      : []),
    {
      title: 'Total doctors',
      data: 'doctorCount',
      render: (data) => String(data ?? 0),
    },
    createdAtColumn,
    {
      title: 'Edit',
      data: null,
      orderable: false,
      searchable: false,
      className: styles.colActions,
      render: () => `<button type="button" class="${styles.editBtn}" data-action="edit-user">Edit</button>`,
    },
    {
      title: 'Delete',
      data: null,
      orderable: false,
      searchable: false,
      className: styles.colActions,
      render: () => `<button type="button" class="${styles.deleteBtn}" data-action="delete-user">Delete</button>`,
    },
  ];
}

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
    render: (data) => escapeHtml(data || '-'),
  },
  {
    title: 'Clinic / Hospital',
    data: 'clinicName',
    render: (data) => escapeHtml(data || '—'),
  },
  createdAtColumn,
  {
    title: 'Whatsapp number',
    data: 'contactnumber',
    render: (data) => escapeHtml(data || '—'),
  },
  {
    title: 'Status',
    data: 'active',
    className: styles.colActions,
    render: (data) => `
      <label class="${styles.switch}">
        <input type="checkbox" data-action="toggle-active" ${data !== false ? 'checked' : ''} />
        <span class="${styles.slider}"></span>
      </label>
    `,
  },
  {
    title: 'Posters made',
    data: 'postersMade',
    className: styles.statsCell,
    width: '110px',
    render: (data) => String(data ?? 0),
  },
];

function useDataTable({ enabled, data, columns, onRowAction, emptyText }) {
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
      language: { ...dataTableOptions.language, ...(emptyText ? { emptyTable: emptyText } : {}) },
      data,
      columns,
    });

    function onClick(event) {
      const button = event.target.closest('button[data-action]');
      const checkbox = event.target.closest('input[data-action]');
      const actionEl = button || checkbox;
      
      const row = event.target.closest('tbody tr');
      if (!row) return;
      const rowData = table.row(row).data();
      if (!rowData) return;
      
      if (actionEl) {
        event.stopPropagation();
        const action = actionEl.getAttribute('data-action');
        if (action === 'delete' || action === 'delete-user' || action === 'edit-user') {
          event.preventDefault();
        }
        actionRef.current?.(action, rowData);
        return;
      }
      
      event.preventDefault();
      event.stopPropagation();
      actionRef.current?.('open-row', rowData);
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

export default function UsersDoctorsBoard({
  adminId = null,
  adminName = '',
  showAdminColumn = false,
  onBack = null,
  backLabel = '← Admins',
  onContextChange = null,
}) {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPosters, setShowPosters] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState({ empid: '', password: '', ownerAdmin: '' });
  const [userFormErrors, setUserFormErrors] = useState({});
  const [admins, setAdmins] = useState([]);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState('');
  const [doctorFields, setDoctorFields] = useState([]);
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  useEffect(() => {
    setFilterFrom('');
    setFilterTo('');
  }, [selectedUser, selectedDoctor]);

  const inputProps = useMemo(
    () => ({
      className: 'md-mobile-picker-input',
      placeholder: 'Choose date',
    }),
    []
  );

  const userImportRef = useRef(null);
  const navigateBackRef = useRef(() => { });
  const needsAdminPick = showAdminColumn && !adminId;

  const usersPath = adminId ? `/superadmin/admins/${adminId}/users` : '/admin/users';

  const loadUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await apiRequest(usersPath);
      const list = [...(result.users || [])].sort(
        (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      );
      setUsers(list);
    } catch (err) {
      setError(err.message || 'Could not load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [usersPath]);

  const headerBackLabel = selectedDoctor
    ? '← Doctors'
    : selectedUser
      ? '← Employees'
      : onBack
        ? backLabel
        : '';

  navigateBackRef.current = () => {
    setShowPosters(false);
    if (selectedDoctor) {
      setSelectedDoctor(null);
      return;
    }
    if (selectedUser) {
      setSelectedUser(null);
      setDoctors([]);
      return;
    }
    onBack?.();
  };

  useEffect(() => {
    onContextChange?.({
      user: selectedUser,
      doctor: selectedDoctor,
      backLabel: headerBackLabel,
      onNavigateBack: () => navigateBackRef.current(),
    });
  }, [selectedUser, selectedDoctor, headerBackLabel, onContextChange]);

  useEffect(() => {
    apiRequest('/doctor-fields').then(res => {
      if (res?.fields) setDoctorFields(res.fields);
    }).catch(() => { });
  }, []);

  useEffect(() => {
    if (!needsAdminPick) return undefined;
    let active = true;
    apiRequest('/superadmin/admins')
      .then((result) => {
        if (active) setAdmins(result.admins || []);
      })
      .catch(() => {
        if (active) setAdmins([]);
      });
    return () => {
      active = false;
    };
  }, [needsAdminPick]);

  useEffect(() => {
    if (!showPosters) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setShowPosters(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showPosters]);

  const doctorsPath = (user, doctor) => {
    if (adminId) {
      return doctor
        ? `/superadmin/admins/${adminId}/users/${user.id}/doctors/${doctor.id}`
        : `/superadmin/admins/${adminId}/users/${user.id}/doctors`;
    }
    return doctor
      ? `/admin/users/${user.id}/doctors/${doctor.id}`
      : `/admin/users/${user.id}/doctors`;
  };

  const selectUser = async (user) => {
    setSelectedUser(user);
    setSelectedDoctor(null);
    setShowPosters(false);
    setLoading(true);
    setError('');
    try {
      const result = await apiRequest(doctorsPath(user));
      const list = [...(result.doctors || [])].sort(
        (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      );
      setDoctors(list);
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
      const result = await apiRequest(doctorsPath(selectedUser, doctor));
      setSelectedDoctor(result.doctor);
      setShowPosters(false);
    } catch (err) {
      setError(err.message || 'Could not load doctor details');
    } finally {
      setLoading(false);
    }
  };

  const openCreateUser = () => {
    setEditingUser(null);
    setModalError('');
    setUserForm({ empid: '', password: '', ownerAdmin: '' });
    setUserFormErrors({});
    setShowUserModal(true);
  };

  const openEditUser = (user) => {
    setEditingUser(user);
    setModalError('');
    setUserForm({ empid: user.empid || '', password: '', ownerAdmin: user.ownerAdmin || '' });
    setUserFormErrors({});
    setShowUserModal(true);
  };

  const closeUserModal = () => {
    setShowUserModal(false);
    setModalError('');
    setSaving(false);
  };

  const saveUser = async (event) => {
    event.preventDefault();

    const errs = {};
    if (needsAdminPick && !editingUser && !userForm.ownerAdmin) errs.ownerAdmin = 'Select an admin';
    if (!userForm.empid.trim()) errs.empid = 'Employee ID is required';
    const passwordError = validateNewPassword(userForm.password, { required: !editingUser });
    if (passwordError) errs.password = passwordError;

    if (Object.keys(errs).length > 0) {
      setUserFormErrors(errs);
      return;
    }
    setUserFormErrors({});

    setSaving(true);
    setModalError('');
    try {
      if (!editingUser && needsAdminPick && !userForm.ownerAdmin) {
        setModalError('Select an admin for this employee');
        setSaving(false);
        return;
      }
      if (editingUser) {
        const path = adminId
          ? `/superadmin/admins/${adminId}/users/${editingUser.id}`
          : `/admin/users/${editingUser.id}`;
        await apiRequest(path, { method: 'PUT', body: userForm });
      } else {
        await apiRequest(usersPath, { method: 'POST', body: userForm });
      }
      closeUserModal();
      await loadUsers();
    } catch (err) {
      setModalError(err.message || 'Could not save user');
      setSaving(false);
    }
  };

  const formatImportSummary = (result) => {
    const parts = [
      `Created ${result.created || 0}`,
      `updated ${result.updated || 0}`,
    ];
    if (result.errors?.length) {
      const details = result.errors
        .slice(0, 5)
        .map((item) => `row ${item.row}: ${item.message}`)
        .join('; ');
      parts.push(`${result.errors.length} error(s): ${details}`);
    }
    return parts.join(', ');
  };

  const importUsers = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setImporting(true);
    setError('');
    setImportSummary('');
    try {
      const data = new FormData();
      data.append('file', file);
      const path = adminId
        ? `/superadmin/admins/${adminId}/users/import`
        : '/admin/users/import';
      const result = await apiRequest(path, {
        method: 'POST',
        body: data,
      });
      setImportSummary(formatImportSummary(result));
      await loadUsers();
    } catch (err) {
      setError(err.message || 'Could not import employees');
    } finally {
      setImporting(false);
    }
  };

  const deleteUser = async (user) => {
    if (!(await confirmDialog({
      title: 'Delete employee?',
      text: `Delete employee ${user.empid || user.id} and their doctors?`,
      confirmText: 'Delete',
      danger: true,
    }))) return;
    setError('');
    try {
      const path = adminId
        ? `/superadmin/admins/${adminId}/users/${user.id}`
        : `/admin/users/${user.id}`;
      await apiRequest(path, { method: 'DELETE' });
      if (selectedUser?.id === user.id) {
        setSelectedUser(null);
        setSelectedDoctor(null);
      }
      await loadUsers();
    } catch (err) {
      setError(err.message || 'Could not delete user');
    }
  };

  const columns = userColumns({ showAdmin: showAdminColumn && !adminId });

  const usersHostRef = useDataTable({
    enabled: !selectedUser,
    data: users,
    columns,
    emptyText: 'No employees found.',
    onRowAction: (action, user) => {
      if (!user) return;
      if (action === 'edit-user') openEditUser(user);
      else if (action === 'delete-user') deleteUser(user);
      else selectUser(user);
    },
  });

  const displayedDoctors = useMemo(() => {
    if (!filterFrom && !filterTo) return doctors;
    return doctors.filter((doc) => dateInRange(doc.createdAt, filterFrom, filterTo));
  }, [doctors, filterFrom, filterTo]);

  const statsDateFilter = (
    <div className={styles.statsDateFilter} style={{ alignItems: 'center', marginBottom: 0 }}>
      <span className={styles.statsDateLabel}>
        {selectedDoctor ? 'Filter posters by date:' : 'Filter doctors by date:'}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <div style={{ width: '230px' }}>
          <Datepicker
            controls={['calendar']}
            select="range"
            inputComponent="input"
            inputProps={inputProps}
            value={[filterFrom, filterTo]}
            onChange={(args) => {
              const [from, to] = Array.isArray(args?.value) ? args.value : ['', ''];
              setFilterFrom(from || '');
              setFilterTo(to || '');
            }}
          />
        </div>
        <button
          type="button"
          className={`${styles.statsDateClear} ${!(filterFrom || filterTo) ? styles.clearDatesBtnHidden : ''}`}
          onClick={() => {
            setFilterFrom('');
            setFilterTo('');
          }}
          disabled={!(filterFrom || filterTo)}
          aria-hidden={!(filterFrom || filterTo)}
        >
          Clear
        </button>
      </div>
    </div>
  );

  const doctorsHostRef = useDataTable({
    enabled: Boolean(selectedUser) && !selectedDoctor,
    data: displayedDoctors,
    columns: doctorColumns,
    emptyText: 'This employee has not created any doctors yet.',
    onRowAction: async (action, doctor) => {
      if (!doctor || action === 'edit-user' || action === 'delete-user') return;
      if (action === 'toggle-active') {
        try {
          await apiRequest(`/api/doctors/${doctor.id}/status`, {
            method: 'PATCH',
            body: { active: doctor.active === false ? true : false },
          });
          selectUser(selectedUser);
        } catch (err) {
          setError('Failed to update status: ' + err.message);
          setTimeout(() => setError(''), 5000);
        }
        return;
      }
      selectDoctor(doctor);
    },
  });

  const exportUsers = () => {
    if (users.length === 0) {
      setError('No data available to export');
      setTimeout(() => setError(''), 3000);
      return;
    }
    const rows = [
      ['ID', 'Employee ID', 'Admin', 'Total doctors'],
      ...users.map((user) => [user.id, user.empid, user.adminUsername || adminName || '', user.doctorCount ?? 0]),
    ];
    downloadFile(
      new Blob(['\ufeff' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n')], {
        type: 'text/csv;charset=utf-8;',
      }),
      'users.csv'
    );
  };

  const exportDoctors = async () => {
    if (!selectedUser) return;
    if (doctors.length === 0) {
      setError('No data available to export');
      setTimeout(() => setError(''), 3000);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const details = await Promise.all(
        doctors.map(async (doctor) => {
          const result = await apiRequest(doctorsPath(selectedUser, doctor));
          return result.doctor;
        })
      );
      const zip = new JSZip();
      POSTER_FOLDERS.forEach((folder) => zip.folder(folder));
      zip.folder('logos');

      const dateSuffix = (filterFrom || filterTo)
        ? `_${filterFrom || 'start'}_${filterTo || 'end'}`
        : '';
      const rows = [[
        'ID', 'Name', 'Degree', 'Clinic / Hospital', 'Contact Number', 'Active',
        'Posters Made', 'Logo File', 'Education Files', 'Festival Files', 'Video Files',
        ...(filterFrom || filterTo ? ['Date From', 'Date To'] : []),
      ]];

      let exportedAny = false;
      for (const doctor of details) {
        if ((filterFrom || filterTo) && !dateInRange(doctor.createdAt, filterFrom, filterTo)) {
          continue;
        }
        exportedAny = true;

        const posters = doctor.posters || [];
        const safeName = `${doctor.id}-${safeFilePart(doctor.name, 'doctor')}`;
        const filesByKind = { education: [], festival: [], video: [] };
        const counts = { education: 0, festival: 0, video: 0 };

        for (const poster of posters) {
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
          doctor.id, doctor.name, doctor.doctorDegree, doctor.clinicName, doctor.contactnumber,
          doctor.active ? 'Active' : 'Inactive', doctor.postersMade || 0,
          logoFile, filesByKind.education.join('\n'), filesByKind.festival.join('\n'), filesByKind.video.join('\n'),
          ...(filterFrom || filterTo ? [filterFrom || '', filterTo || ''] : []),
        ]);
      }

      if (!exportedAny) {
        setError('No data available to export for the selected dates');
        setTimeout(() => setError(''), 3000);
        return;
      }

      zip.file('doctors.csv', '\ufeff' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n'));
      downloadFile(
        await zip.generateAsync({ type: 'blob' }),
        `${selectedUser.empid || 'user'}-doctors${dateSuffix}.zip`
      );
    } catch (err) {
      setError(err.message || 'Could not export doctors');
    } finally {
      setLoading(false);
    }
  };

  const page = selectedDoctor
    ? 'Doctor details'
    : selectedUser
      ? `${selectedUser.empid || 'Employee'}’s doctors`
      : adminName
        ? `${adminName}’s employees`
        : 'Employees';

  const doctorPosters = useMemo(() => {
    const posters = selectedDoctor?.posters || [];
    if (!filterFrom && !filterTo) return posters;
    return posters.filter((poster) => dateInRange(poster.createdAt, filterFrom, filterTo));
  }, [selectedDoctor, filterFrom, filterTo]);

  const leftContent = (
    <>
      <h1 className={styles.pageTitle} style={{ margin: 0 }}>{page}</h1>
    </>
  );

  const rightContent = (
    <>
      {!selectedUser && (
        <>
          {adminId && (
            <>
              <input
                ref={userImportRef}
                type="file"
                accept=".csv,text/csv"
                hidden
                onChange={importUsers}
              />
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => userImportRef.current?.click()}
                disabled={importing}
              >
                {importing ? 'Importing…' : 'Import employee'}
              </button>
            </>
          )}
          <button type="button" className={styles.secondaryBtn} onClick={exportUsers}>
            Export employees
          </button>
          <button type="button" className={styles.primaryBtn} onClick={openCreateUser}>
            + Add employee
          </button>
        </>
      )}
      {selectedUser && (
        <>
          {selectedDoctor && (
            <button type="button" className={styles.primaryBtn} onClick={() => setShowPosters(true)}>
              Show posters
            </button>
          )}
          <button type="button" className={styles.secondaryBtn} onClick={exportDoctors}>
            Export doctors
          </button>
        </>
      )}
    </>
  );

  const mobileActionsContent = (
    <>
      {!selectedUser && (
        <>
          {adminId && (
            <button
              type="button"
              className={styles.navItem}
              onClick={() => userImportRef.current?.click()}
              disabled={importing}
            >
              <span className={styles.navIcon}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '18px', height: '18px' }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
              </span>
              {importing ? 'Importing…' : 'Import employee'}
            </button>
          )}
          <button type="button" className={styles.navItem} onClick={exportUsers}>
            <span className={styles.navIcon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '18px', height: '18px' }}>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
            </span>
            Export employees
          </button>
          <button type="button" className={styles.navItem} onClick={openCreateUser}>
            <span className={styles.navIcon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '18px', height: '18px' }}>
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </span>
            Add employee
          </button>
        </>
      )}
      {selectedUser && (
        <>
          {selectedDoctor && (
            <button type="button" className={styles.navItem} onClick={() => setShowPosters(true)}>
              <span className={styles.navIcon}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '18px', height: '18px' }}>
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <circle cx="8.5" cy="8.5" r="1.5"></circle>
                  <polyline points="21 15 16 10 5 21"></polyline>
                </svg>
              </span>
              Show posters
            </button>
          )}
          <button type="button" className={styles.navItem} onClick={exportDoctors}>
            <span className={styles.navIcon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '18px', height: '18px' }}>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
            </span>
            Export doctors
          </button>
        </>
      )}
    </>
  );

  const mobileActionsPortal = document.getElementById('topbar-actions-mobile');

  return (
    <>
      <div className={styles.toolbar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>{leftContent}</div>
        <div className={`${styles.toolbarActions} ${styles.desktopOnly}`}>{rightContent}</div>
      </div>
      {mobileActionsPortal && createPortal(mobileActionsContent, mobileActionsPortal)}
      {error && <p className={styles.error} style={{ marginBottom: '16px' }}>{error}</p>}
      {importSummary && !selectedDoctor && (
        <p className={styles.statusText}>{importSummary}</p>
      )}
      {loading && <p className={styles.statusText}>Loading…</p>}

      {!selectedUser && (
        <div className={styles.tableCard}>
          <div ref={usersHostRef} className={styles.dtHost} />
        </div>
      )}

      {selectedUser && !selectedDoctor && (
        <>
          <div className={styles.statsDateBar} style={{ padding: 0, minHeight: 'auto', marginBottom: '8px', justifyContent: 'flex-start' }}>
            {statsDateFilter}
          </div>
          <div className={styles.tableCard}>
            <div ref={doctorsHostRef} className={styles.dtHost} />
          </div>
        </>
      )}

      {selectedDoctor && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className={styles.statsDateBar} style={{ padding: 0, minHeight: 'auto', justifyContent: 'flex-start' }}>
            {statsDateFilter}
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
              ['Doctor ID', selectedDoctor.id, true],
              ...sortDoctorFields(doctorFields)
                .filter((f) => f.enabled && f.key !== 'logo' && f.type !== 'file')
                .map((f) => [
                  f.label,
                  f.isStandard ? selectedDoctor[f.key] : selectedDoctor.dynamicFields?.[f.key],
                  isFullWidthDoctorField(f),
                ]),
              ['Status', selectedDoctor.active ? 'Active' : 'Inactive', false],
              ['Posters made', doctorPosters.length, false],
              ['Created', selectedDoctor.createdAt ? new Date(selectedDoctor.createdAt).toLocaleString() : '—', false],
              ['Last updated', selectedDoctor.updatedAt ? new Date(selectedDoctor.updatedAt).toLocaleString() : '—', false],
            ].map(([label, value, fullWidth]) => (
              <div
                key={label}
                className={`${styles.detailField} ${fullWidth ? styles.detailFieldFull : ''}`}
              >
                <span>{label}</span>
                <strong>{value || '—'}</strong>
              </div>
            ))}
            </div>
          </div>
        </div>
      )}

      {showUserModal && (
        <div className={styles.modalOverlay} onClick={closeUserModal}>
          <div className={styles.modal} role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <h2 className={styles.modalTitle}>{editingUser ? 'Edit employee' : 'Add employee'}</h2>
            <form onSubmit={saveUser} className={styles.form} noValidate>
              {modalError && <p className={styles.error}>{modalError}</p>}
              {needsAdminPick && !editingUser && (
                <label className={styles.field}>
                  <span>Admin</span>
                  <select
                    value={userForm.ownerAdmin}
                    onChange={(event) => {
                      setUserForm((prev) => ({ ...prev, ownerAdmin: event.target.value }));
                      if (userFormErrors.ownerAdmin) setUserFormErrors((prev) => ({ ...prev, ownerAdmin: null }));
                    }}
                  >
                    <option value="">Select admin</option>
                    {admins.map((admin) => (
                      <option key={admin.id} value={admin.id}>
                        {admin.username}
                      </option>
                    ))}
                  </select>
                  {userFormErrors.ownerAdmin && <span className={styles.fieldError}>{userFormErrors.ownerAdmin}</span>}
                </label>
              )}
              <label className={styles.field}>
                <span>Employee ID</span>
                <input
                  value={userForm.empid}
                  onChange={(event) => {
                    setUserForm((prev) => ({ ...prev, empid: sanitizeUsernameInput(event.target.value) }));
                    if (userFormErrors.empid) setUserFormErrors((prev) => ({ ...prev, empid: null }));
                  }}
                />
                {userFormErrors.empid && <span className={styles.fieldError}>{userFormErrors.empid}</span>}
              </label>
              <label className={styles.field}>
                <span>{editingUser ? 'Password (leave blank to keep)' : 'Password'}</span>
                <input
                  type="password"
                  value={userForm.password}
                  onChange={(event) => {
                    setUserForm((prev) => ({ ...prev, password: sanitizePasswordInput(event.target.value) }));
                    if (userFormErrors.password) setUserFormErrors((prev) => ({ ...prev, password: null }));
                  }}
                  autoComplete="new-password"
                />
                {userFormErrors.password && <span className={styles.fieldError}>{userFormErrors.password}</span>}
              </label>
              <div className={styles.modalActions}>
                <button type="button" className={styles.secondaryBtn} onClick={closeUserModal}>
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
              <p className={styles.posterEmpty}>
                {(filterFrom || filterTo) ? 'No posters in the selected date range.' : 'No posters yet.'}
              </p>
            ) : (
              <div className={styles.posterGallery} style={posterGalleryStyle(doctorPosters.length)}>
                {doctorPosters.map((poster, index) => {
                  const kind = inferPosterKind(poster);
                  return (
                    <div key={poster.id || index} className={styles.posterOverlayItem}>
                      {kind === 'video' ? (
                        <video src={poster.image} controls playsInline preload="metadata" />
                      ) : (
                        <img src={poster.image} alt={poster.label || `Poster ${index + 1}`} />
                      )}
                      <em>{poster.label || `Poster ${index + 1}`}</em>
                      <small>{kind}</small>
                      <span className={styles.posterSendDate}>{formatPosterSendDate(poster.createdAt)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
