const test = require('node:test');
const assert = require('node:assert');
const { parsearCSV, procesar, armarTXT } = require('../src/procesar');

const H = 'Empresa,nro,desc,cantidad,precio unitario,total,Estado tango\n';

test('orden completa se procesa y sale en el TXT', () => {
  const r = procesar(parsearCSV(H + 'Empresa 1,1,vitamina,3,2,6,\n'));
  assert.strictEqual(r[0].estado, 'procesada');
  assert.strictEqual(armarTXT(r), 'Empresa,nro,desc,cantidad,precio unitario,total\nEmpresa 1,1,vitamina,3,2,6\n');
});

test('campo vacío rechaza la fila y la deja fuera del TXT', () => {
  const r = procesar(parsearCSV(H + 'Empresa 1,1,,3,,6,\n'));
  assert.strictEqual(r[0].estado, 'rechazada: falta desc, precio unitario');
  assert.strictEqual(armarTXT(r).trim().split('\n').length, 1);
});

test('fila con Estado tango ya cargado se omite', () => {
  const r = procesar(parsearCSV(H + 'E,1,a,1,1,1,procesada\n'));
  assert.strictEqual(r[0].estado, 'omitida');
  assert.ok(!armarTXT(r).includes('E,1'));
});

test('filas vacías se ignoran y el número de fila es el de la hoja', () => {
  const r = procesar(parsearCSV(H + ',,,,,,\nE,2,a,1,1,1,\n'));
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0].fila, 3);
});

test('descripción con coma se entrecomilla', () => {
  const r = procesar(parsearCSV(H + 'E,1,"a, b",1,1,1,\n'));
  assert.ok(armarTXT(r).includes('E,1,"a, b",1,1,1'));
});

test('falta una columna del encabezado', () => {
  assert.throws(() => procesar(parsearCSV('Empresa,nro\nx,1\n')), /Falta la columna/);
});
