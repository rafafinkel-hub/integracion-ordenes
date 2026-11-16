// Lógica pura: parsear CSV, validar filas y armar el TXT. Sin red ni archivos.

const COLUMNAS = ['Empresa', 'nro', 'desc', 'cantidad', 'precio unitario', 'total'];
const COL_ESTADO = 'Estado tango';

// Parser CSV mínimo (comillas dobles, comas y saltos de línea dentro de comillas).
function parsearCSV(texto) {
  const filas = [];
  let fila = [], campo = '', entreComillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (entreComillas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') entreComillas = false;
      else campo += c;
    } else if (c === '"') entreComillas = true;
    else if (c === ',') { fila.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      fila.push(campo); filas.push(fila); fila = []; campo = '';
    } else campo += c;
  }
  if (campo !== '' || fila.length) { fila.push(campo); filas.push(fila); }
  return filas;
}

// Devuelve [{ fila (nº en la hoja), datos, estado }]. estado: 'procesada' | 'rechazada: motivo' | 'omitida'
function procesar(filasCSV) {
  if (!filasCSV.length) throw new Error('La hoja está vacía');
  const encabezado = filasCSV[0].map(h => h.trim());
  const idx = {};
  for (const col of [...COLUMNAS, COL_ESTADO]) {
    idx[col] = encabezado.indexOf(col);
    if (idx[col] === -1) throw new Error(`Falta la columna "${col}" en la hoja`);
  }
  const resultados = [];
  filasCSV.slice(1).forEach((f, i) => {
    const datos = Object.fromEntries(COLUMNAS.map(c => [c, (f[idx[c]] ?? '').trim()]));
    if (f.every(x => x.trim() === '')) return; // fila totalmente vacía
    const estadoPrevio = (f[idx[COL_ESTADO]] ?? '').trim();
    const nFila = i + 2;
    if (estadoPrevio) { resultados.push({ fila: nFila, datos, estado: 'omitida' }); return; }
    const faltan = COLUMNAS.filter(c => datos[c] === '');
    resultados.push({
      fila: nFila,
      datos,
      estado: faltan.length ? `rechazada: falta ${faltan.join(', ')}` : 'procesada',
    });
  });
  resultados.colEstado = idx[COL_ESTADO]; // índice (0) de la columna "Estado tango"
  return resultados;
}

function celda(v) {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function armarTXT(resultados) {
  const lineas = [COLUMNAS.join(',')];
  for (const r of resultados) {
    if (r.estado === 'procesada') lineas.push(COLUMNAS.map(c => celda(r.datos[c])).join(','));
  }
  return lineas.join('\n') + '\n';
}

module.exports = { COLUMNAS, COL_ESTADO, parsearCSV, procesar, armarTXT };
