# Chrome Web Store — Listing pack (ES-AR)

Material listo para pegar en el formulario de submission de la Chrome Web Store
para Precio Real v0.2.2. Idioma principal: español (Argentina).

> Última revisión: 2026-05-09 (v11 — sincronizado con manifest v0.2.2 de 101 retailers, ciclo 1623).
> Mantener sincronizado con `extension/manifest.json`, `landing/index.html` y
> `landing/privacidad.html`. Si se agregan retailers en el manifest, actualizar acá
> y en privacidad.html antes de re-submit.

---

## 1. Datos básicos del listing

| Campo | Valor |
|-------|-------|
| Name (max 75 chars) | `Precio Real — historial real de precios en Argentina` |
| Short summary (max 132 chars) | `Detectá descuentos truchos en Hot Sale: historial real de precios en 101 e-commerce argentinos. Sin cuenta, sin tracking.` |
| Category | Shopping |
| Language | Spanish (Argentina) — `es-AR` |
| Website / Homepage URL | `https://precio-real.firemandeveloper.com` |
| Support URL | `https://github.com/larancibia/precio-real/issues` |
| Privacy policy URL | `https://precio-real.firemandeveloper.com/privacidad.html` |
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
- 101 sitios soportados v0.2.2: Mercado Libre Argentina, Frávega, Garbarino, Falabella Argentina, Carrefour Argentina, Coto Digital, Naldo, Musimundo, Cetrogar, Megatone, Día Online, Jumbo, Disco, Sodimac, Easy, Hendel, Rodo, Ribeiro, Compumundo, Samsung Store, LG Argentina, Sony Store, Philips Argentina, BGH, Noblex, Whirlpool, Changomás, Electrolux, Drean, Motorola Store, Todomodo, Amazon Argentina, HiperTehno, Xiaomi Mi Store, Philco Argentina, Venex, BGood, HP Tienda, Lenovo Argentina, Alphatec, Exo, Hisense Argentina, TCL Argentina, Pycca, Newsan, Asus Store Argentina, Mac Center, Full, Micro Center, iPoint, Acer Store, Coolbox, Olimpo, Dexter, TGC, Maxiconsumo, FullH4rd, Start Tech PC, PC House, Zetta, Geek Store, Computodo, MaxiHogar, PC Factory, CompraGamer, Golden Shop, Soluciones, Arredondo, iThink, Nexstore, Cable Hogar, Bit, Digital Haus, InStore, Staples, Gotta, Power Planet, iGaming Store, Netizar, MegaStore, Century Tech, Klibr, Lazer, PC Arg, Carsa, GrupoDIN, Coppel, Megatronics, Mac Station, Winpy, GearZone, Binario, CompuPC, Autronic, Megatrix y Pixelstore.
- Datos de inflación de EcoGo para contextualizar los precios.

PRIVACIDAD
- Sin cuenta, sin login, sin datos personales.
- Solo procesamos la URL pública del producto para consultar su historial.
- No vendemos datos. No tenemos.
- Política completa: https://precio-real.firemandeveloper.com/privacidad.html

OPEN SOURCE
Código auditable en GitHub: https://github.com/larancibia/precio-real
Hecha en Argentina. Gratis. Soporte opcional vía Cafecito.
```

---

## 2b. Descripción larga (EN) — versión inglés opcional

> Útil si Chrome Web Store permite idioma secundario. Pegar en el campo "Detailed description" del locale EN.

```
Precio Real is a free, open-source Chrome extension that shows the real price history of products on Argentine e-commerce sites. Built for Hot Sale, Cyber Monday, and any sale event where discounts can be misleading.

WHY?
According to EcoGo, prices in Argentina rise 4%–6% in the weeks before Hot Sale. Retailers then "discount" back to the price they already had. Precio Real alerts you when that happens.

HOW IT WORKS
- Install in one click. No account, no personal data.
- Browse Mercado Libre, Frávega, Garbarino, Falabella, Carrefour, Amazon Argentina, or any of the 101 supported sites.
- When you open a product page, a badge shows the verdict: real price, inflated, or neutral.
- If the "discount" hides a prior price hike, we tell you.

WHAT'S INCLUDED
- Real price history per product.
- Alerts for fake discounts (price-hike-then-markdown tactics).
- 101 supported Argentine e-commerce sites (v0.2.2): Mercado Libre, Frávega, Garbarino, Falabella, Carrefour, Coto Digital, Naldo, Musimundo, Cetrogar, Megatone, Día Online, Jumbo, Disco, Sodimac, Easy, Hendel, Rodo, Ribeiro, Compumundo, Samsung Store, LG Argentina, Sony Store, Philips Argentina, BGH, Noblex, Whirlpool, Changomás, Electrolux, Drean, Motorola Store, Todomodo, Amazon Argentina, HiperTehno, Xiaomi Mi Store Argentina, Philco Argentina, Venex, BGood, HP Tienda, Lenovo Argentina, Alphatec, Exo, Hisense Argentina, TCL Argentina, Pycca, Newsan, Asus Store Argentina, Mac Center, Full, Micro Center, iPoint, Acer Store, Coolbox, Olimpo, Dexter, TGC, Maxiconsumo, FullH4rd, Start Tech PC, PC House, Zetta, Geek Store, Computodo, MaxiHogar, PC Factory, CompraGamer, Golden Shop, Soluciones, Arredondo, iThink, Nexstore, Cable Hogar, Bit, Digital Haus, InStore, Staples, Gotta, Power Planet, iGaming Store, Netizar, MegaStore, Century Tech, Klibr, Lazer, PC Arg, Carsa, GrupoDIN, Coppel, Megatronics, Mac Station, Winpy, GearZone, Binario, CompuPC, Autronic, Megatrix, and Pixelstore.
- EcoGo inflation data to contextualize prices.

