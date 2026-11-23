import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = await mkdtemp(path.join(tmpdir(), 'poster-session-'));
const port = process.env.TEST_PORT || '14017';
const base = `http://127.0.0.1:${port}/Poster-Creater/api`;
let child;
async function start() {
  child = spawn(process.execPath, ['server.js'], {
    cwd: path.join(root, 'server'),
    env: { ...process.env, PORT: port, HOST: '127.0.0.1', APP_BASE_PATH: '/Poster-Creater',
      SQLITE_PATH: path.join(directory, 'test.db'), UPLOADS_DIR: path.join(directory, 'uploads'),
      SESSION_SECRET: 'deployment-test-secret', COOKIE_SECURE: 'true' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Server startup timed out')), 15000);
    child.stdout.on('data', data => {
      if (String(data).includes('Server is running')) { clearTimeout(timeout); resolve(); }
    });
    child.stderr.on('data', data => process.stderr.write(data));
    child.once('exit', code => { clearTimeout(timeout); reject(new Error(`Server exited: ${code}`)); });
  });
}
async function stop() {
  if (!child || child.exitCode !== null) return;
  await new Promise(resolve => { child.once('exit', resolve); child.kill('SIGTERM'); });
}
try {
  await start();
  const credentials = { username: 'superadmin', password: 'superadmin123' };
  const login = await fetch(`${base}/superadmin/login`, { method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-Proto': 'https' },
    body: JSON.stringify(credentials) });
  assert.equal(login.status, 200);
  const cookieHeader = login.headers.get('set-cookie');
  assert.ok(cookieHeader, 'HTTPS proxy login must issue a cookie');
  assert.match(cookieHeader, /; Secure/i);
  assert.match(cookieHeader, /Path=\/Poster-Creater/);
  const cookie = cookieHeader.split(';')[0];
  const headers = { Cookie: cookie, 'X-Forwarded-Proto': 'https', 'X-Auth-Role': 'superadmin', 'X-Auth-Id': 'superadmin', 'Content-Type': 'application/json' };
  assert.equal((await fetch(`${base}/superadmin/admins`)).status, 401);
  assert.equal((await fetch(`${base}/superadmin/admins`, { headers })).status, 200);
  const create = await fetch(`${base}/superadmin/admins`, { method: 'POST', headers,
    body: JSON.stringify({ username: 'deployment_check', password: 'Check12345!' }) });
  assert.equal(create.status, 201, await create.text());
  await stop();
  await start();
  const result = await fetch(`${base}/superadmin/admins`, { headers });
  assert.equal(result.status, 200, 'Session must survive Node restart');
  assert.ok((await result.json()).admins.some(admin => admin.username === 'deployment_check'), 'Database write must survive restart');
  const logout = await fetch(`${base}/logout`, { method: 'POST', headers, body: '{}' });
  assert.equal(logout.status, 200);
  assert.equal((await fetch(`${base}/superadmin/admins`, { headers })).status, 401);
  console.log('PASS: HTTPS cookie, protected database access, persisted session/data after restart, and logout.');
} finally {
  await stop();
  await rm(directory, { recursive: true, force: true });
}
