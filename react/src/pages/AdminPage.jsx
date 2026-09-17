import { useEffect, useRef, useState } from 'react';
import DataTable from 'datatables.net-dt';
import 'datatables.net-dt/css/dataTables.dataTables.css';
import {
  createDoctor,
  deleteDoctor,
  listDoctors,
  updateDoctor,
} from '../features/admin/doctorsStore';
import styles from './AdminPage.module.css';

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const EMPTY_FORM = {
  name: '',
  contactnumber: '',
  logo: '',
  poster: '',
};

export default function AdminPage({ onLogout }) {
  const hostRef = useRef(null);
  const dataTableRef = useRef(null);
  const [rows, setRows] = useState(() => listDoctors());
  const [modalMode, setModalMode] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState(null);

  const refresh = () => setRows(listDoctors());

  useEffect(() => {
    const openEdit = (id) => {
      const doctor = listDoctors().find((row) => row.id === id);
      if (!doctor) return;
      setEditingId(id);
      setForm({
        name: doctor.name || '',
        contactnumber: doctor.contactnumber ? String(doctor.contactnumber) : '',
        logo: doctor.logo || '',
        poster: doctor.poster || '',
      });
      setFormError(null);
      setModalMode('edit');
    };

    const removeRow = (id) => {
      const doctor = listDoctors().find((row) => row.id === id);
      const label = doctor?.name || id;
      if (!window.confirm(`Delete “${label}”? This cannot be undone.`)) return;
      deleteDoctor(id);
      refresh();
    };

    window.__medportalAdmin = { openEdit, removeRow };
    return () => {
      delete window.__medportalAdmin;
    };
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    host.innerHTML = '';
    const tableEl = document.createElement('table');
    tableEl.className = `display nowrap ${styles.table}`;
    tableEl.style.width = '100%';
    host.appendChild(tableEl);

    const table = new DataTable(tableEl, {
      data: rows,
      deferRender: true,
      pageLength: 10,
      order: [[1, 'asc']],
      columns: [
        {
          title: 'ID',
          data: 'id',
          className: styles.colId,
          render: (data) =>
            `<code class="${styles.idCell}" title="${data}">${data}</code>`,
        },
        {
          title: 'Name',
          data: 'name',
          className: styles.colName,
        },
        {
          title: 'Contact Number',
          data: 'contactnumber',
          className: styles.colContact,
          render: (data) => data || '—',
        },
        {
          title: 'Logo',
          data: 'logo',
          orderable: false,
          searchable: false,
          className: styles.colMedia,
          render: (data) =>
            data
              ? `<img src="${data}" alt="Logo" class="${styles.logoThumb}" />`
              : `<span class="${styles.emptyMedia}">—</span>`,
        },
        {
          title: 'Poster',
          data: 'poster',
          orderable: false,
          searchable: false,
          className: styles.colMedia,
          render: (data) =>
            data
              ? `<img src="${data}" alt="Poster" class="${styles.posterThumb}" />`
              : `<span class="${styles.emptyMedia}">null</span>`,
        },
        {
          title: 'Actions',
          data: 'id',
          orderable: false,
          searchable: false,
          className: styles.colActions,
          render: (id) => `
            <div class="${styles.actionGroup}">
              <button type="button" class="${styles.editBtn}" data-action="edit" data-id="${id}">Edit</button>
              <button type="button" class="${styles.deleteBtn}" data-action="delete" data-id="${id}">Delete</button>
            </div>
          `,
        },
      ],
      language: {
        search: 'Search:',
        lengthMenu: 'Show _MENU_ entries',
        info: 'Showing _START_ to _END_ of _TOTAL_ doctors',
        infoEmpty: 'No doctors yet',
        zeroRecords: 'No matching doctors found',
      },
    });

    function onTableClick(e) {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      e.preventDefault();
      const action = btn.getAttribute('data-action');
      const id = btn.getAttribute('data-id');
      if (action === 'edit') window.__medportalAdmin?.openEdit(id);
      if (action === 'delete') window.__medportalAdmin?.removeRow(id);
    }

    host.addEventListener('click', onTableClick);
    dataTableRef.current = table;

    return () => {
      host.removeEventListener('click', onTableClick);
      table.destroy();
      dataTableRef.current = null;
      host.innerHTML = '';
    };
    // Initialize once; row updates happen in the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!dataTableRef.current) return;
    dataTableRef.current.clear();
    dataTableRef.current.rows.add(rows);
    dataTableRef.current.draw(false);
  }, [rows]);
  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setModalMode('create');
  };

  const closeModal = () => {
    setModalMode(null);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
  };

  const handleFile = async (field, file) => {
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setForm((prev) => ({ ...prev, [field]: dataUrl }));
  };

  const handleSave = (e) => {
    e.preventDefault();
    const name = form.name.trim();
    const contactnumber = form.contactnumber.trim();

    if (!name) {
      setFormError('Name is required.');
      return;
    }
    if (contactnumber && !/^\d{7,15}$/.test(contactnumber)) {
      setFormError('Enter a valid contact number (7–15 digits).');
      return;
    }

    if (modalMode === 'create') {
      createDoctor({
        name,
        contactnumber,
        logo: form.logo || undefined,
        poster: form.poster || null,
      });
    } else if (modalMode === 'edit' && editingId) {
      updateDoctor(editingId, {
        name,
        contactnumber,
        logo: form.logo || null,
        poster: form.poster || null,
      });
    }

    closeModal();
    refresh();
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brandGroup}>
          <div className={styles.logoIcon}>M</div>
          <div>
            <div className={styles.brandName}>MedPortal</div>
            <div className={styles.brandSub}>Admin Dashboard</div>
          </div>
        </div>
        <button type="button" className={styles.logoutBtn} onClick={onLogout}>
          Logout
        </button>
      </header>

      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <button type="button" className={`${styles.navItem} ${styles.navActive}`}>
            Doctors
          </button>
          <button type="button" className={styles.navItem} disabled title="Coming soon">
            Users
          </button>
        </aside>

        <main className={styles.main}>
          <div className={styles.titleRow}>
            <div>
              <h1 className={styles.title}>Doctors Collection</h1>
              <p className={styles.subtitle}>
                One DataTable with ID, name, contact, logo, poster — Edit and Delete stay in the same row.
              </p>
            </div>
            <button type="button" className={styles.addBtn} onClick={openCreate}>
              Add New
            </button>
          </div>

          <section className={styles.tableCard}>
            <div ref={hostRef} />
          </section>
        </main>
      </div>

      {modalMode && (
        <div className={styles.modalOverlay} role="presentation" onClick={closeModal}>
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-doctor-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="admin-doctor-modal-title" className={styles.modalTitle}>
              {modalMode === 'create' ? 'Add Doctor' : 'Edit Doctor'}
            </h2>

            <form className={styles.form} onSubmit={handleSave}>
              <label className={styles.label}>
                Name
                <input
                  className={styles.input}
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Doctor name"
                  required
                />
              </label>

              <label className={styles.label}>
                Contact Number
                <input
                  className={styles.input}
                  value={form.contactnumber}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, contactnumber: e.target.value }))
                  }
                  placeholder="9876543210"
                  inputMode="numeric"
                />
              </label>

              <div className={styles.mediaRow}>
                <label className={styles.label}>
                  Logo
                  <input
                    type="file"
                    accept="image/*"
                    className={styles.fileInput}
                    onChange={(e) => handleFile('logo', e.target.files?.[0])}
                  />
                  {form.logo ? (
                    <img src={form.logo} alt="Logo preview" className={styles.formLogo} />
                  ) : (
                    <span className={styles.emptyMedia}>No logo</span>
                  )}
                </label>

                <label className={styles.label}>
                  Poster
                  <input
                    type="file"
                    accept="image/*"
                    className={styles.fileInput}
                    onChange={(e) => handleFile('poster', e.target.files?.[0])}
                  />
                  {form.poster ? (
                    <img src={form.poster} alt="Poster preview" className={styles.formPoster} />
                  ) : (
                    <span className={styles.emptyMedia}>No poster</span>
                  )}
                </label>
              </div>

              {formError && <p className={styles.formError}>{formError}</p>}

              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelBtn} onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className={styles.saveBtn}>
                  {modalMode === 'create' ? 'Create' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
