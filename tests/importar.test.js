const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { importar } = require('../src/importar');

const CSV = 'Empresa,nro,desc,cantidad,precio unitario,total,Estado tango\n' +
  'A,1,x,1,2,2,\nB,2,,1,2,2,\nC,3,z,1,2,2,procesada\n';

function fetchFalso(llamadas) {
  return async (url, opts = {}) => {
    llamadas.push({ url, body: opts.body });
    const r = (cuerpo, ok = true) => ({ ok, status: ok ? 200 : 500, text: async () => cuerpo });
    if (url.includes('/export?')) return r(CSV);
    if (url.includes('oauth2')) return r(JSON.stringify({ access_token: 't' }));
    if (url.includes('fields=')) return r(JSON.stringify({ sheets: [{ properties: { sheetId: 0, title: 'Hoja 1' } }] }));
    return r('{}');
  };
}

test('importar devuelve resumen y filas, y escribe solo las nuevas', async () => {
  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  process.env.GOOGLE_CREDENTIALS_JSON = JSON.stringify({
    client_email: 'x@y.iam', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  });
  const salida = fs.mkdtempSync(path.join(os.tmpdir(), 'ord-'));
  const llamadas = [];
  const r = await importar({ sheetId: 'ID', fetchFn: fetchFalso(llamadas), carpetaSalida: salida });
  assert.deepStrictEqual(r.resumen, { procesadas: 1, rechazadas: 1, omitidas: 1 });
  assert.strictEqual(r.escritas, 2);
  assert.deepStrictEqual(r.filas.map(f => f.estado), ['procesada', 'rechazada: falta desc', 'omitida']);
  assert.match(fs.readFileSync(path.join(salida, r.txt), 'utf8'), /^Empresa,.*\nA,1,x,1,2,2\n$/);
});
