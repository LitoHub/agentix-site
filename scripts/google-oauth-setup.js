/* Obtiene el GOOGLE_OAUTH_REFRESH_TOKEN una sola vez (flujo de app instalada).
   Requisitos en apps/web/.env: GOOGLE_OAUTH_CLIENT_ID y GOOGLE_OAUTH_CLIENT_SECRET
   (de un OAuth Client tipo "Desktop app").

   Uso:  cd apps/web && node scripts/google-oauth-setup.js
   1) imprime una URL → ábrela y autoriza con admin@parallelo.com.co
   2) Google redirige a http://localhost:5599 → el script captura el código
   3) escribe GOOGLE_OAUTH_REFRESH_TOKEN (y GOOGLE_CALENDAR_ID=primary) en .env */

var http = require('http');
var fs = require('fs');
var path = require('path');

var ROOT = path.resolve(__dirname, '..');
var ENV_PATH = path.join(ROOT, '.env');
var PORT = 5599;
var REDIRECT = 'http://localhost:' + PORT + '/oauth2callback';

function parseEnv(txt) {
  var o = {};
  txt.split('\n').forEach(function (line) {
    var m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) return;
    var v = m[2];
    if (/^".*"$/.test(v) || /^'.*'$/.test(v)) v = v.slice(1, -1);
    o[m[1]] = v;
  });
  return o;
}

function setEnvVar(txt, key, val) {
  var re = new RegExp('^' + key + '=.*$', 'm');
  if (re.test(txt)) return txt.replace(re, key + '=' + val);
  return txt.replace(/\s*$/, '') + '\n' + key + '=' + val + '\n';
}

var envText = '';
try { envText = fs.readFileSync(ENV_PATH, 'utf8'); } catch (e) {
  console.error('No encontré apps/web/.env'); process.exit(1);
}
var env = parseEnv(envText);
var CLIENT_ID = env.GOOGLE_OAUTH_CLIENT_ID;
var CLIENT_SECRET = env.GOOGLE_OAUTH_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Faltan GOOGLE_OAUTH_CLIENT_ID y/o GOOGLE_OAUTH_CLIENT_SECRET en apps/web/.env');
  process.exit(1);
}

var google = require('googleapis').google;
var oauth2 = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT);

var authUrl = oauth2.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent', // fuerza refresh_token
  scope: ['https://www.googleapis.com/auth/calendar']
});

console.log('\n=== Paso de autorización ===');
console.log('Abre esta URL en tu navegador y autoriza con admin@parallelo.com.co:\n');
console.log(authUrl + '\n');
console.log('(Esperando el redirect en ' + REDIRECT + ' ...)\n');

var server = http.createServer(function (req, res) {
  if (req.url.indexOf('/oauth2callback') !== 0) { res.writeHead(404); res.end(); return; }
  var u = new URL(req.url, 'http://localhost:' + PORT);
  var code = u.searchParams.get('code');
  var err = u.searchParams.get('error');
  if (err) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h2>Error: ' + err + '</h2>');
    console.error('Autorización rechazada:', err);
    server.close(); process.exit(1);
    return;
  }
  oauth2.getToken(code).then(function (r) {
    var tokens = r.tokens;
    if (!tokens.refresh_token) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h2>No llegó refresh_token. Revoca el acceso en myaccount.google.com/permissions y reintenta.</h2>');
      console.error('Sin refresh_token. Revoca en https://myaccount.google.com/permissions y corre de nuevo.');
      server.close(); process.exit(1);
      return;
    }
    var t = fs.readFileSync(ENV_PATH, 'utf8');
    t = setEnvVar(t, 'GOOGLE_OAUTH_REFRESH_TOKEN', tokens.refresh_token);
    if (!parseEnv(t).GOOGLE_CALENDAR_ID) t = setEnvVar(t, 'GOOGLE_CALENDAR_ID', 'primary');
    fs.writeFileSync(ENV_PATH, t);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<div style="font-family:sans-serif;padding:40px"><h2>✅ Listo. Ya puedes cerrar esta pestaña.</h2><p>Refresh token guardado en apps/web/.env</p></div>');
    console.log('\n✅ GOOGLE_OAUTH_REFRESH_TOKEN guardado en apps/web/.env');
    console.log('   GOOGLE_CALENDAR_ID =', parseEnv(t).GOOGLE_CALENDAR_ID);
    server.close(); process.exit(0);
  }).catch(function (e) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h2>Error intercambiando el código</h2>');
    console.error('Error:', e && (e.message || e));
    server.close(); process.exit(1);
  });
});

server.listen(PORT, function () { /* esperando */ });
