import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../lib/apiClient';
import StudioShell from '../components/StudioShell';
import styles from './ExistingDoctorsPage.module.css';

export default function ExistingDoctorsPage({ user, onLogout, onBack, onSelectDoctor }) {
  const [doctors, setDoctors] = useState([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set('includeInactive', 'true');
        if (query.trim()) params.set('q', query.trim());
        if (user?._id) params.set('userId', user._id);
        const res = await apiRequest(`/doctors?${params.toString()}`);
        if (!active) return;
        setDoctors(res.doctors || []);
        setTotal(res.total ?? res.count ?? 0);
      } catch (err) {
        if (!active) return;
        setError(err.message || 'Failed to load doctors');
        setDoctors([]);
      } finally {
        if (active) setLoading(false);
      }
    };

    const timer = setTimeout(load, query ? 250 : 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, user?._id]);

  const shownLabel = useMemo(() => {
    if (query.trim()) return `${doctors.length} match${doctors.length === 1 ? '' : 'es'}`;
    return `${total} total`;
  }, [doctors.length, query, total]);

  return (
    <StudioShell
      userLabel={user ? `Employee ${user.empid || (user.id && String(user.id).length < 24 ? user.id : '')}`.trim() : 'Employee'}
      onLogout={onLogout}
      onBrandClick={onBack}
      headerActions={
        onBack ? (
          <button type="button" className={styles.headerAction} onClick={onBack}>
            Home
          </button>
        ) : null
      }
    >
      <div className={styles.hero}>
        <button type="button" className={styles.backLink} onClick={onBack}>
          ← Back
        </button>
        <h1 className={styles.title}>Select a doctor</h1>
        <p className={styles.meta}>
          Total doctors: <strong>{total}</strong>
          <span aria-hidden="true"> · </span>
          {shownLabel}
        </p>
      </div>

      <div className={styles.panel}>
        <label className={styles.searchLabel} htmlFor="doctor-search">
          Find a doctor
        </label>
        <input
          id="doctor-search"
          className={styles.searchInput}
          type="search"
          placeholder="Search by name"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        {loading && <p className={styles.status}>Loading doctors…</p>}
        {error && <p className={styles.error}>{error}</p>}

        {!loading && !error && doctors.length === 0 && (
          <p className={styles.status}>No doctors found.</p>
        )}

        <div className={styles.list}>
          {doctors.map((doc) => (
            <button
              key={doc.id}
              type="button"
              className={styles.row}
              onClick={() => onSelectDoctor(doc)}
            >
              <div className={styles.avatar}>
                {doc.logo ? (
                  <img src={doc.logo} alt="" />
                ) : (
                  <span>{(doc.name || 'D').slice(0, 1)}</span>
                )}
              </div>
              <div className={styles.rowBody}>
                <h3 className={styles.rowName}>
                  {doc.name}
                  {doc.active === false && (
                    <span className={styles.inactiveTag}>Inactive</span>
                  )}
                </h3>
                <p className={styles.rowMeta}>
                  {doc.clinicName || 'Clinic'}
                  <span aria-hidden="true"> · </span>
                  {doc.contactnumber || '—'}
                </p>
              </div>
              <div className={styles.rowStats}>
                <span>{doc.postersMade || 0} posters</span>
                <span>{doc.downloadCount || 0} downloads</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </StudioShell>
  );
}
