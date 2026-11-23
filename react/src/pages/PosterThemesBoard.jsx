import { useState, useEffect, useRef } from 'react';
import DataTable from 'datatables.net-dt';
import 'datatables.net-dt/css/dataTables.dataTables.css';
import { apiRequest } from '../lib/apiClient';
import styles from './AdminPortal.module.css';
import { confirmDialog } from '../lib/alerts';

const THEME_PRESETS = [
  { name: 'Ocean Teal', headerBg: '#0f766e', footerBg: '#134e4a', accentColor: '#14b8a6' },
  { name: 'Amber Gold', headerBg: '#b45309', footerBg: '#78350f', accentColor: '#f59e0b' },
  { name: 'Midnight Slate', headerBg: '#334155', footerBg: '#0f172a', accentColor: '#64748b' },
  { name: 'Coral Pink', headerBg: '#be185d', footerBg: '#831843', accentColor: '#ec4899' },
  { name: 'Indigo Dream', headerBg: '#4338ca', footerBg: '#312e81', accentColor: '#6366f1' },
];

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

const columns = [
  {
    title: 'Swatch',
    data: null,
    orderable: false,
    searchable: false,
    render: (row) => {
      const h = row?.headerBg || '#1a4f8b';
      const f = row?.footerBg || '#143a66';
      return `<div style="width: 44px; height: 26px; border-radius: 6px; background: linear-gradient(135deg, ${h}, ${f}); box-shadow: 0 2px 6px rgba(0,0,0,0.18); border: 1px solid rgba(255,255,255,0.3);"></div>`;
    },
  },
  {
    title: 'Theme Name',
    data: 'name',
    className: styles.nameCell,
    render: (data) => `<strong>${escapeHtml(data || '—')}</strong>`,
  },
  {
    title: 'Primary / Header',
    data: 'headerBg',
    render: (data) => `
      <div style="display: flex; align-items: center; gap: 6px;">
        <span style="display: inline-block; width: 14px; height: 14px; border-radius: 50%; background: ${data}; border: 1px solid rgba(0,0,0,0.15);"></span>
        <code>${escapeHtml(data || '—')}</code>
      </div>
    `,
  },
  {
    title: 'Footer / Dark',
    data: 'footerBg',
    render: (data) => `
      <div style="display: flex; align-items: center; gap: 6px;">
        <span style="display: inline-block; width: 14px; height: 14px; border-radius: 50%; background: ${data}; border: 1px solid rgba(0,0,0,0.15);"></span>
        <code>${escapeHtml(data || '—')}</code>
      </div>
    `,
  },
  {
    title: 'Posters Count',
    data: 'posterCount',
    render: (data) => `<span class="${styles.badge || ''}" style="display: inline-block; padding: 2px 10px; border-radius: 12px; background: rgba(31, 111, 159, 0.1); color: #1f6f9f; font-weight: 600; font-size: 13px;">${data ?? 0}</span>`,
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

export default function PosterThemesBoard({ onContextChange, onNavigateToPosters }) {
  const [themes, setThemes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [closingModal, setClosingModal] = useState(false);
  const [editingTheme, setEditingTheme] = useState(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');
  const [formErrors, setFormErrors] = useState({});

  const [form, setForm] = useState({
    name: '',
    headerBg: '#1a4f8b',
    footerBg: '#143a66',
    accentColor: '#2b6cb0',
    description: '',
    enabled: true,
  });

  const hostRef = useRef(null);
  const tableRef = useRef(null);
  const actionRef = useRef({});

  useEffect(() => {
    onContextChange?.({ backLabel: '', onNavigateBack: null });
  }, [onContextChange]);

  const loadThemes = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await apiRequest('/superadmin/themes');
      setThemes(result.themes || []);
    } catch (err) {
      setError(err.message || 'Could not load themes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadThemes();
  }, []);

  actionRef.current = {
    edit: (theme) => {
      setEditingTheme(theme);
      setForm({
        name: theme.name || '',
        headerBg: theme.headerBg || '#1a4f8b',
        footerBg: theme.footerBg || '#143a66',
        accentColor: theme.accentColor || '#2b6cb0',
        description: theme.description || '',
        enabled: theme.enabled !== false,
      });
      setModalError('');
      setFormErrors({});
      setShowModal(true);
      setClosingModal(false);
    },
    toggleStatus: async (theme) => {
      try {
        await apiRequest(`/superadmin/themes/${theme._id}/toggle-status`, { method: 'PATCH' });
        loadThemes();
      } catch (err) {
        setError(err.message || 'Could not update theme status');
      }
    },
    remove: async (theme) => {
      const confirmMsg = theme.posterCount > 0
        ? `Theme "${theme.name}" is used by ${theme.posterCount} poster(s). Deleting it also deletes those posters from the Posters list. Posters already created for doctors are not affected.`
        : `Delete theme "${theme.name}"?`;
      if (!(await confirmDialog({ title: 'Delete theme?', text: confirmMsg, confirmText: 'Delete', danger: true }))) return;

      try {
        await apiRequest(`/superadmin/themes/${theme._id}`, { method: 'DELETE' });
        loadThemes();
      } catch (err) {
        setError(err.message || 'Could not delete theme');
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
      data: themes,
      language: { emptyTable: 'No themes found. Click "+ Add theme" to create one.' },
      columns,
      pageLength: 10,
      lengthMenu: [5, 10, 25, 50],
      autoWidth: false,

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
      const theme = table.row(row).data();
      if (!theme) return;
      
      const action = actionEl.getAttribute('data-action');
      if (action === 'edit' || action === 'delete') {
        event.preventDefault();
        event.stopPropagation();
        if (action === 'edit') actionRef.current.edit(theme);
        if (action === 'delete') actionRef.current.remove(theme);
      } else if (action === 'toggle-status') {
        event.preventDefault();
        event.stopPropagation();
        actionRef.current.toggleStatus(theme);
      }
    }

    host.addEventListener('click', onClick);
    tableRef.current = table;

    return () => {
      host.removeEventListener('click', onClick);
      table.destroy();
      tableRef.current = null;
    };
  }, [themes]);

  const openCreate = () => {
    setEditingTheme(null);
    setForm({
      name: '',
      headerBg: '#0f766e',
      footerBg: '#134e4a',
      accentColor: '#14b8a6',
      description: '',
      enabled: true,
    });
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

  const applyPreset = (preset) => {
    setForm((p) => ({
      ...p,
      name: p.name || preset.name,
      headerBg: preset.headerBg,
      footerBg: preset.footerBg,
      accentColor: preset.accentColor,
    }));
  };

  const handleSave = async (event) => {
    event.preventDefault();

    const trimmed = form.name.trim();
    const errs = {};
    if (!trimmed) {
      errs.name = 'Theme name is required.';
    } else if (
      themes.some(
        (t) =>
          t.name.toLowerCase() === trimmed.toLowerCase() &&
          (!editingTheme || t._id !== editingTheme._id)
      )
    ) {
      errs.name = 'A theme with this name already exists.';
    }

    if (Object.keys(errs).length > 0) {
      setFormErrors(errs);
      return;
    }

    setSaving(true);
    setFormErrors({});
    setModalError('');

    try {
      if (editingTheme) {
        await apiRequest(`/superadmin/themes/${editingTheme._id}`, {
          method: 'PUT',
          body: { ...form, name: trimmed },
        });
      } else {
        await apiRequest('/superadmin/themes', {
          method: 'POST',
          body: { ...form, name: trimmed },
        });
      }
      closeModal();
      loadThemes();
    } catch (err) {
      setModalError(err.message || 'Could not save theme');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className={`${styles.toolbar} ${styles.desktopOnly}`}>
        <div></div>
        <button type="button" className={styles.primaryBtn} onClick={openCreate}>
          + Add theme
        </button>
      </div>

      {error && <p className={styles.error}>{error}</p>}
      {loading && <p className={styles.statusText}>Loading themes…</p>}

      <div className={styles.tableCard}>
        <div ref={hostRef} className={styles.dtHost} />
      </div>

      {showModal && (
        <div
          className={`${styles.modalOverlay} ${closingModal ? styles.closing : ''}`}
          onClick={closeModal}
        >
          <div
            className={styles.modal}
            style={{ maxWidth: '520px' }}
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className={styles.modalTitle}>
              {editingTheme ? 'Edit Theme' : 'Add New Theme'}
            </h2>

            {modalError && (
              <p className={styles.error} style={{ marginBottom: '16px' }}>
                {modalError}
              </p>
            )}

            {/* Live Theme Preview Jewel */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              padding: '14px',
              background: '#f8fafc',
              borderRadius: '12px',
              marginBottom: '16px',
              border: '1px solid rgba(0,0,0,0.06)',
            }}>
              <div style={{
                width: '64px',
                height: '42px',
                borderRadius: '8px',
                background: `linear-gradient(145deg, ${form.headerBg}, ${form.footerBg})`,
                boxShadow: `0 8px 20px ${form.headerBg}40`,
                border: '1px solid rgba(255,255,255,0.4)',
                flexShrink: 0,
              }} />
              <div>
                <strong style={{ fontSize: '15px', color: '#1e293b' }}>
                  {form.name || 'Theme Preview'}
                </strong>
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  Header: {form.headerBg} &bull; Footer: {form.footerBg}
                </div>
              </div>
            </div>

            {/* Quick Presets */}
            {!editingTheme && (
              <div style={{ marginBottom: '16px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Quick Color Presets:
                </span>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                  {THEME_PRESETS.map((p) => (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => applyPreset(p)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 10px',
                        borderRadius: '16px',
                        border: '1px solid rgba(0,0,0,0.12)',
                        background: '#ffffff',
                        fontSize: '12px',
                        cursor: 'pointer',
                        fontWeight: 500,
                      }}
                    >
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: p.headerBg }} />
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleSave} className={styles.form} noValidate>
              <label className={styles.field}>
                <span>Theme Name *</span>
                <input
                  type="text"
                  placeholder="e.g. Ocean Teal, Amber Gold..."
                  value={form.name}
                  autoFocus
                  onChange={(e) => {
                    setForm((p) => ({ ...p, name: e.target.value }));
                    if (formErrors.name) setFormErrors((p) => ({ ...p, name: null }));
                  }}
                />
                {formErrors.name && (
                  <span className={styles.fieldError}>{formErrors.name}</span>
                )}
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label className={styles.field}>
                  <span>Header / Primary Color</span>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="color"
                      value={form.headerBg}
                      style={{ width: '40px', height: '36px', padding: 0, border: 'none', borderRadius: '6px', cursor: 'pointer', background: 'transparent' }}
                      onChange={(e) => setForm((p) => ({ ...p, headerBg: e.target.value }))}
                    />
                    <input
                      type="text"
                      value={form.headerBg}
                      onChange={(e) => setForm((p) => ({ ...p, headerBg: e.target.value }))}
                    />
                  </div>
                </label>

                <label className={styles.field}>
                  <span>Footer / Dark Color</span>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="color"
                      value={form.footerBg}
                      style={{ width: '40px', height: '36px', padding: 0, border: 'none', borderRadius: '6px', cursor: 'pointer', background: 'transparent' }}
                      onChange={(e) => setForm((p) => ({ ...p, footerBg: e.target.value }))}
                    />
                    <input
                      type="text"
                      value={form.footerBg}
                      onChange={(e) => setForm((p) => ({ ...p, footerBg: e.target.value }))}
                    />
                  </div>
                </label>
              </div>

              <label className={styles.field}>
                <span>Accent Color</span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="color"
                    value={form.accentColor}
                    style={{ width: '40px', height: '36px', padding: 0, border: 'none', borderRadius: '6px', cursor: 'pointer', background: 'transparent' }}
                    onChange={(e) => setForm((p) => ({ ...p, accentColor: e.target.value }))}
                  />
                  <input
                    type="text"
                    value={form.accentColor}
                    onChange={(e) => setForm((p) => ({ ...p, accentColor: e.target.value }))}
                  />
                </div>
              </label>

              <label className={styles.field}>
                <span>Description (Optional)</span>
                <input
                  type="text"
                  placeholder="e.g. Modern and calming teal tone"
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                />
              </label>

              {editingTheme && (
                <label className={styles.field} style={{ flexDirection: 'row', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '8px' }}>
                  <label className={styles.switch}>
                    <input 
                      type="checkbox" 
                      checked={form.enabled} 
                      onChange={e => setForm(p => ({ ...p, enabled: e.target.checked }))}
                    />
                    <span className={styles.slider}></span>
                  </label>
                  <span style={{ marginBottom: 0 }}>Active? (Uncheck to remove from form)</span>
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
