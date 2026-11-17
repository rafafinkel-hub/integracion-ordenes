// Importación de órdenes reutilizable (la usa el servidor web): baja la hoja, valida,
// guarda el TXT y, si se pide, escribe "Estado tango" en la hoja.
const fs = require('fs');
const path = require('path');
const { escribirEstados } = require('./sheets');
const { parsearCSV, procesar, armarTXT } = require('./procesar');

const SHEET_ID = process.env.SHEET_ID || '1JpJsLLxULTpywNy6FopjpHGWGavG1Ve0gfR7G_f5UHs';

function sello(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}_${p(d.getHours())}${p(d.getMinutes())}`;
}

function leerCredenciales(env = process.env) {
  const ruta = env.GOOGLE_APPLICATION_CREDENTIALS;
  const json = env.GOOGLE_CREDENTIALS_JSON;
  if (!ruta && !json) throw new Error('Falta GOOGLE_APPLICATION_CREDENTIALS (ruta al JSON) o GOOGLE_CREDENTIALS_JSON (contenido del JSON)');
  const texto = json ? (json.trim().startsWith('{') ? json : Buffer.from(json, 'base64').toString('utf8')) : fs.readFileSync(ruta, 'utf8');
  return JSON.parse(texto);
}

async function importar({ sheetId = SHEET_ID, fetchFn = fetch, carpetaSalida = path.join(__dirname, '..', 'salida') } = {}) {
  const res = await fetchFn(`https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=0`);
  if (!res.ok) throw new Error(`No se pudo bajar la hoja (HTTP ${res.status}). ¿Está compartida por link?`);
  const resultados = procesar(parsearCSV(await res.text()));

  const cuenta = e => resultados.filter(r => r.estado.startsWith(e)).length;
  const resumen = { procesadas: cuenta('procesada'), rechazadas: cuenta('rechazada'), omitidas: cuenta('omitida') };

  // El TXT solo se genera si hay órdenes nuevas válidas (evita archivos vacíos) y hay carpeta (null = no guardar).
  let txt = null;
  if (resumen.procesadas && carpetaSalida) {
    fs.mkdirSync(carpetaSalida, { recursive: true });
    txt = path.join(carpetaSalida, `ordenes_${sello()}.txt`);
    fs.writeFileSync(txt, armarTXT(resultados));
  }

  const cred = leerCredenciales(); // falla antes de escribir si no hay credencial
  const escritas = await escribirEstados({ cred, sheetId, colEstado: resultados.colEstado, resultados, fetchFn });

  return {
    resumen, escritas, txt: txt && path.basename(txt),
    filas: resultados.map(r => ({ fila: r.fila, empresa: r.datos.Empresa, nro: r.datos.nro, desc: r.datos.desc, total: r.datos.total, estado: r.estado })),
  };
}

module.exports = { importar, leerCredenciales };
