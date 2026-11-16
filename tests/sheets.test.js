const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const { parsearCSV, procesar } = require('../src/procesar');
const { armarJWT, letraColumna, armarActualizaciones, escribirEstados } = require('../src/sheets');

const H = 'Empresa,nro,desc,cantidad,precio unitario,total,Estado tango\n';
const CSV = H + 'E1,1,a,1,1,1,\nE1,2,,1,1,1,\nE1,3,c,1,1,1,procesada\n\n';

test('letraColumna', () => {
  assert.deepStrictEqual([0, 6, 25, 26, 27].map(letraColumna), ['A', 'G', 'Z', 'AA', 'AB']);
});

test('procesar informa el índice de "Estado tango"', () => {
  assert.strictEqual(procesar(parsearCSV(CSV)).colEstado, 6);
});

test('solo se escriben filas procesadas y rechazadas', () => {
  const r = procesar(parsearCSV(CSV));
  assert.deepStrictEqual(armarActualizaciones(r, "Hoja d'1", r.colEstado), [
    { range: "'Hoja d''1'!G2", values: [['procesada']] },
    { range: "'Hoja d''1'!G3", values: [['rechazada: falta desc']] },
  ]);
});

test('JWT firmado con RS256 y verificable', () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' });
  const jwt = armarJWT({ client_email: 'sa@x.iam', private_key: pem }, 1000);
  const [h, c, f] = jwt.split('.');
  assert.strictEqual(JSON.parse(Buffer.from(c, 'base64url')).exp, 4600);
  assert.ok(crypto.createVerify('RSA-SHA256').update(`${h}.${c}`).verify(publicKey, f, 'base64url'));
});

test('escribirEstados llama a token, metadatos y batchUpdate', async () => {
  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const cred = { client_email: 'sa@x.iam', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) };
  const llamadas = [];
  const fetchFn = async (url, opts = {}) => {
    llamadas.push({ url, opts });
    const cuerpo = url.includes('oauth2') ? { access_token: 'tok' }
      : url.includes('fields=') ? { sheets: [{ properties: { sheetId: 0, title: 'Hoja 1' } }] } : {};
    return { ok: true, status: 200, text: async () => JSON.stringify(cuerpo) };
  };
  const r = procesar(parsearCSV(CSV));
  const n = await escribirEstados({ cred, sheetId: 'ID', colEstado: r.colEstado, resultados: r, fetchFn });
  assert.strictEqual(n, 2);
  assert.strictEqual(llamadas.length, 3);
  assert.strictEqual(llamadas[2].opts.headers.Authorization, 'Bearer tok');
  assert.strictEqual(JSON.parse(llamadas[2].opts.body).data[0].range, "'Hoja 1'!G2");
});
