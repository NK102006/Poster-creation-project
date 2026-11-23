import { useState, useEffect, useRef } from 'react';
import DataTable from 'datatables.net-dt';
import 'datatables.net-dt/css/dataTables.dataTables.css';
import { apiRequest } from '../lib/apiClient';
import PosterDesigner from './PosterDesigner';
import styles from './AdminPortal.module.css';
import { confirmDialog } from '../lib/alerts';

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
    title: 'Created Date',
    data: 'createdAt',
    render: (data) => (data ? new Date(data).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '-'),
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
    title: 'Active',
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
  const [editingPoster, setEditingPoster] = useState(null); // poster opened in the designer
  const [designerOpen, setDesignerOpen] = useState(false);
  const [notice, setNotice] = useState('');

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
    edit: (poster) => openDesigner(poster),
    toggleStatus: async (poster) => {
      try {
        await apiRequest(`/superadmin/posters/${poster._id}/toggle-status`, { method: 'PATCH' });
        loadPosters();
      } catch (err) {
        setError(err.message || 'Could not update poster status');
      }
    },
    remove: async (poster) => {
      if (!(await confirmDialog({ title: 'Delete this poster?', confirmText: 'Delete', danger: true }))) return;
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
      language: { emptyTable: 'No posters found.' },
      columns,
      pageLength: 10,
      lengthMenu: [5, 10, 25, 50],
      order: [[4, 'desc']],
      autoWidth: false,

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

  const openDesigner = (poster = null) => {
    loadCategories();
    loadThemes();
    setNotice('');
    setEditingPoster(poster);
    setDesignerOpen(true);
  };

  const handleDesignerSaved = (message) => {
    setDesignerOpen(false);
    setEditingPoster(null);
    setNotice(message);
    loadPosters();
  };

  return (
    <>
      <div className={`${styles.toolbar} ${styles.desktopOnly}`}>
        <div />
        <div className={styles.toolbarActions}>
          <button type="button" className={styles.primaryBtn} onClick={() => openDesigner()}>
            + Add poster
          </button>
        </div>
      </div>

      {error && <p className={styles.error}>{error}</p>}
      {notice && <p className={styles.statusText} role="status">{notice}</p>}
      {loading && <p className={styles.statusText}>Loading…</p>}

      <div className={styles.tableCard}>
        <div ref={hostRef} className={styles.dtHost} />
      </div>

      {designerOpen && (
        <PosterDesigner
          categories={categories}
          themes={themes}
          initialPoster={editingPoster}
          onClose={() => {
            setDesignerOpen(false);
            setEditingPoster(null);
          }}
          onSaved={handleDesignerSaved}
        />
      )}
    </>
  );
}
