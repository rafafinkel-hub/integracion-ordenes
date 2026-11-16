# integracion-ordenes

Integración entre una hoja de Google Sheets y Tango (Tango Gestión): lee órdenes de compra de la hoja y las deja en un TXT. Más adelante se enviarán a Tango.

## Estado (16/11/2026)

| Etapa | Estado |
|---|---|
| Leer la hoja y validar filas | Hecho |
| Generar TXT separado por comas | Hecho |
| Estado tango por fila (archivo de resultados) | Hecho |
| Escribir `Estado tango` en la hoja (cuenta de servicio) | Hecho (falta probar contra la hoja real: requiere las credenciales) |
| Botón en una página web | Pendiente |
| Envío a Tango | Pendiente |

Documentación completa: [docs/DOCUMENTACION.md](docs/DOCUMENTACION.md).

## Hoja

[Ordenes de compra](https://docs.google.com/spreadsheets/d/1JpJsLLxULTpywNy6FopjpHGWGavG1Ve0gfR7G_f5UHs/edit), hoja 1. Columnas: `Empresa`, `nro`, `desc`, `cantidad`, `precio unitario`, `total`, `Estado tango`. **Cada fila es una orden.** La hoja tiene que estar compartida por link.

## Reglas

- Todos los campos tienen que estar completos, salvo `Estado tango`. Si falta alguno, la fila se **rechaza** con el motivo y no va al TXT.
- No se valida el contenido (números, totales): solo que no esté vacío.
- Filas con `Estado tango` ya cargado se **omiten**, para no duplicar órdenes.
- Las filas totalmente vacías se ignoran.
- Si una descripción tiene coma, va entre comillas dobles en el TXT.

## Uso

Requiere Node.js 18 o superior. Sin dependencias.

```bash
node src/index.js
```

Con un CSV local, para probar sin red:

```bash
node src/index.js --archivo ruta/al/archivo.csv
```

Genera en `salida/` (no se sube a git):

- `ordenes_DD-MM-AAAA_HHMM.txt`: órdenes válidas, separadas por comas, con encabezado.
- `estado_tango_DD-MM-AAAA_HHMM.csv`: fila de la hoja, `nro` y estado (`procesada` o `rechazada: motivo`). Se escribe en la hoja solo con `--escribir-estados` (ver abajo).

## Escribir `Estado tango` en la hoja

Usa una **cuenta de servicio** de Google (sin dependencias, la firma se hace con `crypto` de Node).

1. En Google Cloud: crear un proyecto, habilitar la **Google Sheets API**, crear una cuenta de servicio y descargar su clave en JSON.
2. Compartir la hoja con el `client_email` de la cuenta de servicio como **Editor**.
3. Correr:

```bash
GOOGLE_APPLICATION_CREDENTIALS=ruta/credenciales.json node src/index.js --escribir-estados
```

Escribe `procesada` o `rechazada: motivo` en la columna `Estado tango` de cada fila procesada o rechazada; las omitidas no se tocan. No se puede combinar con `--archivo`. Los JSON de credenciales están en `.gitignore`: **no los subas a git**.

## Pruebas

```bash
npm test
```

## Estructura

| Ruta | Qué es |
|---|---|
| `src/procesar.js` | Parseo del CSV, validación y armado del TXT (sin red ni archivos). |
| `src/index.js` | Lee la hoja o un CSV, escribe los archivos de `salida/`. |
| `src/sheets.js` | Escritura del estado en la hoja (JWT de cuenta de servicio + Sheets API). |
| `tests/` | Pruebas de la lógica y de la escritura (con `fetch` simulado). |
