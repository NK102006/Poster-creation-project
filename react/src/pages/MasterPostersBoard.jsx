import { useState, useEffect, useRef } from 'react';
import DataTable from 'datatables.net-dt';
import 'datatables.net-dt/css/dataTables.dataTables.css';
import { apiRequest } from '../lib/apiClient';
import styles from './AdminPortal.module.css';

const columns = [
  {
    title: 'Poster',
    data: 'posterlink',
    render: (data) => data ? `<img src="${data.startsWith('http') ? data : '/' + data}" alt="Poster" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;" />` : '—',
  },
  { title: 'Category', data: 'category' },
  { title: 'Color', data: 'color' },
  { title: 'Month', data: 'month' },
  {
    title: 'Upload Date',
    data: 'uploaddate',
    render: (data) => data ? new Date(data).toLocaleDateString() : '—',
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

export default function MasterPostersBoard({ onContextChange }) {
  const [posters, setPosters] = useState([]);
  const [categories, setCategories] = useState([]);
  const [themes, setThemes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [closingModal, setClosingModal] = useState(false);
  const [editingPoster, setEditingPoster] = useState(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');
  const [formErrors, setFormErrors] = useState({});
  
  const [form, setForm] = useState({
    category: '',
    color: '',
    month: '',
    enabled: true,
    uploaddate: new Date().toISOString().split('T')[0],
  });
  const [posterFile, setPosterFile] = useState(null);

  const hostRef = useRef(null);
  const tableRef = useRef(null);
  const actionRef = useRef({});

  useEffect(() => {
    onContextChange?.({ backLabel: '', onNavigateBack: null });
  }, [onContextChange]);

  const loadPosters = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await apiRequest('/superadmin/posters');
      setPosters(result.posters || []);
    } catch (err) {
      setError(err.message || 'Could not load posters');
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const result = await apiRequest('/categories');
      setCategories(result.categories || []);
    } catch (err) {
      console.error('Error loading categories:', err);
    }
  };

  const loadThemes = async () => {
    try {
      const result = await apiRequest('/themes');
      setThemes(result.themes || []);
    } catch (err) {
      console.error('Error loading themes:', err);
    }
  };

  useEffect(() => {
    loadPosters();
    loadCategories();
    loadThemes();
  }, []);

  actionRef.current = {
    edit: (poster) => {
      setEditingPoster(poster);
      setForm({
        category: poster.category || '',
        color: poster.color || '',
        month: poster.month || '',
        enabled: poster.enabled !== false,
        uploaddate: poster.uploaddate ? new Date(poster.uploaddate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      });
      setPosterFile(null);
      setModalError('');
      setFormErrors({});
      setShowModal(true);
      setClosingModal(false);
    },
    toggleStatus: async (poster) => {
      try {
        await apiRequest(`/superadmin/posters/${poster._id}/toggle-status`, { method: 'PATCH' });
        loadPosters();
      } catch (err) {
        setError(err.message || 'Could not update poster status');
      }
    },
    remove: async (poster) => {
      if (!window.confirm('Delete this poster?')) return;
      try {
        await apiRequest(`/superadmin/posters/${poster._id}`, { method: 'DELETE' });
        loadPosters();
      } catch (err) {
        setError(err.message || 'Could not delete poster');
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
      data: posters,
      columns,
      pageLength: 10,
      lengthMenu: [5, 10, 25, 50],
      order: [[4, 'desc']],
      autoWidth: false,
      scrollX: true,
      layout: {
        topStart: 'pageLength',
        topEnd: 'search',
        bottomStart: 'info',
        bottomEnd: 'paging',
      }
    });

    function onClick(event) {
      const actionEl = event.target.closest('[data-action]');
      const row = event.target.closest('tbody tr');
      if (!row || !actionEl) return;
      const poster = table.row(row).data();
      if (!poster) return;
      
      const action = actionEl.getAttribute('data-action');
      if (action === 'edit' || action === 'delete') {
        event.preventDefault();
        event.stopPropagation();
        if (action === 'edit') actionRef.current.edit(poster);
        if (action === 'delete') actionRef.current.remove(poster);
      } else if (action === 'toggle-status') {
        event.preventDefault();
        event.stopPropagation();
        actionRef.current.toggleStatus(poster);
      }
    }

    host.addEventListener('click', onClick);
    tableRef.current = table;

    return () => {
      host.removeEventListener('click', onClick);
      table.destroy();
      tableRef.current = null;
    };
  }, [posters]);

  const openCreate = () => {
    loadCategories();
    loadThemes();
    setEditingPoster(null);
    setForm({ category: '', color: '', month: '', enabled: true, uploaddate: new Date().toISOString().split('T')[0] });
    setPosterFile(null);
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
    
    const errs = {};
    if (!editingPoster && !posterFile) errs.posterFile = 'Please select a poster image to upload.';
    if (!form.category.trim()) errs.category = 'Category is required.';
    if (!form.color.trim()) errs.color = 'Color is required.';
    if (!form.month.trim()) errs.month = 'Month is required.';
    if (!form.uploaddate) errs.uploaddate = 'Upload date is required.';

    if (Object.keys(errs).length > 0) {
      setFormErrors(errs);
      return;
    }

    setSaving(true);
    setFormErrors({});
    setModalError('');

    const formData = new FormData();
    if (posterFile) formData.append('posterFile', posterFile);
    formData.append('category', form.category.trim());
    formData.append('color', form.color.trim());
    formData.append('month', form.month.trim());
    formData.append('enabled', form.enabled);
    if (form.uploaddate) formData.append('uploaddate', form.uploaddate);

    try {
      if (editingPoster) {
        await apiRequest(`/superadmin/posters/${editingPoster._id}`, {
          method: 'PUT',
          body: formData,
        });
      } else {
        await apiRequest('/superadmin/posters', {
          method: 'POST',
          body: formData,
        });
      }
      closeModal();
      loadPosters();
    } catch (err) {
      setModalError(err.message || 'Could not save poster');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className={`${styles.toolbar} ${styles.desktopOnly}`}>
        <div />
        <button type="button" className={styles.primaryBtn} onClick={openCreate}>
          + Add poster
        </button>
      </div>

      {error && <p className={styles.error}>{error}</p>}
      {loading && <p className={styles.statusText}>Loading…</p>}

      <div className={styles.tableCard}>
        <div ref={hostRef} className={styles.dtHost} />
        {!loading && posters.length === 0 && (
          <p className={styles.emptyState}>No posters found.</p>
        )}
      </div>

      {showModal && (
        <div className={`${styles.modalOverlay} ${closingModal ? styles.closing : ''}`} onClick={closeModal}>
          <div className={styles.modal} style={{ maxWidth: '500px' }} role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>{editingPoster ? 'Edit poster' : 'Add poster'}</h2>
            
            {modalError && <p className={styles.error} style={{ marginBottom: '16px' }}>{modalError}</p>}
            
            <form onSubmit={handleSave} className={styles.form} noValidate>
              <label className={styles.field}>
                <span>Poster Image {editingPoster ? '(Leave blank to keep)' : '*'}</span>
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={e => {
                    setPosterFile(e.target.files?.[0]);
                    if (formErrors.posterFile) setFormErrors(p => ({ ...p, posterFile: null }));
                  }}
                />
                {formErrors.posterFile && <span className={styles.fieldError}>{formErrors.posterFile}</span>}
              </label>
              
              <label className={styles.field}>
                <span>Category *</span>
                <select 
                  value={form.category} 
                  onChange={e => {
                    setForm(p => ({ ...p, category: e.target.value }));
                    if (formErrors.category) setFormErrors(p => ({ ...p, category: null }));
                  }}
                >
                  <option value="">Select Category</option>
                  {categories.map((cat) => (
                    <option key={cat._id || cat.name} value={cat.name}>
                      {cat.name}
                    </option>
                  ))}
                  {form.category && !categories.some(c => c.name.toLowerCase() === form.category.toLowerCase()) && (
                    <option value={form.category}>{form.category} (Current)</option>
                  )}
                </select>
                {formErrors.category && <span className={styles.fieldError}>{formErrors.category}</span>}
              </label>

              <label className={styles.field}>
                <span>Color / Theme *</span>
                <select 
                  value={form.color} 
                  onChange={e => {
                    setForm(p => ({ ...p, color: e.target.value }));
                    if (formErrors.color) setFormErrors(p => ({ ...p, color: null }));
                  }}
                >
                  <option value="">Select Theme / Color</option>
                  {themes.map((th) => (
                    <option key={th._id || th.name} value={th.name}>
                      {th.name}
                    </option>
                  ))}
                  {form.color && !themes.some(t => t.name.toLowerCase() === form.color.toLowerCase()) && (
                    <option value={form.color}>{form.color} (Current)</option>
                  )}
                </select>
                {formErrors.color && <span className={styles.fieldError}>{formErrors.color}</span>}
              </label>

              <label className={styles.field}>
                <span>Month *</span>
                <select 
                  value={form.month} 
                  onChange={e => {
                    setForm(p => ({ ...p, month: e.target.value }));
                    if (formErrors.month) setFormErrors(p => ({ ...p, month: null }));
                  }}
                >
                  <option value="">Select Month</option>
                  <option value="January">January</option>
                  <option value="February">February</option>
                  <option value="March">March</option>
                  <option value="April">April</option>
                  <option value="May">May</option>
                  <option value="June">June</option>
                  <option value="July">July</option>
                  <option value="August">August</option>
                  <option value="September">September</option>
                  <option value="October">October</option>
                  <option value="November">November</option>
                  <option value="December">December</option>
                </select>
                {formErrors.month && <span className={styles.fieldError}>{formErrors.month}</span>}
              </label>

              <label className={styles.field}>
                <span>Upload Date *</span>
                <input 
                  type="date"
                  value={form.uploaddate} 
                  onChange={e => {
                    setForm(p => ({ ...p, uploaddate: e.target.value }));
                    if (formErrors.uploaddate) setFormErrors(p => ({ ...p, uploaddate: null }));
                  }}
                />
                {formErrors.uploaddate && <span className={styles.fieldError}>{formErrors.uploaddate}</span>}
              </label>

              {editingPoster && (
                <label className={styles.field} style={{ flexDirection: 'row', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '8px' }}>
                  <label className={styles.switch}>
                    <input 
                      type="checkbox" 
                      checked={form.enabled} 
                      onChange={e => setForm(p => ({ ...p, enabled: e.target.checked }))}
                    />
                    <span className={styles.slider}></span>
                  </label>
                  <span style={{ marginBottom: 0 }}>Enable this poster? (Uncheck to remove from form)</span>
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
