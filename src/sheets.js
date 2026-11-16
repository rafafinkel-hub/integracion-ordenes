// Escritura de "Estado tango" en la hoja con una cuenta de servicio de Google.
// Sin dependencias: el JWT se firma con crypto de Node.
const crypto = require('crypto');

const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API = 'https://sheets.googleapis.com/v4/spreadsheets';

const b64url = x => Buffer.from(x).toString('base64url');

function armarJWT(cred, ahora = Math.floor(Date.now() / 1000)) {
  const cuerpo = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' })) + '.' + b64url(JSON.stringify({
    iss: cred.client_email, scope: SCOPE, aud: TOKEN_URL, iat: ahora, exp: ahora + 3600,
  }));
  const firma = crypto.createSign('RSA-SHA256').update(cuerpo).sign(cred.private_key).toString('base64url');
  return `${cuerpo}.${firma}`;
}

// 0 -> A, 25 -> Z, 26 -> AA
function letraColumna(i) {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

// Rangos A1 a escribir: solo filas procesadas o rechazadas (las omitidas ya tienen estado).
function armarActualizaciones(resultados, titulo, colEstado) {
  const letra = letraColumna(colEstado);
  const q = `'${titulo.replace(/'/g, "''")}'`;
  return resultados
    .filter(r => r.estado !== 'omitida')
    .map(r => ({ range: `${q}!${letra}${r.fila}`, values: [[r.estado]] }));
}

async function pedir(url, opts, f) {
  const res = await f(url, opts);
  const texto = await res.text();
  if (!res.ok) throw new Error(`Google respondió HTTP ${res.status}: ${texto.slice(0, 300)}`);
  return JSON.parse(texto);
}

async function escribirEstados({ cred, sheetId, gid = 0, colEstado, resultados, fetchFn = fetch }) {
  const tok = await pedir(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: armarJWT(cred) }),
  }, fetchFn);
  const auth = { Authorization: `Bearer ${tok.access_token}` };

  const meta = await pedir(`${API}/${sheetId}?fields=sheets.properties(sheetId,title)`, { headers: auth }, fetchFn);
  const hoja = meta.sheets.find(s => s.properties.sheetId === gid);
  if (!hoja) throw new Error(`No se encontró la pestaña con gid=${gid}`);

  const data = armarActualizaciones(resultados, hoja.properties.title, colEstado);
  if (!data.length) return 0;
  await pedir(`${API}/${sheetId}/values:batchUpdate`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ valueInputOption: 'RAW', data }),
  }, fetchFn);
  return data.length;
}

module.exports = { armarJWT, letraColumna, armarActualizaciones, escribirEstados };
