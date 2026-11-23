# Poster Creator

React/Vite frontend and Express/SQLite backend. Node.js 22.13+ required.

## AWS deployment

The public URL is `https://doctorly.in/Poster-Creater/`. Node serves the built
`dist` directory, API and uploads on port **4017**. Do not run Vite preview in production.

Clone the repository into the `Poster-Creater` directory inside the Apache document
root for doctorly.in (the directory name and URL are case-sensitive):

```bash
git clone https://github.com/NK102006/Poster-creation-project.git Poster-Creater
cd Poster-Creater
cp .env.example .env
# Edit .env and set SESSION_SECRET to a long random value.
npm ci
npm ci --prefix server
npm run build
npm start
```

Keep `npm start` running using your server's process manager (systemd or PM2), with
the working directory set to this clone. Restart after changing runtime env values.
Rebuild after changing APP_BASE_PATH or any VITE_* value. Both root `npm start` and
`cd server && npm start` load the root .env; server/.env is an optional fallback.

The included root `.htaccess` disables directory listings and proxies requests to
Node. Apache must enable `rewrite`, `proxy`, `proxy_http`, and `headers`, and allow
`AllowOverride All` for this clone directory. On Ubuntu/Debian:

```bash
sudo a2enmod rewrite proxy proxy_http headers
sudo systemctl reload apache2
```

If the clone lives outside the document root, configure an Apache Alias for
`/Poster-Creater/` pointing to the clone, with the matching Directory block and
`AllowOverride All`. If the domain has a front controller (such as WordPress),
exclude `/Poster-Creater/` from its rewrite rules. These host settings require
server configuration; .htaccess cannot enable modules or create an Alias.

Alternatively, in the existing HTTPS VirtualHost, use the following instead of
.htaccess (keep the existing SSL settings):

```apache
RequestHeader set X-Forwarded-Proto "https"
ProxyPass /Poster-Creater/ http://127.0.0.1:4017/Poster-Creater/
ProxyPassReverse /Poster-Creater/ http://127.0.0.1:4017/Poster-Creater/
RedirectMatch 301 ^/Poster-Creater$ /Poster-Creater/
```

Verify `curl http://127.0.0.1:4017/Poster-Creater/api/health` on the instance,
then open the public URL. Staff pages include `/Poster-Creater/admin`,
`/Poster-Creater/superadmin`, and `/Poster-Creater/userpanel`.
The default HOST keeps port 4017 private behind Apache. To access Node directly
from another machine, set HOST=0.0.0.0 and configure the instance security group;
COOKIE_SECURE must be false when testing over plain HTTP.

For updates, run `git pull`, both `npm ci` commands, `npm run build`, then restart
Node. The database in `server/data/` and uploaded files in `uploads/` are ignored
by Git and persist across builds. Back them up separately.

## Local development

```bash
npm ci
npm ci --prefix server
cp .env.example .env
# Set COOKIE_SECURE=false and NODE_ENV=development for local HTTP.
npm start
# In another terminal:
npm run dev
```

Open the Vite URL with `/Poster-Creater/`. Vite proxies API and upload requests
to Node on port 4017. To serve at the domain root instead, set APP_BASE_PATH=/
and rebuild; update Apache's URL mapping accordingly.

## Login immediately returns to the sign-in page

Deploy the updated .htaccess (including X-Forwarded-Proto), enable Apache's
headers module, reload Apache, and restart Node with the same SESSION_SECRET
in every worker. COOKIE_SECURE=auto supports local HTTP and HTTPS behind Apache;
COOKIE_SECURE=true requires the forwarded HTTPS scheme. If using the VirtualHost
proxy example instead of .htaccess, include its RequestHeader directive inside
the HTTPS VirtualHost. If TLS terminates at a load balancer, configure Apache to
forward the trusted load balancer's original scheme instead of its local scheme.

Sessions now persist in the app_sessions table in the same SQLite database.
Existing in-memory logins require one fresh login after this update.

The startup log prints the exact database path. Relative SQLITE_PATH values are
resolved from the project root, regardless of whether Node starts from root or
server/. The OS user running Node needs write permission on both the database
and its containing directory (SQLite creates WAL/SHM files there). An empty
new AWS database does not contain local admins or doctors: migrate your existing
SQLite database separately while Node is stopped. Do not make database files
publicly accessible. No separate database service is required.
