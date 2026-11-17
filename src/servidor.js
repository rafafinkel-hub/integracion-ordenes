#!/usr/bin/env node
// Página con un botón "Importar órdenes a Tango" y el listado del resultado.
// Uso: node src/servidor.js   (PORT=3000 por defecto; HOST=127.0.0.1 por defecto)
const http = require('http');
const fs = require('fs');
const path = require('path');
const { importar } = require('./importar');
const { claveValida } = require('./acceso');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const PAGINA = path.join(__dirname, '..', 'public', 'index.html');
let corriendo = false; // evita dos importaciones a la vez (doble clic)

function json(res, codigo, obj) {
  res.writeHead(codigo, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

const servidor = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://x');
  if (req.method === 'GET' && pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(fs.readFileSync(PAGINA));
  }
  if (req.method === 'POST' && pathname === '/api/importar') {
    if (!process.env.CLAVE_ACCESO) return json(res, 500, { error: 'Falta configurar CLAVE_ACCESO' });
    if (!claveValida(req.headers['x-clave'])) return json(res, 401, { error: 'Clave incorrecta' });
    if (corriendo) return json(res, 409, { error: 'Ya hay una importación en curso' });
    corriendo = true;
    try { json(res, 200, await importar()); }
    catch (e) { json(res, 500, { error: e.message }); }
    finally { corriendo = false; }
    return;
  }
  json(res, 404, { error: 'No encontrado' });
});

if (require.main === module) {
  servidor.listen(PORT, HOST, () => console.log(`Página en http://${HOST}:${PORT}`));
}
module.exports = { servidor };
