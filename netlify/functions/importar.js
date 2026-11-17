// Función de Netlify: POST /api/importar (ver netlify.toml). Requiere el header x-clave.
const { importar } = require('../../src/importar');
const { claveValida } = require('../../src/acceso');

const resp = (statusCode, obj) => ({
  statusCode, headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify(obj),
});

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return resp(405, { error: 'Método no permitido' });
  if (!process.env.CLAVE_ACCESO) return resp(500, { error: 'Falta configurar CLAVE_ACCESO en el servidor' });
  if (!claveValida(event.headers['x-clave'])) return resp(401, { error: 'Clave incorrecta' });
  try {
    // En Netlify el disco es de solo lectura: no se guarda el TXT (carpetaSalida: null).
    return resp(200, await importar({ carpetaSalida: null }));
  } catch (e) {
    return resp(500, { error: e.message });
  }
};
