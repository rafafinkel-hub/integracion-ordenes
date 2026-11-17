const test = require('node:test');
const assert = require('node:assert');
const { claveValida } = require('../src/acceso');
const { handler } = require('../netlify/functions/importar');

test('claveValida exige clave configurada y coincidente', () => {
  assert.strictEqual(claveValida('abc', 'abc'), true);
  assert.strictEqual(claveValida('abd', 'abc'), false);
  assert.strictEqual(claveValida(undefined, 'abc'), false);
  assert.strictEqual(claveValida('', ''), false);
  assert.strictEqual(claveValida('x', undefined), false);
});

test('la función rechaza sin clave configurada, con clave mala y con GET', async () => {
  delete process.env.CLAVE_ACCESO;
  assert.strictEqual((await handler({ httpMethod: 'POST', headers: {} })).statusCode, 500);
  process.env.CLAVE_ACCESO = 'secreta';
  assert.strictEqual((await handler({ httpMethod: 'POST', headers: { 'x-clave': 'mala' } })).statusCode, 401);
  assert.strictEqual((await handler({ httpMethod: 'GET', headers: {} })).statusCode, 405);
});
