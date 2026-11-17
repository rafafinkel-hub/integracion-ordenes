# Documentación de integracion-ordenes

Última actualización: 17/11/2026

## 1. Qué hace

Toma las órdenes de compra de una hoja de Google Sheets y las deja listas para Tango Gestión. Se puede usar de dos maneras: por línea de comandos o desde una página web con un botón.

1. Lee la hoja (cada fila es una orden).
2. **Solo procesa las filas cuya columna `Estado tango` está vacía.** Si ya tiene algo cargado (`procesada`, `rechazada: ...`, lo que sea), la fila se **omite**: no va al TXT, no se vuelve a evaluar y no se modifica en la hoja. Así una orden nunca se duplica.
3. Valida cada fila pendiente: todos los campos tienen que estar completos.
4. Genera un TXT con las órdenes válidas.
5. Escribe el estado (`procesada` o `rechazada: ...`) en la columna `Estado tango` de la hoja.

**Pendiente:** el envío real a Tango (todavía sin acceso a la API). Hoy el botón "Importar órdenes a Tango" lee, valida, marca la hoja y genera el TXT; no llama a Tango.

## 2. Estado del proyecto

| Etapa | Estado |
|---|---|
| Leer la hoja y validar filas | Hecho |
| Generar TXT separado por comas | Hecho |
| Escribir `Estado tango` en la hoja (cuenta de servicio) | Hecho y probado contra la hoja real |
| Página web con botón y listado de resultados | Hecho, desplegada en Netlify |
| Envío a Tango | Pendiente |

## 3. Flujo

```
                       ┌─ línea de comandos (src/index.js)
Hoja de Google ──CSV──▶│
                       └─ web (public/index.html ─▶ /api/importar ─▶ src/importar.js)
                                   │
                                   ▼
                  parsearCSV ──▶ procesar ──▶ armarTXT ──▶ salida/ordenes_*.txt
                                   │
                                   └──▶ Sheets API ──▶ columna "Estado tango"
```

## 4. La hoja

