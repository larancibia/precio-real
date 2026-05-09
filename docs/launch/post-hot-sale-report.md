# Post-Hot-Sale data report — "Los 10 retailers que mas inflaron precios"

Issue de tracking: #23 (P2, M5: Launch).
Ventana sugerida de publicacion: **18 de mayo de 2026** (lunes posterior al Hot Sale 2026).
Formato: post largo en blog/landing + thread resumen en X + crosspost en Reddit + envio al kit de prensa de `docs/PR-KIT.md`.

> Borrador editable. Reemplazar los marcadores `[VERIFICAR ...]`, `[DATO_BD ...]` y `[LINK ...]` antes de publicar. Las cifras de retailers, productos y porcentajes deben venir del backend (`backend/src/scrapers/`, tabla `prices` en D1) corriendo el query de la seccion *Metodologia* sobre la ventana **2026-04-28 a 2026-05-17**.

---

## Angulo y promesa editorial

Una sola promesa: **mostrar con datos quien inflo los precios para "rebajarlos" durante el Hot Sale 2026**.

- Viral (X/Reddit/WhatsApp): ranking simple, escandaloso, accionable.
- SEO long-tail: titulos como *"hot sale 2026 precios reales"*, *"retailers que aumentaron antes del hot sale"*, *"hot sale trucho 2026"*. Apuntar a queries que la gente va a buscar entre el 18 y el 31 de mayo.
- Credibilidad: mostrar metodologia, dataset abierto y enlace al codigo (open source). No es opinion, son numeros.

---

## Estructura del post (landing/blog)

Slug propuesto: `/hot-sale-2026-precios-reales` (link permanente; despues reusable como `/hot-sale-<ano>-precios-reales`).

### 1. Titulo (probar 2-3, elegir el de mejor CTR en X/Reddit)

- Hot Sale 2026: los 10 retailers que mas inflaron precios antes de "rebajar"
- Medimos 500 productos en el Hot Sale 2026. Estos son los 10 retailers que mas humo vendieron
- Hot Sale 2026 trucho: ranking de los retailers que mas aumentaron precios en las semanas previas

### 2. Bajada / hook (≤ 280 caracteres para que sirva como tweet 1)

Trackeamos `[DATO_BD total_productos]` productos en seis e-commerce argentinos durante 3 semanas alrededor del Hot Sale 2026. `[DATO_BD pct_productos_inflados]` % subio de precio antes del 12 de mayo y "bajo" al mismo valor (o mas) durante el evento. Estos son los 10 retailers con mayor porcentaje de descuentos truchos.

### 3. Tabla principal — Top 10 retailers

| # | Retailer | Productos medidos | % con descuento trucho | Suba promedio pre-Hot Sale | Categoria mas afectada |
|---|----------|-------------------|------------------------|----------------------------|------------------------|
| 1 | `[DATO_BD r1_nombre]` | `[DATO_BD r1_n]` | `[DATO_BD r1_pct_trucho]` % | `[DATO_BD r1_suba_pre]` % | `[DATO_BD r1_categoria]` |
| 2 | `[DATO_BD r2_nombre]` | `[DATO_BD r2_n]` | `[DATO_BD r2_pct_trucho]` % | `[DATO_BD r2_suba_pre]` % | `[DATO_BD r2_categoria]` |
| 3 | `[DATO_BD r3_nombre]` | `[DATO_BD r3_n]` | `[DATO_BD r3_pct_trucho]` % | `[DATO_BD r3_suba_pre]` % | `[DATO_BD r3_categoria]` |
| 4 | `[DATO_BD r4_nombre]` | `[DATO_BD r4_n]` | `[DATO_BD r4_pct_trucho]` % | `[DATO_BD r4_suba_pre]` % | `[DATO_BD r4_categoria]` |
| 5 | `[DATO_BD r5_nombre]` | `[DATO_BD r5_n]` | `[DATO_BD r5_pct_trucho]` % | `[DATO_BD r5_suba_pre]` % | `[DATO_BD r5_categoria]` |
| 6 | `[DATO_BD r6_nombre]` | `[DATO_BD r6_n]` | `[DATO_BD r6_pct_trucho]` % | `[DATO_BD r6_suba_pre]` % | `[DATO_BD r6_categoria]` |
| 7 | `[DATO_BD r7_nombre]` | `[DATO_BD r7_n]` | `[DATO_BD r7_pct_trucho]` % | `[DATO_BD r7_suba_pre]` % | `[DATO_BD r7_categoria]` |
| 8 | `[DATO_BD r8_nombre]` | `[DATO_BD r8_n]` | `[DATO_BD r8_pct_trucho]` % | `[DATO_BD r8_suba_pre]` % | `[DATO_BD r8_categoria]` |
| 9 | `[DATO_BD r9_nombre]` | `[DATO_BD r9_n]` | `[DATO_BD r9_pct_trucho]` % | `[DATO_BD r9_suba_pre]` % | `[DATO_BD r9_categoria]` |
| 10 | `[DATO_BD r10_nombre]` | `[DATO_BD r10_n]` | `[DATO_BD r10_pct_trucho]` % | `[DATO_BD r10_suba_pre]` % | `[DATO_BD r10_categoria]` |

