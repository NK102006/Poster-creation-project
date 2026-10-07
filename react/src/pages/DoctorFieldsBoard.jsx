import { useState, useEffect, useRef } from 'react';
import DataTable from 'datatables.net-dt';
import 'datatables.net-dt/css/dataTables.dataTables.css';
import { apiRequest } from '../lib/apiClient';
import styles from './AdminPortal.module.css';
import { confirmDialog } from '../lib/alerts';

const columns = [
  { title: 'Field Key', data: 'key' },
  { title: 'Label', data: 'label' },
  { title: 'Type', data: 'type' },
  { title: 'Required', data: 'required', render: (data) => (data ? 'Yes' : 'No') },
  {
    title: 'Edit',
    data: null,
    orderable: false,
    className: styles.colActions,
    render: () => `<button type="button" class="${styles.editBtn}" data-action="edit">Edit</button>`,
  },
  {
    title: 'Active',
    data: 'enabled',
    orderable: false,
    className: styles.colActions,
    render: (data) => `
      <label class="${styles.switch}">
        <input type="checkbox" data-action="toggle-enable" ${data ? 'checked' : ''} />
        <span class="${styles.slider}"></span>
      </label>
    `,
  },
  {
    title: 'Delete',
    data: null,
    orderable: false,
    className: styles.colActions,
    render: () => `<button type="button" class="${styles.deleteBtn}" data-action="delete">Delete</button>`,
  },
];

const emptyForm = {
  key: '',
  label: '',
  type: 'text',
  required: false,
  enabled: true,
};

