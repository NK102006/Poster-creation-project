import { useState, useEffect, useRef } from 'react';
import DataTable from 'datatables.net-dt';
import 'datatables.net-dt/css/dataTables.dataTables.css';
import { apiRequest } from '../lib/apiClient';
import styles from './AdminPortal.module.css';

const columns = [
  {
    title: 'Category Name',
    data: 'name',
    className: styles.nameCell,
    render: (data) => `<strong>${escapeHtml(data || '—')}</strong>`,
  },
  {
    title: 'Posters Count',
    data: 'posterCount',
    render: (data) => `<span class="${styles.badge || ''}" style="display: inline-block; padding: 2px 10px; border-radius: 12px; background: rgba(31, 111, 159, 0.1); color: #1f6f9f; font-weight: 600; font-size: 13px;">${data ?? 0}</span>`,
  },
  {
    title: 'Created Date',
    data: 'createdAt',
    render: (data) => (data ? new Date(data).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—'),
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
  {
    title: 'Enabled', 
    data: 'enabled',
    orderable: false,
    className: styles.colActions,
    render: (data) => `
      <label class="${styles.switch}">
        <input type="checkbox" data-action="toggle-status" ${data !== false ? 'checked' : ''} />
        <span class="${styles.slider}"></span>
      </label>
    `
  },
];

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export default function PosterCategoriesBoard({ onContextChange, onNavigateToPosters }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [closingModal, setClosingModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');
  const [formErrors, setFormErrors] = useState({});
  const [form, setForm] = useState({ name: '', enabled: true });

  const hostRef = useRef(null);
  const tableRef = useRef(null);
  const actionRef = useRef({});

  useEffect(() => {
    onContextChange?.({ backLabel: '', onNavigateBack: null });
  }, [onContextChange]);

  const loadCategories = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await apiRequest('/superadmin/categories');
      setCategories(result.categories || []);
    } catch (err) {
      setError(err.message || 'Could not load categories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  actionRef.current = {
    edit: (cat) => {
      setEditingCategory(cat);
      setForm({ name: cat.name || '', enabled: cat.enabled !== false });
      setModalError('');
      setFormErrors({});
      setShowModal(true);
      setClosingModal(false);
    },
    toggleStatus: async (cat) => {
      try {
        await apiRequest(`/superadmin/categories/${cat._id}/toggle-status`, { method: 'PATCH' });
        loadCategories();
      } catch (err) {
        setError(err.message || 'Could not update category status');
      }
    },
    remove: async (cat) => {
      const confirmMsg = cat.posterCount > 0
        ? `Category "${cat.name}" is used by ${cat.posterCount} poster(s). Are you sure you want to delete this category?`
        : `Delete category "${cat.name}"?`;
      if (!window.confirm(confirmMsg)) return;

      try {
        await apiRequest(`/superadmin/categories/${cat._id}`, { method: 'DELETE' });
        loadCategories();
      } catch (err) {
        setError(err.message || 'Could not delete category');
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
      data: categories,
      columns,
      pageLength: 10,
      lengthMenu: [5, 10, 25, 50],
      order: [[0, 'asc']],
      autoWidth: false,
      scrollX: true,
      layout: {
        topStart: 'pageLength',
        topEnd: 'search',
        bottomStart: 'info',
        bottomEnd: 'paging',
      },
    });

    function onClick(event) {
      const actionEl = event.target.closest('[data-action]');
      const row = event.target.closest('tbody tr');
      if (!row || !actionEl) return;
      const cat = table.row(row).data();
      if (!cat) return;
      
      const action = actionEl.getAttribute('data-action');
      if (action === 'edit' || action === 'delete') {
        event.preventDefault();
        event.stopPropagation();
        if (action === 'edit') actionRef.current.edit(cat);
        if (action === 'delete') actionRef.current.remove(cat);
      } else if (action === 'toggle-status') {
        event.preventDefault();
        event.stopPropagation();
        actionRef.current.toggleStatus(cat);
      }
    }

    host.addEventListener('click', onClick);
    tableRef.current = table;

    return () => {
      host.removeEventListener('click', onClick);
      table.destroy();
      tableRef.current = null;
    };
  }, [categories]);

  const openCreate = () => {
    setEditingCategory(null);
    setForm({ name: '', enabled: true });
    setModalError('');
    setFormErrors({});
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

    const trimmed = form.name.trim();
    const errs = {};
    if (!trimmed) {
      errs.name = 'Category name is required.';
    } else if (
      categories.some(
        (c) =>
          c.name.toLowerCase() === trimmed.toLowerCase() &&
          (!editingCategory || c._id !== editingCategory._id)
      )
    ) {
      errs.name = 'A category with this name already exists.';
    }

    if (Object.keys(errs).length > 0) {
      setFormErrors(errs);
      return;
    }

    setSaving(true);
    setFormErrors({});
    setModalError('');

    try {
      if (editingCategory) {
        await apiRequest(`/superadmin/categories/${editingCategory._id}`, {
          method: 'PUT',
          body: { name: trimmed, enabled: form.enabled },
        });
      } else {
        await apiRequest('/superadmin/categories', {
          method: 'POST',
          body: { name: trimmed, enabled: form.enabled },
        });
      }
      closeModal();
      loadCategories();
    } catch (err) {
      setModalError(err.message || 'Could not save category');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className={`${styles.toolbar} ${styles.desktopOnly}`}>
        <div>
          {onNavigateToPosters && (
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={onNavigateToPosters}
            >
              ← Back to Posters
            </button>
          )}
        </div>
        <button type="button" className={styles.primaryBtn} onClick={openCreate}>
          + Add category
        </button>
      </div>

      {error && <p className={styles.error}>{error}</p>}
      {loading && <p className={styles.statusText}>Loading categories…</p>}

      <div className={styles.tableCard}>
        <div ref={hostRef} className={styles.dtHost} />
        {!loading && categories.length === 0 && (
          <p className={styles.emptyState}>No categories found. Click "+ Add category" to create one.</p>
        )}
      </div>

      {showModal && (
        <div
          className={`${styles.modalOverlay} ${closingModal ? styles.closing : ''}`}
          onClick={closeModal}
        >
          <div
            className={styles.modal}
            style={{ maxWidth: '460px' }}
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className={styles.modalTitle}>
              {editingCategory ? 'Edit Category' : 'Add New Category'}
            </h2>

            {modalError && (
              <p className={styles.error} style={{ marginBottom: '16px' }}>
                {modalError}
              </p>
            )}

            <form onSubmit={handleSave} className={styles.form} noValidate>
              <label className={styles.field}>
                <span>Category Name *</span>
                <input
                  type="text"
                  placeholder="e.g. Festival, Education, Video, Cardiology..."
                  value={form.name}
                  autoFocus
                  onChange={(e) => {
                    setForm({ name: e.target.value });
                    if (formErrors.name) setFormErrors((p) => ({ ...p, name: null }));
                  }}
                />
                {formErrors.name && (
                  <span className={styles.fieldError}>{formErrors.name}</span>
                )}
              </label>

              {editingCategory && editingCategory.posterCount > 0 && (
                <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: '4px 0 12px' }}>
                  Note: Renaming this category will automatically update all {editingCategory.posterCount} poster(s) associated with it.
                </p>
              )}

              {editingCategory && (
                <label className={styles.field} style={{ flexDirection: 'row', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '8px' }}>
                  <label className={styles.switch}>
                    <input 
                      type="checkbox" 
                      checked={form.enabled} 
                      onChange={e => setForm(p => ({ ...p, enabled: e.target.checked }))}
                    />
                    <span className={styles.slider}></span>
                  </label>
                  <span style={{ marginBottom: 0 }}>Enable this category? (Uncheck to remove from form)</span>
                </label>
              )}

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