[Ordenes de compra](https://docs.google.com/spreadsheets/d/1JpJsLLxULTpywNy6FopjpHGWGavG1Ve0gfR7G_f5UHs/edit), pestaña 1 (gid=0). Para **leer** tiene que estar compartida por link; para **escribir** tiene que estar compartida como Editor con el `client_email` de la cuenta de servicio.

| Columna | Obligatoria | Notas |
|---|---|---|
| `Empresa` | Sí | |
| `nro` | Sí | |
| `desc` | Sí | Si tiene coma, va entre comillas en el TXT |
| `cantidad` | Sí | |
| `precio unitario` | Sí | |
| `total` | Sí | |
| `Estado tango` | No | Lo completa la app. Vacío = pendiente |

Los encabezados deben llamarse exactamente así (el orden de las columnas no importa). Si falta alguno, la importación corta con error.

Para **reprocesar** una orden (por ejemplo, una rechazada que ya corrigieron), hay que borrar el contenido de su celda `Estado tango`.

## 5. Estados de cada fila

| Estado | Cuándo | ¿Va al TXT? | ¿Se escribe en la hoja? |
|---|---|---|---|
| `procesada` | `Estado tango` vacío y todos los campos completos | Sí | Sí |
| `rechazada: falta X, Y` | `Estado tango` vacío y faltan campos | No | Sí |
| `omitida` | `Estado tango` ya tenía algo | No | No (no se toca) |

Reglas: no se valida el contenido (números, totales), solo que no esté vacío. Las filas totalmente vacías se ignoran.

## 6. Uso por línea de comandos

Requiere Node.js 18 o superior. Sin dependencias. En el entorno de Claude Code en la nube hace falta `NODE_USE_ENV_PROXY=1` para salir a internet.

```bash
node src/index.js                       # lee la hoja y genera los archivos (no escribe en la hoja)
node src/index.js --archivo orden.csv   # prueba sin red con un CSV local
node src/index.js --hoja ID             # usa otra hoja (por ejemplo una copia de prueba)
node src/index.js --escribir-estados    # además escribe "Estado tango" en la hoja
```

`--escribir-estados` no se puede combinar con `--archivo`. Salida en `salida/` (no se sube a git):

- `ordenes_DD-MM-AAAA_HHMM.txt`: órdenes procesadas, separadas por comas, con encabezado.
- `estado_tango_DD-MM-AAAA_HHMM.csv`: fila, `nro` y estado de cada orden (incluye las omitidas).

En consola muestra el resumen `Procesadas | Rechazadas | Omitidas` y el motivo de cada rechazo.

## 7. Página web

La página (`public/index.html`) tiene un campo de clave, el botón **Importar órdenes a Tango** y, abajo, un resumen (Procesadas, Rechazadas, Omitidas) y una tabla con fila, empresa, nro, descripción, total y resultado. Las filas omitidas se muestran como "omitida (ya tenía estado)".

El botón llama a `POST /api/importar` con el header `x-clave`. La respuesta es JSON:

```json
{ "resumen": { "procesadas": 3, "rechazadas": 1, "omitidas": 0 },
  "escritas": 4, "txt": "ordenes_17-11-2026_1308.txt",
  "filas": [ { "fila": 2, "empresa": "...", "nro": "1", "desc": "...", "total": "6", "estado": "procesada" } ] }
```

| Código | Significado |
|---|---|
| 200 | Importación hecha |
| 401 | Clave incorrecta |
| 405 | Método distinto de POST (solo en Netlify) |
| 409 | Ya hay una importación en curso (solo servidor local) |
| 500 | Error: falta `CLAVE_ACCESO`, falta la credencial de Google, o falló Google (el mensaje viene en `error`) |

### Clave de acceso

Cualquiera con el link podría tocar el botón, así que el endpoint exige la clave definida en la variable `CLAVE_ACCESO`. **Si esa variable no está configurada, el endpoint rechaza todo** (error 500), para que nunca quede abierto por olvido. La comparación es en tiempo constante (`src/acceso.js`). La página recuerda la clave solo durante la pestaña abierta (`sessionStorage`).

### Local

```bash
CLAVE_ACCESO=unaClave npm run web   # http://127.0.0.1:3000
```

`PORT` y `HOST` son opcionales (por defecto `3000` y `127.0.0.1`). Guarda el TXT en `salida/` solo si hay órdenes nuevas válidas.

### Netlify

Sitio: <https://integracion-ordenes.netlify.app/>. `netlify.toml` publica `public/` y redirige `/api/importar` a la función `netlify/functions/importar.js`, que incluye `src/**`.

Variables de entorno del sitio (en **Site configuration → Environment variables**; el nombre va en *Key* y solo el valor en *Value*, sin `NOMBRE=`):

| Variable | Qué lleva |
|---|---|
| `GOOGLE_CREDENTIALS_JSON` | JSON de la cuenta de servicio, en texto o **en base64 en una sola línea**. Si se marca como secreta, Netlify pide un valor por ambiente: pegar el mismo en Production, Deploy Previews y Branch deploys |
| `CLAVE_ACCESO` | Clave para entrar a la página |

Después de cambiar una variable hay que redesplegar (**Deploys → Trigger deploy → Deploy site**). En Netlify no se guarda el TXT, porque el disco es de solo lectura; la hoja sí se actualiza.

## 8. Escritura en la hoja (cuenta de servicio)

1. En Google Cloud: crear un proyecto y habilitar la **Google Sheets API**.
2. Crear una **cuenta de servicio** y descargar su clave en formato **JSON** (no P12). El archivo tiene llaves `{ }` y un campo `client_email`.
3. Compartir la hoja con ese `client_email` como **Editor**.
4. Entregarle la credencial a la app de una de estas maneras:
   - `GOOGLE_APPLICATION_CREDENTIALS=ruta/al/archivo.json`
   - `GOOGLE_CREDENTIALS_JSON` con el contenido del JSON, o ese contenido en base64. Para pasarlo a base64 en una línea:
     - Windows (PowerShell): `[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\ruta\archivo.json")) | Set-Clipboard`
     - Mac/Linux: `base64 -w0 archivo.json` (en Mac: `base64 -i archivo.json | tr -d '\n'`)

La app firma un JWT (RS256) con la clave, lo cambia por un token en `oauth2.googleapis.com`, busca el nombre de la pestaña y escribe todos los estados en un solo `values:batchUpdate`.

**Seguridad:** el JSON de credenciales da acceso de edición a la hoja. No se sube a git (`.gitignore` excluye `credenciales*.json`, `*-sa.json` y `.env`), no se pega en chats ni se guarda en archivos del proyecto.

## 9. Estructura del código

| Ruta | Responsabilidad |
|---|---|
| `src/procesar.js` | Lógica pura: `parsearCSV`, `procesar` (validación y estados), `armarTXT`. Sin red ni archivos. |
| `src/sheets.js` | `armarJWT`, `armarActualizaciones`, `escribirEstados` (Sheets API). |
| `src/importar.js` | `importar()`: baja la hoja, valida, guarda el TXT (si hay carpeta) y escribe los estados. `leerCredenciales()`. La usa la web. |
| `src/acceso.js` | `claveValida()`: compara la clave con `CLAVE_ACCESO`. |
| `src/servidor.js` | Servidor local: sirve la página y `POST /api/importar`. |
| `src/index.js` | Línea de comandos. |
| `netlify/functions/importar.js` | Misma API para Netlify. |
| `netlify.toml` | Publicación de `public/` y redirección de `/api/importar`. |
| `public/index.html` | La página: clave, botón y listado. |
| `tests/` | Pruebas con `node:test`. Las de red usan `fetch` simulado. |

```bash
npm test
```

## 10. Errores comunes

| Mensaje | Causa |
|---|---|
| `No se pudo bajar la hoja (HTTP ...)` | La hoja no está compartida por link |
| `Falta la columna "..."` | Encabezado mal escrito o borrado |
| `Falta GOOGLE_APPLICATION_CREDENTIALS ... o GOOGLE_CREDENTIALS_JSON` | No se indicó la credencial |
| `Unexpected token ... is not valid JSON` (con texto ilegible) | `GOOGLE_CREDENTIALS_JSON` tiene un valor que no es el JSON completo ni su base64: por ejemplo solo la clave privada, el nombre de la variable pegado junto al valor, o un valor viejo en otro ambiente de Netlify |
| `Google respondió HTTP 403` | La hoja no está compartida con la cuenta de servicio como Editor, o falta habilitar la Sheets API |
| `Clave incorrecta` | La clave escrita no coincide con `CLAVE_ACCESO` |
| `Falta configurar CLAVE_ACCESO` | La variable no está cargada, o falta redesplegar en Netlify |

## 11. Pendiente

- Envío a Tango (requiere acceso a la API).
- Contraseña más robusta o login real si la página se comparte con más gente.
