import { useState, useEffect, useMemo } from 'react';
import { apiRequest } from '../lib/apiClient';
import styles from './AdminPortal.module.css';

function getItemId(item) {
  return item?.id || item?._id || '';
}

function formatLabel(key) {
  if (key === 'empid') return 'Employee ID';
  if (key === 'contactnumber') return 'Contact Number';
  if (key === 'createdAt') return 'Created';
  return key.charAt(0).toUpperCase() + key.slice(1);
}

export default function AdminPortal() {
  const [isLoggedIn, setIsLoggedIn] = useState(
    () => localStorage.getItem('admin_session') === 'true'
  );
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const [activeTab, setActiveTab] = useState('doctors');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await apiRequest('/admin/login', {
        method: 'POST',
        body: { username, password },
      });
      if (res.success) {
        setIsLoggedIn(true);
        localStorage.setItem('admin_session', 'true');
      }
    } catch (err) {
      setLoginError(err.message || 'Login failed');
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    localStorage.removeItem('admin_session');
  };

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await apiRequest(`/admin/collections/${activeTab}`);
      setItems(Array.isArray(res) ? res : []);
    } catch (err) {
      alert('Error fetching items: ' + err.message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      setSearch('');
      fetchItems();
    }
  }, [isLoggedIn, activeTab]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this record? This cannot be undone.')) return;
    try {
      await apiRequest(`/admin/collections/${activeTab}/${id}`, { method: 'DELETE' });
      fetchItems();
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  };

  const openModal = (item = null) => {
    setEditingItem(item);
    if (item) {
      setFormData({ ...item });
    } else if (activeTab === 'doctors') {
      setFormData({ name: '', contactnumber: '', logo: '', poster: '' });
    } else {
      setFormData({ empid: '' });
    }
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const id = getItemId(editingItem);
      if (editingItem && id) {
        await apiRequest(`/admin/collections/${activeTab}/${id}`, {
          method: 'PUT',
          body: formData,
        });
      } else {
        await apiRequest(`/admin/collections/${activeTab}`, {
          method: 'POST',
          body: formData,
        });
      }
      setShowModal(false);
      fetchItems();
    } catch (err) {
      alert('Save failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleFieldChange = (key, val) => {
    setFormData((prev) => ({ ...prev, [key]: val }));
  };

  const handleFileChange = (key, file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setFormData((prev) => ({ ...prev, [key]: e.target.result }));
    };
    reader.readAsDataURL(file);
  };

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      const haystack = [
        getItemId(item),
        item.name,
        item.contactnumber,
        item.empid,
        item.id,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [items, search]);

  const formFields =
    activeTab === 'doctors'
      ? ['name', 'contactnumber', 'logo', 'poster']
      : ['empid'];

  if (!isLoggedIn) {
    return (
      <div className={styles.loginPage}>
        <form onSubmit={handleLogin} className={styles.loginCard}>
          <div className={styles.loginBrand}>
            <div className={styles.brandMark}>M</div>
            <div>
              <div className={styles.brandName}>MedPortal</div>
              <div className={styles.brandSub}>Admin access</div>
            </div>
          </div>
          <h1 className={styles.loginTitle}>Sign in</h1>
          <p className={styles.loginHint}>Manage doctors and employee users.</p>
          {loginError && <p className={styles.error}>{loginError}</p>}
          <label className={styles.field}>
            <span>Username</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label className={styles.field}>
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <button type="submit" className={styles.primaryBtn}>
            Login
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarTop}>
          <div className={styles.brandMark}>M</div>
          <div>
            <div className={styles.brandName}>MedPortal</div>
            <div className={styles.brandSub}>Admin</div>
          </div>
        </div>

        <nav className={styles.nav}>
          <p className={styles.navLabel}>Collections</p>
          <button
            type="button"
            className={`${styles.navItem} ${activeTab === 'doctors' ? styles.navActive : ''}`}
            onClick={() => setActiveTab('doctors')}
          >
            <span className={styles.navIcon}>D</span>
            Doctors
          </button>
          <button
            type="button"
            className={`${styles.navItem} ${activeTab === 'users' ? styles.navActive : ''}`}
            onClick={() => setActiveTab('users')}
          >
            <span className={styles.navIcon}>U</span>
            Users
          </button>
        </nav>

        <button type="button" className={styles.sidebarLogout} onClick={handleLogout}>
          Log out
        </button>
      </aside>

      <div className={styles.main}>
        <header className={styles.topbar}>
          <div>
            <p className={styles.breadcrumb}>Admin / {activeTab === 'doctors' ? 'Doctors' : 'Users'}</p>
            <h1 className={styles.pageTitle}>
              {activeTab === 'doctors' ? 'Doctors list' : 'Users list'}
            </h1>
          </div>
          <div className={styles.topbarRight}>
            <span className={styles.adminBadge}>Administrator</span>
          </div>
        </header>

        <section className={styles.panel}>
          <div className={styles.toolbar}>
            <div className={styles.searchWrap}>
              <span className={styles.searchIcon} aria-hidden>
                ⌕
              </span>
              <input
                className={styles.searchInput}
                type="search"
                placeholder={
                  activeTab === 'doctors'
                    ? 'Search by name, contact, or ID…'
                    : 'Search by employee ID…'
                }
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button type="button" className={styles.primaryBtn} onClick={() => openModal()}>
              + Add {activeTab === 'doctors' ? 'doctor' : 'user'}
            </button>
          </div>

          <div className={styles.tableCard}>
            {loading ? (
              <div className={styles.emptyState}>Loading…</div>
            ) : filteredItems.length === 0 ? (
              <div className={styles.emptyState}>
                {items.length === 0 ? 'No records yet.' : 'No matches for your search.'}
              </div>
            ) : activeTab === 'doctors' ? (
              <div className={styles.tableScroll}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Name</th>
                      <th>Contact Number</th>
                      <th>Logo</th>
                      <th>Poster</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((item) => {
                      const id = getItemId(item);
                      return (
                        <tr key={id}>
                          <td>
                            <code className={styles.idCell} title={String(id)}>
                              {String(id)}
                            </code>
                          </td>
                          <td className={styles.nameCell}>{item.name || '—'}</td>
                          <td>{item.contactnumber || '—'}</td>
                          <td>
                            {item.logo ? (
                              <img src={item.logo} alt="" className={styles.logoThumb} />
                            ) : (
                              <span className={styles.muted}>—</span>
                            )}
                          </td>
                          <td>
                            {item.poster ? (
                              <img src={item.poster} alt="" className={styles.posterThumb} />
                            ) : (
                              <span className={styles.muted}>null</span>
                            )}
                          </td>
                          <td>
                            <div className={styles.actions}>
                              <button
                                type="button"
                                className={styles.editBtn}
                                onClick={() => openModal(item)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className={styles.deleteBtn}
                                onClick={() => handleDelete(id)}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className={styles.tableScroll}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Employee ID</th>
                      <th>Name</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((item) => {
                      const id = getItemId(item);
                      return (
                        <tr key={id}>
                          <td>
                            <code className={styles.idCell} title={String(id)}>
                              {String(id)}
                            </code>
                          </td>
                          <td className={styles.nameCell}>
                            {item.empid ?? item.id ?? '—'}
                          </td>
                          <td>{item.name || '—'}</td>
                          <td>
                            <div className={styles.actions}>
                              <button
                                type="button"
                                className={styles.editBtn}
                                onClick={() => openModal(item)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className={styles.deleteBtn}
                                onClick={() => handleDelete(id)}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className={styles.tableFooter}>
              Showing {filteredItems.length} of {items.length}{' '}
              {activeTab === 'doctors' ? 'doctors' : 'users'}
            </div>
          </div>
        </section>
      </div>

      {showModal && (
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className={styles.modalTitle}>
              {editingItem
                ? `Edit ${activeTab === 'doctors' ? 'doctor' : 'user'}`
                : `Add ${activeTab === 'doctors' ? 'doctor' : 'user'}`}
            </h2>
            <form onSubmit={handleSave} className={styles.form}>
              {formFields.map((f) => (
                <label key={f} className={styles.field}>
                  <span>{formatLabel(f)}</span>
                  {f === 'logo' || f === 'poster' ? (
                    <div className={styles.fileBlock}>
                      {formData[f] ? (
                        <img
                          src={formData[f]}
                          alt=""
                          className={f === 'logo' ? styles.formLogo : styles.formPoster}
                        />
                      ) : (
                        <span className={styles.muted}>No image</span>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileChange(f, e.target.files?.[0])}
                      />
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={formData[f] ?? ''}
                      onChange={(e) => handleFieldChange(f, e.target.value)}
                      required={f !== 'logo' && f !== 'poster'}
                    />
                  )}
                </label>
              ))}
              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => setShowModal(false)}
                >
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
