#!/usr/bin/env node
// Uso: node src/index.js [--archivo ruta.csv]
// Con --escribir-estados escribe "Estado tango" en la hoja (cuenta de servicio:
// GOOGLE_APPLICATION_CREDENTIALS=ruta/al/credenciales.json, o GOOGLE_CREDENTIALS_JSON con el contenido).
// Sin --archivo baja la hoja de Google Sheets (compartida por link).
const fs = require('fs');
const path = require('path');
const { escribirEstados } = require('./sheets');
const { parsearCSV, procesar, armarTXT } = require('./procesar');

// --hoja ID usa otra hoja (por ejemplo una copia de prueba)
const iHoja = process.argv.indexOf('--hoja');
const SHEET_ID = iHoja !== -1 ? process.argv[iHoja + 1] : '1JpJsLLxULTpywNy6FopjpHGWGavG1Ve0gfR7G_f5UHs';
const URL_CSV = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=0`;

// DD-MM-AAAA_HHMM para el nombre de archivo
function sello(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}_${p(d.getHours())}${p(d.getMinutes())}`;
}

async function leerCSV() {
  const i = process.argv.indexOf('--archivo');
  if (i !== -1) return fs.readFileSync(process.argv[i + 1], 'utf8');
  const res = await fetch(URL_CSV);
  if (!res.ok) throw new Error(`No se pudo bajar la hoja (HTTP ${res.status}). ¿Está compartida por link?`);
  return res.text();
}

(async () => {
  const resultados = procesar(parsearCSV(await leerCSV()));
  const salida = path.join(__dirname, '..', 'salida');
  fs.mkdirSync(salida, { recursive: true });
  const s = sello();

  const txt = path.join(salida, `ordenes_${s}.txt`);
  fs.writeFileSync(txt, armarTXT(resultados));

  // Estado tango por fila (todavía no se escribe en la hoja)
  const est = path.join(salida, `estado_tango_${s}.csv`);
  fs.writeFileSync(est, 'fila,nro,estado tango\n' +
    resultados.map(r => `${r.fila},${r.datos.nro},"${r.estado}"`).join('\n') + '\n');

  const cuenta = e => resultados.filter(r => r.estado.startsWith(e)).length;
  console.log(`Procesadas: ${cuenta('procesada')} | Rechazadas: ${cuenta('rechazada')} | Omitidas: ${cuenta('omitida')}`);
  resultados.filter(r => r.estado.startsWith('rechazada'))
    .forEach(r => console.log(`  fila ${r.fila}: ${r.estado}`));
  console.log(`TXT: ${txt}\nEstados: ${est}`);

  if (process.argv.includes('--escribir-estados')) {
    const ruta = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const json = process.env.GOOGLE_CREDENTIALS_JSON;
    if (!ruta && !json) throw new Error('Falta GOOGLE_APPLICATION_CREDENTIALS (ruta al JSON) o GOOGLE_CREDENTIALS_JSON (contenido del JSON)');
    if (process.argv.includes('--archivo')) throw new Error('--escribir-estados no se puede usar con --archivo: las filas deben venir de la hoja');
    const n = await escribirEstados({
      cred: JSON.parse(json || fs.readFileSync(ruta, 'utf8')),
      sheetId: SHEET_ID, colEstado: resultados.colEstado, resultados,
    });
    console.log(`Estado tango escrito en la hoja: ${n} filas`);
  }
})().catch(e => { console.error('Error:', e.message); process.exit(1); });
