# Chrome Web Store — Listing pack (ES-AR)

Material listo para pegar en el formulario de submission de la Chrome Web Store
para Precio Real v0.1.0. Idioma principal: español (Argentina).

> Última revisión: 2026-05-09 (v2 — sincronizado con manifest v0.1.0 de 16 retailers).
> Mantener sincronizado con `extension/manifest.json`, `landing/index.html` y
> `landing/privacidad.html`. Si se agregan retailers en el manifest, actualizar acá
> y en privacidad.html antes de re-submit.

---

## 1. Datos básicos del listing

| Campo | Valor |
|-------|-------|
| Name (max 75 chars) | `Precio Real — historial real de precios en Argentina` |
| Short summary (max 132 chars) | `Detectá descuentos truchos en Hot Sale: Precio Real te muestra el historial real de precios en Mercado Libre, Frávega y más.` |
| Category | Shopping |
| Language | Spanish (Argentina) — `es-AR` |
| Website / Homepage URL | `https://preciorreal.com` |
| Support URL | `https://github.com/larancibia/precio-real/issues` |
| Privacy policy URL | `https://preciorreal.com/privacidad.html` |
| Single purpose | Mostrar el historial real de precios de productos en e-commerce argentinos para detectar aumentos disfrazados de descuentos. |

---

## 2. Descripción larga (ES) — copy/paste

> Pegar tal cual en el campo "Detailed description". Mantener saltos de línea.
> Total ~ 1.4k caracteres, dentro del límite de 16k de Chrome Web Store.

```
Precio Real es una extensión gratuita y open source que te muestra el historial real de precios de cada producto en los principales e-commerce de Argentina. Pensada para Hot Sale, Cyber Monday y cualquier promo donde los descuentos suelen ser truchos.

¿Por qué? Según EcoGo, en las semanas previas al Hot Sale los precios suben entre 4% y 6%. Después "rebajan" al valor que ya tenían y lo venden como descuento. Precio Real te avisa cuando eso pasa.

CÓMO FUNCIONA
- Instalás la extensión en un click. No pide registro ni datos personales.
- Navegás normal por Mercado Libre, Frávega, Garbarino, Falabella, Carrefour o Coto Digital.
- Cuando entrás a un producto, aparece un badge con el veredicto: precio real, inflado o neutral.
- Si el "descuento" oculta un aumento previo, te lo decimos.

QUÉ INCLUYE
- Historial de precios real por producto.
- Alertas de aumentos disfrazados de descuento.
- 16 sitios soportados v0.1.0: Mercado Libre Argentina, Frávega, Garbarino, Falabella Argentina, Carrefour Argentina, Coto Digital, Naldo, Musimundo, Cetrogar, Megatone, Día Online, Jumbo, Disco, Sodimac, Easy y Hendel.
- Datos de inflación de EcoGo para contextualizar los precios.

PRIVACIDAD
- Sin cuenta, sin login, sin datos personales.
- Solo procesamos la URL pública del producto para consultar su historial.
- No vendemos datos. No tenemos.
- Política completa: https://preciorreal.com/privacidad.html

OPEN SOURCE
Código auditable en GitHub: https://github.com/larancibia/precio-real
Hecha en Argentina. Gratis. Soporte opcional vía Cafecito.
```

---

## 3. Justificación de permisos (campo "Permission justifications")

Chrome Web Store exige justificar cada permiso solicitado. Pegar lo siguiente
en cada campo correspondiente del formulario:

### `storage`
```
Se usa exclusivamente para guardar preferencias locales de la extensión en el navegador del usuario (por ejemplo, badges descartados manualmente). No se sincroniza con servidores propios ni de terceros.
```

### `activeTab`
```
Se usa para leer la pestaña activa cuando el usuario navega un sitio soportado, con el único fin de detectar el producto y su precio actual. No se acceden pestañas inactivas ni en segundo plano.
```

### Host permissions (cada dominio)
```
La extensión inyecta un content script en estos sitios de e-commerce argentinos para detectar la ficha de producto, leer el precio publicado y mostrar el historial real. No se accede a otros sitios fuera de esta lista.
```

Dominios solicitados (16 retailers de e-commerce argentino):
- `https://*.mercadolibre.com.ar/*`
- `https://*.fravega.com/*`
- `https://*.garbarino.com/*`
- `https://*.falabella.com.ar/*`
- `https://*.carrefour.com.ar/*`
- `https://*.cotodigital3.com.ar/*`
- `https://*.naldo.com.ar/*`
- `https://*.musimundo.com/*`
- `https://*.cetrogar.com.ar/*`
- `https://*.megatone.net/*`
- `https://diaonline.supermercadosdia.com.ar/*`
- `https://*.jumbo.com.ar/*`
- `https://*.disco.com.ar/*`
- `https://*.sodimac.com.ar/*`
- `https://*.easy.com.ar/*`
- `https://*.hendel.com.ar/*`

### Remote code use
```
La extensión NO ejecuta código remoto. Todo el JavaScript está empaquetado dentro del .zip subido a la Chrome Web Store. La única comunicación de red es una llamada GET a https://preciorreal.com/api/price para obtener el historial de un producto.
```