PRIVACY
- No account, no login, no personal data collected.
- We only process the public product URL to query its history.
- We don't sell data. We don't have any to sell.
- Full policy: https://precio-real.firemandeveloper.com/privacy-policy.html

OPEN SOURCE
Auditable code on GitHub: https://github.com/larancibia/precio-real
Made in Argentina. Free. Optional support via Cafecito.
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

Dominios solicitados (101 retailers de e-commerce argentino):
- `https://*.mercadolibre.com.ar/*`
- `https://*.fravega.com/*`
- `https://*.garbarino.com/*`
- `https://*.falabella.com.ar/*`
- `https://*.carrefour.com.ar/*`
- `https://*.cotodigital3.com.ar/*`
- `https://*.coto.com.ar/*`
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
- `https://*.rodo.com.ar/*`
- `https://*.ribeiro.com.ar/*`
- `https://*.compumundo.com.ar/*`
- `https://*.samsung.com.ar/*`
- `https://www.lg.com/ar/*`
- `https://*.sony.com.ar/*`
- `https://*.philips.com.ar/*`
- `https://*.bgh.com.ar/*`
- `https://*.noblex.com.ar/*`
- `https://*.whirlpool.com.ar/*`
- `https://*.changomas.com.ar/*`
- `https://*.electrolux.com.ar/*`
- `https://*.drean.com.ar/*`
- `https://*.motorola.com.ar/*`
- `https://*.todomodo.com.ar/*`
- `https://*.amazon.com.ar/*`
- `https://*.hipertehno.com.ar/*`
- `https://tienda.mi.com/ar/*`
- `https://*.philco.com.ar/*`
- `https://*.venex.com.ar/*`
- `https://*.bgood.com.ar/*`
- `https://*.hptienda.com.ar/*`
- `https://www.lenovo.com/ar/*`
- `https://*.alphatec.com.ar/*`
- `https://*.exo.com.ar/*`
- `https://*.hisense.com.ar/*`
- `https://*.tcl.com.ar/*`
- `https://*.pycca.com.ar/*`
- `https://*.newsan.com.ar/*`
- `https://store.asus.com/ar/*`
- `https://*.maccenter.com.ar/*`
- `https://*.full.com.ar/*`
- `https://*.microcenter.com.ar/*`
- `https://*.ipoint.com.ar/*`
- `https://store.acer.com/es-ar/*`
- `https://*.coolbox.com.ar/*`
- `https://*.olimpo.com.ar/*`
- `https://*.dexter.com.ar/*`
- `https://*.tgc.com.ar/*`
- `https://*.maxiconsumo.com/*`
- `https://*.fullh4rd.com.ar/*`
- `https://*.startechpc.com.ar/*`
- `https://*.phouse.com.ar/*`
- `https://*.zetta.net.ar/*`
- `https://*.geekstore.com.ar/*`
- `https://*.computodo.com.ar/*`
- `https://*.maxihogar.com.ar/*`
- `https://*.pcfactory.com.ar/*`
- `https://*.compragamer.com/*`
- `https://*.goldenshop.com.ar/*`
- `https://*.soluciones.com.ar/*`
- `https://*.arredondo.com.ar/*`
- `https://*.ithink.com.ar/*`
- `https://*.nexstore.com.ar/*`
- `https://*.cablehogar.com.ar/*`
- `https://*.bit.ar/*`
- `https://*.digitalhaus.com.ar/*`
- `https://*.instore.com.ar/*`
- `https://*.staples.com.ar/*`
- `https://*.gotta.com.ar/*`
- `https://*.powerplanet.com.ar/*`
- `https://*.igamingstore.com.ar/*`
- `https://*.netizar.com.ar/*`
- `https://*.megastore.com.ar/*`
- `https://*.centurytech.com.ar/*`
- `https://*.klibr.com.ar/*`
- `https://*.lazer.com.ar/*`
- `https://*.pcarg.com.ar/*`
- `https://*.carsa.com.ar/*`
- `https://*.grupodin.com/*`
- `https://*.coppel.com/*`
- `https://*.megatronics.com.ar/*`
- `https://*.macstation.com.ar/*`
- `https://*.winpy.com.ar/*`
- `https://*.gearzone.com.ar/*`
- `https://*.binario.com.ar/*`
- `https://*.compupc.com.ar/*`
- `https://*.autronic.com.ar/*`
- `https://*.megatrix.com.ar/*`
- `https://*.pixelstore.com.ar/*`

### Remote code use
```
La extensión NO ejecuta código remoto. Todo el JavaScript está empaquetado dentro del .zip subido a la Chrome Web Store. La única comunicación de red es una llamada GET a https://precio-real-api.arancibialuisalejandro.workers.dev/api/price para obtener el historial de un producto.
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

- [ ] `manifest.json` con `version: "0.2.0"` (o bump si corresponde).
- [ ] `manifest.json` apunta a producción (`config.js` con `API_BASE = "https://precio-real-api.arancibialuisalejandro.workers.dev"`, **no** localhost).
- [ ] Privacy policy publicada en `https://precio-real.firemandeveloper.com/privacidad.html` y accesible.
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
