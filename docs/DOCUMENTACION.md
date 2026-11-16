# Documentación de integracion-ordenes

Última actualización: 16/11/2026

## 1. Qué hace

Toma las órdenes de compra de una hoja de Google Sheets y las deja listas para Tango Gestión:

1. Lee la hoja (cada fila es una orden).
2. **Solo procesa las filas cuya columna `Estado tango` está vacía.** Si ya tiene algo cargado (`procesada`, `rechazada: ...`, lo que sea), la fila se **omite**: no va al TXT, no se vuelve a evaluar y no se modifica en la hoja. Así una orden nunca se duplica.
3. Valida cada fila pendiente: todos los campos tienen que estar completos.
4. Genera un TXT con las órdenes válidas y un CSV con el estado de cada fila.
5. Opcionalmente, escribe el estado en la columna `Estado tango` de la hoja.

Pendiente: botón en una página web y envío real a Tango (todavía sin acceso a la API).

## 2. Flujo

```
Hoja de Google ──CSV──▶ parsearCSV ──▶ procesar ──▶ armarTXT ──▶ salida/ordenes_*.txt
                                          │
                                          ├──▶ salida/estado_tango_*.csv
                                          └──▶ (--escribir-estados) Sheets API ──▶ columna "Estado tango"
```

## 3. La hoja

[Ordenes de compra](https://docs.google.com/spreadsheets/d/1JpJsLLxULTpywNy6FopjpHGWGavG1Ve0gfR7G_f5UHs/edit), pestaña 1 (gid=0).

| Columna | Obligatoria | Notas |
|---|---|---|
| `Empresa` | Sí | |
| `nro` | Sí | |
| `desc` | Sí | Si tiene coma, va entre comillas en el TXT |
| `cantidad` | Sí | |
| `precio unitario` | Sí | |
| `total` | Sí | |
| `Estado tango` | No | Lo completa la app. Vacío = pendiente |

Los encabezados deben llamarse exactamente así (el orden de las columnas no importa). Si falta alguno, el script corta con error.

Para **reprocesar** una orden (por ejemplo, una rechazada que ya corrigieron), hay que borrar el contenido de su celda `Estado tango`.

## 4. Estados de cada fila

| Estado | Cuándo | ¿Va al TXT? | ¿Se escribe en la hoja? |
|---|---|---|---|
| `procesada` | `Estado tango` vacío y todos los campos completos | Sí | Sí |
| `rechazada: falta X, Y` | `Estado tango` vacío y faltan campos | No | Sí |
| `omitida` | `Estado tango` ya tenía algo | No | No (no se toca) |

Reglas: no se valida el contenido (números, totales), solo que no esté vacío. Las filas totalmente vacías se ignoran.

## 5. Uso

Requiere Node.js 18 o superior. Sin dependencias. En el entorno de Claude Code en la nube hace falta `NODE_USE_ENV_PROXY=1` para salir a internet.

```bash
node src/index.js                       # lee la hoja y genera los archivos
node src/index.js --archivo orden.csv   # prueba sin red con un CSV local
GOOGLE_APPLICATION_CREDENTIALS=cred.json node src/index.js --escribir-estados
```

La hoja tiene que estar compartida por link para poder leerla. `--escribir-estados` no se puede combinar con `--archivo`.

Salida en `salida/` (no se sube a git):

- `ordenes_DD-MM-AAAA_HHMM.txt`: órdenes procesadas, separadas por comas, con encabezado.
- `estado_tango_DD-MM-AAAA_HHMM.csv`: fila, `nro` y estado de cada orden (incluye las omitidas).

En consola muestra el resumen `Procesadas | Rechazadas | Omitidas` y el motivo de cada rechazo.

## 6. Escritura en la hoja (cuenta de servicio)

1. En Google Cloud: crear un proyecto y habilitar la **Google Sheets API**.
2. Crear una **cuenta de servicio** y descargar su clave en JSON.
3. Compartir la hoja con el `client_email` de esa cuenta como **Editor**.
4. Apuntar `GOOGLE_APPLICATION_CREDENTIALS` al JSON.

La app firma un JWT (RS256) con la clave, lo cambia por un token en `oauth2.googleapis.com`, busca el nombre de la pestaña y escribe todos los estados en un solo `values:batchUpdate`.

**Seguridad:** el JSON de credenciales da acceso de edición a la hoja. No se sube a git (`.gitignore` ya excluye `credenciales*.json`, `*-sa.json` y `.env`); guardalo fuera del repo.

## 7. Estructura del código

| Ruta | Responsabilidad |
|---|---|
| `src/procesar.js` | Lógica pura: `parsearCSV`, `procesar` (validación y estados), `armarTXT`. Sin red ni archivos. |
| `src/sheets.js` | `armarJWT`, `armarActualizaciones`, `escribirEstados` (Sheets API). |
| `src/index.js` | Línea de comandos: lee hoja o CSV, escribe `salida/`, llama a `sheets.js`. |
| `tests/` | Pruebas con `node:test`. La escritura se prueba con `fetch` simulado. |

```bash
npm test
```

## 8. Errores comunes

| Mensaje | Causa |
|---|---|
| `No se pudo bajar la hoja (HTTP ...)` | La hoja no está compartida por link |
| `Falta la columna "..."` | Encabezado mal escrito o borrado |
| `Falta GOOGLE_APPLICATION_CREDENTIALS` | No se indicó el JSON de la cuenta de servicio |
| `Google respondió HTTP 403` | La hoja no está compartida con la cuenta de servicio como Editor, o falta habilitar la Sheets API |

## 9. Pendiente

- Botón en una página web que dispare el procesamiento.
- Envío a Tango (requiere acceso a la API).
- Probar la escritura contra la hoja real (faltan credenciales).
