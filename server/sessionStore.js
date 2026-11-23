import session from 'express-session';

// Share sessions across Node workers and retain them through process restarts.
export class SQLiteSessionStore extends session.Store {
  constructor(db) {
    super();
    this.db = db;
    db.exec(`CREATE TABLE IF NOT EXISTS app_sessions (
      sid TEXT PRIMARY KEY, data TEXT NOT NULL, expires INTEGER NOT NULL
    ); CREATE INDEX IF NOT EXISTS app_sessions_expiry ON app_sessions(expires);`);
    this.cleanup = setInterval(() => {
      try { db.prepare('DELETE FROM app_sessions WHERE expires <= ?').run(Date.now()); }
      catch (error) { console.error('Session cleanup failed:', error); }
    }, 60 * 60 * 1000);
    this.cleanup.unref();
  }

  expiry(value) {
    return value.cookie?.expires ? new Date(value.cookie.expires).getTime() : Date.now() + 24 * 60 * 60 * 1000;
  }

  get(sid, callback) {
    try {
      const row = this.db.prepare('SELECT data FROM app_sessions WHERE sid = ? AND expires > ?').get(sid, Date.now());
      callback(null, row ? JSON.parse(row.data) : null);
    } catch (error) { callback(error); }
  }

  set(sid, value, callback = () => {}) {
    try {
      this.db.prepare(`INSERT INTO app_sessions (sid, data, expires) VALUES (?, ?, ?)
        ON CONFLICT(sid) DO UPDATE SET data = excluded.data, expires = excluded.expires`)
        .run(sid, JSON.stringify(value), this.expiry(value));
      callback(null);
    } catch (error) { callback(error); }
  }

  touch(sid, value, callback = () => {}) {
    try {
      this.db.prepare('UPDATE app_sessions SET expires = ? WHERE sid = ?').run(this.expiry(value), sid);
      callback(null);
    } catch (error) { callback(error); }
  }

  destroy(sid, callback = () => {}) {
    try {
      this.db.prepare('DELETE FROM app_sessions WHERE sid = ?').run(sid);
      callback(null);
    } catch (error) { callback(error); }
  }
}