> Universo de retailers actualmente soportados: Mercado Libre, Fravega, Garbarino, Falabella, Carrefour, Coto. Si la tabla es solo top 6, renombrar el post a "Los 6 retailers..." y cerrar el ranking ahi. **No inventar puestos.**

### 4. Casos testigo (3-5 productos concretos)

Para cada caso, incluir: producto, retailer, precio el 28-abr, precio el 11-may (pre-evento), precio el 12-may (lanzamiento Hot Sale), precio el 17-may (cierre), screenshot del badge de Precio Real mostrando el historial.

- Caso 1: `[DATO_BD caso1_producto]` — `[DATO_BD caso1_retailer]` — subio `[DATO_BD caso1_pre_pct]` % y "bajo" `[DATO_BD caso1_post_pct]` %, neto `[DATO_BD caso1_neto]` %.
- Caso 2: `[DATO_BD caso2_producto]` — idem.
- Caso 3: `[DATO_BD caso3_producto]` — idem.
- Caso 4 (opcional, contraejemplo honesto): producto que **realmente** bajo. Sirve para que la nota no se lea como denuncia ciega.

### 5. Metodologia (transparencia)

- **Universo:** top `[DATO_BD total_productos]` productos populares de Mercado Libre Argentina (descubiertos por el job `discoverPopularMLAProducts` en `backend/src/scrapers/discovery.ts`) + productos equivalentes en los otros cinco retailers cuando existen.
- **Ventana:** 28-abr-2026 a 17-may-2026 (3 semanas: 2 previas + Hot Sale + cierre).
- **Frecuencia de captura:** scraping diario via cron (`backend/src/scrapers/scheduled.ts`).
- **Definicion de "descuento trucho":** producto cuyo precio subio ≥ 3 % entre 28-abr y 11-may, y cuyo precio durante 12-14 may quedo igual o por encima del 28-abr.
- **Definicion de "suba pre-Hot Sale":** delta porcentual entre el precio del 28-abr y el precio mas alto observado entre 5-may y 11-may.
- **Inflacion de referencia:** se descuenta la inflacion mensual de abril/mayo 2026 segun `[VERIFICAR fuente — IPC INDEC o EcoGo]` para no contar como suba lo que es solo arrastre inflacionario.
- **Codigo de calculo:** abierto en el repo, ver `backend/scripts/` (agregar `report-hot-sale.ts` antes de publicar — pendiente).
- **Limitaciones:** muestra acotada a productos con presencia en al menos un retailer soportado; no incluye supermercadismo puro de gondola; no incluye servicios.

### 6. Como verificarlo vos mismo

- Instala Precio Real (`[LINK_CHROME_STORE]`).
- Entra a la URL del producto en cualquier retailer soportado.
- Mira el historial de precios en el badge.
- El dataset crudo del informe esta en `[LINK_DATASET]` (CSV publicado el 18-may, congelado).

### 7. Cierre — que hacer con esto

- Si el Hot Sale 2026 te decepciono, no estas paranoico: hay datos.
- Precio Real no resuelve la inflacion, pero te saca la duda de si **este** descuento es real.
- Es gratis, open source, sin login. Apoyo opcional via Cafecito (`[LINK_CAFECITO]`).
- Si sos periodista o investigador y queres acceso al dataset completo: `[LINK_CONTACTO]`.

---

## Version thread X (resumen viral, 6 tweets)

### 1/6 — Hook
Trackeamos `[DATO_BD total_productos]` productos en el Hot Sale 2026.
`[DATO_BD pct_productos_inflados]` % tuvieron descuento trucho: subieron antes y "bajaron" al mismo valor.
Va el ranking de los 10 retailers que mas humo vendieron. ↓

