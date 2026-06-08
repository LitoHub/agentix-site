/* Servidor local SOLO para desarrollo/pruebas (no se usa en producción).
   Sirve los archivos estáticos y enruta /api/* a las Netlify Functions en
   modo demo (sin Google). Producción: Netlify (ver netlify.toml + SETUP).

   Uso:  node dev-server.js   →   http://localhost:8770
*/
var http = require('http');
var fs = require('fs');
var path = require('path');

var ROOT = __dirname;
var PORT = process.env.PORT || 8770;

/* Carga apps/web/.env (si existe) para probar modo REAL en local
   (Google / Supabase / Gmail). El archivo está gitignored. */
(function loadDotenv() {
  try {
    var txt = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
    txt.split('\n').forEach(function (line) {
      var m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) return;
      var key = m[1], val = m[2];
      // quita comillas envolventes si las hay
      if (/^".*"$/.test(val) || /^'.*'$/.test(val)) val = val.slice(1, -1);
      if (process.env[key] === undefined) process.env[key] = val;
    });
    console.log('[.env] cargado para modo real');
  } catch (e) { /* sin .env → modo demo */ }
})();

var availability = require('./netlify/functions/availability');
var book = require('./netlify/functions/book');

var MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json'
};

function sendFunctionResult(res, result) {
  res.writeHead(result.statusCode, result.headers || { 'Content-Type': 'application/json' });
  res.end(result.body || '');
}

var server = http.createServer(function (req, res) {
  var u = new URL(req.url, 'http://localhost');
  var pathname = u.pathname;

  // --- API ---
  if (pathname === '/api/availability') {
    Promise.resolve(availability.handler({ httpMethod: req.method }))
      .then(function (r) { sendFunctionResult(res, r); })
      .catch(function (e) { res.writeHead(500); res.end(String(e)); });
    return;
  }
  if (pathname === '/api/book') {
    var chunks = [];
    req.on('data', function (c) { chunks.push(c); });
    req.on('end', function () {
      Promise.resolve(book.handler({ httpMethod: req.method, body: Buffer.concat(chunks).toString('utf8') }))
        .then(function (r) { sendFunctionResult(res, r); })
        .catch(function (e) { res.writeHead(500); res.end(String(e)); });
    });
    return;
  }

  // --- estáticos ---
  var rel = pathname === '/' ? '/index.html' : pathname;
  var file = path.join(ROOT, decodeURIComponent(rel));
  if (file.indexOf(ROOT) !== 0) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(file, function (err, data) {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    // no-store en dev: evita que el navegador sirva CSS/JS viejos al iterar.
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store, must-revalidate'
    });
    res.end(data);
  });
});

server.listen(PORT, function () {
  console.log('Dev server (modo demo) → http://localhost:' + PORT);
});