export default function DoctorFieldsBoard({ onContextChange }) {
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [closingModal, setClosingModal] = useState(false);
  const [editingField, setEditingField] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [form, setForm] = useState(emptyForm);

  const hostRef = useRef(null);
  const tableRef = useRef(null);
  const actionRef = useRef({});

  useEffect(() => {
    onContextChange?.({ backLabel: '', onNavigateBack: null });
  }, [onContextChange]);

  const loadFields = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await apiRequest('/doctor-fields');
      setFields(result.fields || []);
    } catch (err) {
      setError(err.message || 'Could not load fields');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFields();
  }, []);

  const openCreate = () => {
    setEditingField(null);
    setForm(emptyForm);
    setFormErrors({});
    setShowModal(true);
    setClosingModal(false);
  };

  actionRef.current = {
    edit: (field) => {
      setEditingField(field);
      setForm({
        key: field.key,
        label: field.label,
        type: field.type,
        required: field.required,
        enabled: field.enabled,
      });
      setFormErrors({});
      setShowModal(true);
      setClosingModal(false);
    },
    toggleEnable: async (field) => {
      try {
        setLoading(true);
        await apiRequest(`/superadmin/doctor-fields/${field._id}`, {
          method: 'PUT',
          body: { ...field, enabled: !field.enabled },
        });
        loadFields();
      } catch (err) {
        setError(err.message || 'Could not toggle field');
        setLoading(false);
      }
    },
    delete: async (field) => {
      if (!(await confirmDialog({
        title: 'Delete field?',
        text: `Are you sure you want to delete the field "${field.label}"?`,
        confirmText: 'Delete',
        danger: true,
      }))) return;
      try {
        setLoading(true);
        await apiRequest(`/superadmin/doctor-fields/${field._id}`, {
          method: 'DELETE',
        });
        loadFields();
      } catch (err) {
        setError(err.message || 'Could not delete field');
        setLoading(false);
      }
    },
  };

  useEffect(() => {
    if (!hostRef.current) return;
    const host = hostRef.current;
    host.innerHTML = '';
    const tableEl = document.createElement('table');
    tableEl.className = `display ${styles.table}`;
    tableEl.style.width = '100%';
    host.appendChild(tableEl);

    const table = new DataTable(tableEl, {
      data: fields,
      language: { emptyTable: 'No fields found. Click "+ Add field" to create one.' },
      columns,
      pageLength: 10,
      autoWidth: false,

    });

    function onClick(event) {
      const actionEl = event.target.closest('[data-action]');
      const row = event.target.closest('tbody tr');
      if (!row || !actionEl) return;
      const data = table.row(row).data();
      if (!data) return;
      const action = actionEl.getAttribute('data-action');
      if (action === 'edit') {
        event.preventDefault();
        event.stopPropagation();
        actionRef.current.edit(data);
      } else if (action === 'toggle-enable') {
        event.preventDefault();
        event.stopPropagation();
        actionRef.current.toggleEnable(data);
      } else if (action === 'delete') {
        event.preventDefault();
        event.stopPropagation();
        actionRef.current.delete(data);
      }
    }
    host.addEventListener('click', onClick);
    tableRef.current = table;
    return () => {
      host.removeEventListener('click', onClick);
      table.destroy();
      tableRef.current = null;
    };
  }, [fields]);

  const closeModal = () => {
    setClosingModal(true);
    setTimeout(() => {
      setShowModal(false);
      setClosingModal(false);
    }, 400);
  };

  const handleSave = async (event) => {
    event.preventDefault();
    const errs = {};
    if (!form.label.trim()) errs.label = 'Label is required';
    if (!form.type) errs.type = 'Type is required';

    if (Object.keys(errs).length > 0) {
      setFormErrors(errs);
      return;
    }

    setSaving(true);
    setFormErrors({});

    try {
      if (editingField) {
        await apiRequest(`/superadmin/doctor-fields/${editingField._id}`, {
          method: 'PUT',
          body: {
            label: form.label.trim(),
            type: form.type,
            required: form.required,
            enabled: form.enabled,
          },
        });
      } else {
        await apiRequest('/superadmin/doctor-fields', {
          method: 'POST',
          body: {
            label: form.label.trim(),
            type: form.type,
            required: form.required,
            enabled: form.enabled,
          },
        });
      }
      closeModal();
      loadFields();
    } catch (err) {
      setFormErrors({ root: err.message || 'Could not save field' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className={styles.toolbar}>
        <div />
        <button type="button" className={styles.primaryBtn} onClick={openCreate}>
          + Add field
        </button>
      </div>

      {error && <p className={styles.error} style={{ marginBottom: '16px' }}>{error}</p>}
      {loading && <p className={styles.statusText}>Loading…</p>}

      <div className={styles.tableCard}>
        <div ref={hostRef} className={styles.dtHost} />
      </div>

      {showModal && (
        <div className={`${styles.modalOverlay} ${closingModal ? styles.closing : ''}`} onClick={closeModal}>
          <div
            className={styles.modal}
            style={{ maxWidth: '500px' }}
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className={styles.modalTitle}>{editingField ? 'Edit Field' : 'Add Field'}</h2>

            {formErrors.root && (
              <p className={styles.error} style={{ marginBottom: '16px' }}>
                {formErrors.root}
              </p>
            )}

            <form onSubmit={handleSave} className={styles.form} noValidate>
              <label className={styles.field}>
                <span>Display Label * (e.g. Years of Experience)</span>
                <input
                  className={styles.inputField}
                  value={form.label}
                  onChange={(e) => {
                    setForm((p) => ({ ...p, label: e.target.value }));
                    if (formErrors.label) setFormErrors((p) => ({ ...p, label: null }));
                  }}
                />
                {formErrors.label && <span className={styles.fieldError}>{formErrors.label}</span>}
              </label>

              <label className={styles.field}>
                <span>Input Type *</span>
                <select
                  className={styles.inputField}
                  value={form.type}
                  onChange={(e) => {
                    setForm((p) => ({ ...p, type: e.target.value }));
                    if (formErrors.type) setFormErrors((p) => ({ ...p, type: null }));
                  }}
                >
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="tel">Telephone / Mobile</option>
                  <option value="email">Email</option>
                  <option value="date">Date</option>
                </select>
                {formErrors.type && <span className={styles.fieldError}>{formErrors.type}</span>}
              </label>

              <label
                className={styles.field}
                style={{ flexDirection: 'row', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
              >
                <input
                  type="checkbox"
                  checked={form.required}
                  onChange={(e) => setForm((p) => ({ ...p, required: e.target.checked }))}
                />
                <span style={{ marginBottom: 0 }}>Compulsory Field?</span>
              </label>

              <label
                className={styles.field}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  marginTop: '8px',
                }}
              >
                <label className={styles.switch}>
                  <input
                    type="checkbox"
                    checked={form.enabled}
                    onChange={(e) => setForm((p) => ({ ...p, enabled: e.target.checked }))}
                  />
                  <span className={styles.slider}></span>
                </label>
                <span style={{ marginBottom: 0 }}>Active? (Uncheck to remove from form)</span>
              </label>

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
}
