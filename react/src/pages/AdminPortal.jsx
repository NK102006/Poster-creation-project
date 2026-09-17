import { useState, useEffect } from 'react';
import { apiRequest } from '../lib/apiClient';
import styles from './AdminPortal.module.css';

export default function AdminPortal() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem('admin_session') === 'true';
  });
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const [activeTab, setActiveTab] = useState('doctors');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({});

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await apiRequest('/admin/login', {
        method: 'POST',
        body: { username, password }
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
      setItems(res);
    } catch (err) {
      alert('Error fetching items: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      fetchItems();
    }
  }, [isLoggedIn, activeTab]);

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this?')) return;
    try {
      await apiRequest(`/admin/collections/${activeTab}/${id}`, { method: 'DELETE' });
      fetchItems();
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  };

  const openModal = (item = null) => {
    setEditingItem(item);
    setFormData(item || {});
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (editingItem && (editingItem.id || editingItem._id)) {
        await apiRequest(`/admin/collections/${activeTab}/${editingItem.id || editingItem._id}`, {
          method: 'PUT',
          body: formData
        });
      } else {
        await apiRequest(`/admin/collections/${activeTab}`, {
          method: 'POST',
          body: formData
        });
      }
      setShowModal(false);
      fetchItems();
    } catch (err) {
      alert('Save failed: ' + err.message);
    }
  };

  const handleFieldChange = (key, val) => {
    setFormData(prev => ({ ...prev, [key]: val }));
  };

  const handleFileChange = (key, file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setFormData(prev => ({ ...prev, [key]: e.target.result }));
    };
    reader.readAsDataURL(file);
  };

  const renderFormFields = () => {
    let fields = [];
    if (activeTab === 'doctors') fields = ['name', 'contactnumber', 'logo', 'poster'];
    if (activeTab === 'users') fields = ['empid'];

    return fields.map(f => (
      <div key={f} className={styles.formGroup}>
        <label>{f}</label>
        {f === 'logo' || f === 'poster' ? (
          <div>
            {formData[f] && <img src={formData[f]} alt={f} style={{ width: '50px', height: '50px', objectFit: 'cover', display: 'block', marginBottom: '8px', borderRadius: '4px' }} />}
            <input 
              type="file" 
              accept="image/*"
              onChange={e => handleFileChange(f, e.target.files[0])} 
            />
          </div>
        ) : (
          <input 
            type="text" 
            value={formData[f] || ''} 
            onChange={e => handleFieldChange(f, e.target.value)} 
            required={f !== 'logo' && f !== 'poster'}
          />
        )}
      </div>
    ));
  };

  const headers = items.length > 0 ? Object.keys(items[0]).filter(k => k !== '__v') : [];
  
  const chunkArray = (arr, size) => {
    const chunked = [];
    for (let i = 0; i < arr.length; i += size) {
      chunked.push(arr.slice(i, i + size));
    }
    return chunked;
  };
  
  const headerChunks = chunkArray(headers, 5);

  if (!isLoggedIn) {
    return (
      <div className={styles.loginContainer}>
        <form onSubmit={handleLogin} className={styles.loginForm}>
          <h2>Admin Login</h2>
          {loginError && <p className={styles.error}>{loginError}</p>}
          <input 
            type="text" 
            placeholder="Username" 
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <input 
            type="password" 
            placeholder="Password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit" className={styles.primaryBtn}>Login</button>
        </form>
      </div>
    );
  }

  return (
    <div className={styles.adminContainer}>
      <header className={styles.header}>
        <h1>Admin Dashboard</h1>
        <button onClick={handleLogout} className={styles.logoutBtn}>Logout</button>
      </header>

      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <ul>
            <li 
              className={activeTab === 'doctors' ? styles.active : ''} 
              onClick={() => setActiveTab('doctors')}
            >
              Doctors
            </li>
            <li 
              className={activeTab === 'users' ? styles.active : ''} 
              onClick={() => setActiveTab('users')}
            >
              Users
            </li>
          </ul>
        </aside>

        <main className={styles.content}>
          <div className={styles.toolbar}>
            <h2>{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Collection</h2>
            <button onClick={() => openModal()} className={styles.primaryBtn}>Add New</button>
          </div>

          {loading ? <p>Loading data...</p> : (
            <div>
              {items.length === 0 ? (
                <div className={styles.tableWrapper} style={{ padding: '20px', textAlign: 'center' }}>
                  No records found.
                </div>
              ) : (
                headerChunks.map((chunk, chunkIdx) => (
                  <div key={chunkIdx} className={styles.tableWrapper} style={{ marginBottom: '24px' }}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          {chunk.map(h => <th key={h}>{h}</th>)}
                          {chunkIdx === headerChunks.length - 1 && <th>Actions</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {items.map(item => (
                          <tr key={item.id || item._id}>
                            {chunk.map(h => (
                              <td key={h}>
                                {(h === 'logo' || h === 'poster') && item[h] ? (
                                  <img src={item[h]} alt={h} style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }} />
                                ) : typeof item[h] === 'object' ? (
                                  JSON.stringify(item[h])
                                ) : (
                                  String(item[h] || '').substring(0, 50)
                                )}
                              </td>
                            ))}
                            {chunkIdx === headerChunks.length - 1 && (
                              <td className={styles.actions}>
                                <button onClick={() => openModal(item)} className={styles.editBtn}>Edit</button>
                                <button onClick={() => handleDelete(item.id || item._id)} className={styles.deleteBtn}>Delete</button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))
              )}
            </div>
          )}
        </main>
      </div>

      {showModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3>{editingItem ? 'Edit Record' : 'Add New Record'}</h3>
            <form onSubmit={handleSave}>
              {renderFormFields()}
              <div className={styles.modalActions}>
                <button type="button" onClick={() => setShowModal(false)} className={styles.secondaryBtn}>Cancel</button>
                <button type="submit" className={styles.primaryBtn}>Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
