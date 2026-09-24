import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../lib/apiClient';
import StudioShell from '../components/StudioShell';
import styles from './ExistingDoctorsPage.module.css';

export default function ExistingDoctorsPage({ user, onLogout, onBack, onSelectDoctor }) {
  const [doctors, setDoctors] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalFiltered, setTotalFiltered] = useState(0);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadDoctors = async (search, currentPage) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('includeInactive', 'true');
      params.set('page', currentPage);
      params.set('limit', 5);
      if (search.trim()) params.set('q', search.trim());
      const res = await apiRequest(`/doctors?${params.toString()}`);
      setDoctors(res.doctors || []);
      setTotal(res.total ?? res.count ?? (res.doctors || []).length);
      setTotalFiltered(res.totalFiltered ?? res.total ?? 0);
      setTotalPages(res.totalPages ?? 1);
    } catch (err) {
      setError(err.message || 'Failed to load doctors');
      setDoctors([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (active) loadDoctors(query, page);
    }, query ? 250 : 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, page]);

  const handleRemove = async (event, doc) => {
    event.preventDefault();
    event.stopPropagation();
    if (!window.confirm(`Permanently remove ${doc.name || 'this doctor'} and all posters?`)) {
      return;
    }
    try {
      await apiRequest(`/doctors/${doc.id}`, { method: 'DELETE' });
      setDoctors((prev) => prev.filter((item) => item.id !== doc.id));
      setTotal((prev) => Math.max(0, prev - 1));
    } catch (err) {
      setError(err.message || 'Delete failed');
    }
  };

  const shownLabel = useMemo(() => {
    if (query.trim()) return `${totalFiltered} match${totalFiltered === 1 ? '' : 'es'}`;
    return `${total} total`;
  }, [query, total, totalFiltered]);

  return (
    <StudioShell
      user={user}
      onLogout={onLogout}
      onBrandClick={onBack}
      onBack={onBack}
      backLabel="Home"
    >
      <div className={styles.hero}>
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
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
        />

        {loading && <p className={styles.status}>Loading doctors…</p>}
        {error && <p className={styles.error}>{error}</p>}

        {!loading && !error && doctors.length === 0 && (
          <p className={styles.status}>No doctors found.</p>
        )}

        <div className={styles.list}>
          {doctors.map((doc) => (
            <div key={doc.id} className={styles.row}>
              <button
                type="button"
                className={styles.rowMain}
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
              <button
                type="button"
                className={styles.removeBtn}
                onClick={(event) => handleRemove(event, doc)}
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        {totalPages > 0 && (
          <div className={styles.pagination}>
            <button
              className={styles.pageBtn}
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </button>
            <span className={styles.pageInfo}>
              Page {page} of {totalPages}
            </span>
            <button
              className={styles.pageBtn}
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </StudioShell>
  );
}