### 2/6 — #1 y #2
🥇 `[DATO_BD r1_nombre]` — `[DATO_BD r1_pct_trucho]` % de productos con descuento trucho.
🥈 `[DATO_BD r2_nombre]` — `[DATO_BD r2_pct_trucho]` %.
[SCREENSHOT_TABLA_TOP10]

### 3/6 — #3 a #6
🥉 `[DATO_BD r3_nombre]` — `[DATO_BD r3_pct_trucho]` %.
4. `[DATO_BD r4_nombre]` — `[DATO_BD r4_pct_trucho]` %.
5. `[DATO_BD r5_nombre]` — `[DATO_BD r5_pct_trucho]` %.
6. `[DATO_BD r6_nombre]` — `[DATO_BD r6_pct_trucho]` %.

### 4/6 — Caso testigo
`[DATO_BD caso1_producto]` en `[DATO_BD caso1_retailer]`:
- 28-abr: $`[DATO_BD caso1_p1]`
- 11-may: $`[DATO_BD caso1_p2]` (+`[DATO_BD caso1_pre_pct]` %)
- 12-may "Hot Sale": $`[DATO_BD caso1_p3]` ("descuento" del `[DATO_BD caso1_post_pct]` %)
- Neto: `[DATO_BD caso1_neto]` %.
[SCREENSHOT_BADGE_PRECIO_REAL]

### 5/6 — Como lo medimos
Scraping diario, ventana 28-abr a 17-may, descontando inflacion. Codigo y dataset abiertos.
Metodologia completa: `[LINK_BLOG_POST]`

### 6/6 — Que hacer
Instala Precio Real (gratis, open source) y revisa cualquier producto antes de comprar:
`[LINK_CHROME_STORE]`

Si te sirvio el informe, un Cafecito ayuda: `[LINK_CAFECITO]`

---

## Version Reddit (r/argentina + r/argentinatecno)

Titulos candidatos:
- Medimos 500 productos en el Hot Sale 2026. Aca esta el ranking de los retailers que mas inflaron precios.
- Hot Sale 2026 con datos: que retailers subieron precios antes para "rebajarlos" durante el evento.
- Informe abierto: los 10 retailers que mas humo vendieron en el Hot Sale 2026.

Cuerpo: copiar las secciones 1-5 del post largo, agregar al final disclaimer "soy el creador de Precio Real, codigo abierto en GitHub, gratis, sin login, AMA en comentarios".
Crosspost manual a `r/merval`, `r/AskArgentina`, `r/devsarg` solo si se justifica por el angulo (datos / herramienta open source).

---

## Checklist de produccion (antes de publicar el 18-may)

- [ ] Correr `report-hot-sale.ts` (pendiente de implementar en `backend/scripts/`) para volcar los `[DATO_BD ...]`.
- [ ] Verificar inflacion mensual abril/mayo 2026 (INDEC o EcoGo) y citar fuente.
- [ ] Tener al menos 3 screenshots de badge de Precio Real con casos testigo reales.
- [ ] Subir CSV crudo a `[LINK_DATASET]` (Gist o R2).
- [ ] Publicar post en `landing/` (nuevo archivo `hot-sale-2026.html`) con OG image especifica.
- [ ] Lanzar thread en X coordinado con el post (mismo dia, manana 10:00 ART).
- [ ] Crosspostear a Reddit r/argentina + r/argentinatecno por la tarde (15:00 ART), responder comentarios las primeras 4 hs.
- [ ] Mandar el informe a la lista de periodistas en `docs/launch/journalist-outreach.md` con el angulo "datos abiertos sobre Hot Sale 2026".
- [ ] Reposear el thread/post el 19-may 18:00 ART para alcanzar la franja noche.

---

## Riesgos y como mitigarlos

- **Riesgo legal:** acusar nominalmente a un retailer de "trucho" puede traer carta documento. Mitigacion: hablar de "porcentaje de descuentos truchos" con definicion publica y reproducible, no de "intencion fraudulenta". Mostrar metodologia y dataset.
- **Riesgo metodologico:** que la muestra este sesgada a productos con mucha rotacion. Mitigacion: declarar el sesgo en la seccion *Limitaciones* y publicar el universo entero.
- **Riesgo de tono:** que el post se lea como marketing de Precio Real disfrazado de informe. Mitigacion: incluir contraejemplo (producto que **si** bajo de verdad), no abrir con el CTA del Chrome Store, dejar el link recien al final.
- **Riesgo de timing:** Hot Sale 2026 podria correrse de fecha. Mitigacion: confirmar fechas oficiales de CACE la semana del 5-may y, si cambian, recalcular ventana.
