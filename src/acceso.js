// Clave de acceso compartida: se compara con CLAVE_ACCESO (variable de entorno).
const crypto = require('crypto');

// Devuelve true solo si hay clave configurada y coincide (sin filtrar por tiempo de comparación).
function claveValida(recibida, esperada = process.env.CLAVE_ACCESO) {
  if (!esperada || typeof recibida !== 'string') return false;
  const h = s => crypto.createHash('sha256').update(s).digest();
  return crypto.timingSafeEqual(h(recibida), h(esperada));
}

module.exports = { claveValida };
