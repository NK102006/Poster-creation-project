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
];

export default function MasterPostersBoard({ onContextChange }) {
  const [posters, setPosters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [closingModal, setClosingModal] = useState(false);
  const [editingPoster, setEditingPoster] = useState(null);
  const [saving, setSaving] = useState(false);
  
  const [form, setForm] = useState({
    category: '',
    color: '',
    month: '',
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

  useEffect(() => {
    loadPosters();
  }, []);

  actionRef.current = {
    edit: (poster) => {
      setEditingPoster(poster);
      setForm({
        category: poster.category || '',
        color: poster.color || '',
        month: poster.month || '',
        uploaddate: poster.uploaddate ? new Date(poster.uploaddate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      });
      setPosterFile(null);
      setShowModal(true);
      setClosingModal(false);
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
      const button = event.target.closest('button[data-action]');
      const row = event.target.closest('tbody tr');
      if (!row || !button) return;
      const poster = table.row(row).data();
      if (!poster) return;
      event.preventDefault();
      event.stopPropagation();
      const action = button.getAttribute('data-action');
      if (action === 'edit') actionRef.current.edit(poster);
      if (action === 'delete') actionRef.current.remove(poster);
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
    setEditingPoster(null);
    setForm({ category: '', color: '', month: '', uploaddate: new Date().toISOString().split('T')[0] });
    setPosterFile(null);
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
    if (!editingPoster && !posterFile) {
      setError('Please select a poster image to upload.');
      return;
    }
    setSaving(true);
    setError('');

    const formData = new FormData();
    if (posterFile) formData.append('posterFile', posterFile);
    formData.append('category', form.category.trim());
    formData.append('color', form.color.trim());
    formData.append('month', form.month.trim());
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
      setError(err.message || 'Could not save poster');
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
            
            <form onSubmit={handleSave} className={styles.form}>
              <label className={styles.field}>
                <span>Poster Image {editingPoster ? '(Leave blank to keep)' : '*'}</span>
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={e => setPosterFile(e.target.files?.[0])}
                />
              </label>
              
              <label className={styles.field}>
                <span>Category</span>
                <input 
                  value={form.category} 
                  onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                />
              </label>

              <label className={styles.field}>
                <span>Color</span>
                <input 
                  value={form.color} 
                  onChange={e => setForm(p => ({ ...p, color: e.target.value }))}
                />
              </label>

              <label className={styles.field}>
                <span>Month</span>
                <input 
                  value={form.month} 
                  onChange={e => setForm(p => ({ ...p, month: e.target.value }))}
                />
              </label>

              <label className={styles.field}>
                <span>Upload Date</span>
                <input 
                  type="date"
                  value={form.uploaddate} 
                  onChange={e => setForm(p => ({ ...p, uploaddate: e.target.value }))}
                />
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