### Data usage disclosures (sección "Privacy practices")

| Pregunta del formulario | Respuesta |
|-------------------------|-----------|
| Personally identifiable info | NO |
| Health info | NO |
| Financial / payment info | NO |
| Authentication info | NO |
| Personal communications | NO |
| Location | NO |
| Web history | NO (solo URL del producto consultado, sin asociar a un usuario) |
| User activity | NO |
| Website content | YES — limitado a HTML público de la ficha de producto en sitios soportados |

Tildar también los tres certifications obligatorias:
- [x] No vendemos datos a terceros.
- [x] No usamos los datos para fines distintos al propósito declarado.
- [x] No usamos los datos para determinar solvencia o para préstamos.

---

## 4. Screenshots — specs y guion

Chrome Web Store acepta entre 1 y 5 screenshots. **Tamaño obligatorio: 1280×800 px** (o 640×400 px). PNG o JPEG. El primer screenshot es el más importante porque sale en el grid de búsqueda.

### Lista a producir (orden de prioridad)

| # | Filename sugerido | Contenido | Caption (overlay opcional) |
|---|-------------------|-----------|----------------------------|
| 1 | `cws-01-badge-inflated.png` | Captura real de una ficha de producto en Mercado Libre con el badge de Precio Real activo, mostrando "PRECIO INFLADO" sobre un producto de Hot Sale. | "Detectá descuentos truchos en Hot Sale" |
| 2 | `cws-02-popup-history.png` | Popup de la extensión abierto sobre una pestaña de Mercado Libre, mostrando el gráfico de evolución del precio y el veredicto. | "Historial real de precios, sin vueltas" |
| 3 | `cws-03-badge-real.png` | Ficha de producto con badge "PRECIO REAL" en verde — un caso donde el descuento sí es genuino. | "También te decimos cuando el precio sí es real" |
| 4 | `cws-04-multi-sites.png` | Mosaico/collage con badges en Frávega, Carrefour y Falabella simultáneamente. | "Funciona en los principales e-commerce argentinos" |
| 5 | `cws-05-privacy.png` | Captura del popup + texto destacando "Sin cuenta, sin tracking, open source". | "Sin registro. Sin datos personales. Open source." |

### Reglas de producción
- Resolución: **1280×800 px** estricta (no 1280×720, no 1366×768).
- Sin bordes blancos. Fondo full-bleed.
- Tipografía sobre la imagen: SF Pro / Inter / system-ui, peso 600–700, tamaño mínimo 36px para el caption principal. Nunca texto chico que no se lea en el grid.
- Mostrar la barra de URL del navegador con dominio real (mercadolibre.com.ar, fravega.com, etc.). No usar capturas con `localhost:8787`.
- Tachar/redactar cualquier dato personal visible (nombre de usuario en ML, dirección de envío, etc.).
- Evitar promesas que la extensión no cumple aún (alertas por email, multi-browser, etc.).

### Promo tile / Marquee (opcional pero recomendado)
- **Small promo tile** (440×280 px) — usar logo + tagline "Hot Sale sin sorpresas".
- **Marquee promo tile** (1400×560 px) — opcional, alta visibilidad si entramos en featured.

---

## 5. Iconos

Ya están en `extension/icons/`:
- `icon16.png` — 16×16 toolbar
- `icon48.png` — 48×48 management page
- `icon128.png` — 128×128 store listing (este es el que ven los usuarios)

Verificar que `icon128.png` se ve nítido en el preview de la store antes de submit.

---

## 6. Checklist pre-submit

- [ ] `manifest.json` con `version: "0.1.0"` (o bump si corresponde).
- [ ] `manifest.json` apunta a producción (`config.js` con `API_BASE = "https://preciorreal.com"`, **no** localhost).
- [ ] Privacy policy publicada en `https://preciorreal.com/privacidad.html` y accesible.
- [ ] Footer del landing linkea a `/privacidad.html`.
- [ ] Build del .zip excluye `node_modules`, `.git`, `.DS_Store`, archivos de test.
- [ ] 5 screenshots a 1280×800 listos.
- [ ] icon128.png revisado.
- [ ] Cuenta de developer de Google Chrome Web Store activa (USD 5 one-time fee pagado).
- [ ] Justificaciones de permisos pegadas.
- [ ] Toggle "Single purpose" completado con el texto de arriba.
- [ ] Categoría: Shopping.
- [ ] Idioma primario: Spanish (Argentina).

Tiempo estimado de review por Chrome Web Store: **1–3 días hábiles** (puede demorar más si piden aclaraciones).

---

## 7. Post-submit

Cuando se apruebe:
1. Reemplazar `[LINK_CHROME_STORE_PLACEHOLDER]` en `docs/PR-KIT.md` con el link real.
2. Actualizar el botón "Instalar Gratis" del landing (`landing/index.html`, `href="#"` actualmente) con el link de la store.
3. Tweet / post en Reddit (issues #20 y #21).
4. DM a periodistas (issue #22) con el link de la store + PR-KIT.
