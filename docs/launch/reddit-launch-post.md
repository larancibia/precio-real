# Reddit — Posts de lanzamiento Precio Real

Issue de tracking: #21 (P0, M5: Launch).
Subreddits objetivo: **r/argentina** y **r/argentinatecno**.
Ventana sugerida de publicacion: **10-12 de mayo de 2026** (pre Hot Sale, alineado con thread de X).

> Borrador listo para publicar. Evita cifras no verificadas y vende el problema simple: sin historial no sabés si el descuento es real.

---

## Resumen del angulo

> "Hice esta extension gratis para que no te caguen en Hot Sale."

El gancho es honesto, primera persona, sin venta. Reddit AR castiga el marketing y premia el "te lo cuento porque me serviria a mi mismo". La extension es gratis, sin registro, open source y hecha por un argentino — todo eso baja al toque la sospecha de spam.

---

## r/argentina — version larga (self post)

**Reglas relevantes:** r/argentina permite self posts con proyectos personales si no son spam puro y aportan algo al sub. Evitar tono publicitario, no postear varias veces, responder en los comentarios.

### Titulo (probar 2-3, elegir el que mejor se sienta)

- Hice una extension gratis de Chrome para que no te caguen en el Hot Sale
- Me hartaron los "descuentos" truchos del Hot Sale, hice una extension gratis para detectarlos
- Extension gratis (open source) que muestra el historial real de precios en MercadoLibre, Fravega, Carrefour, Coto, Falabella y Garbarino

### Cuerpo

Hola gente,

Me llamo Luis, soy desarrollador y vivo en Argentina como casi todos los que estan leyendo esto. Hace meses que me revienta una cosa: los "descuentos" del Hot Sale que en realidad son aumentos disfrazados.

El problema es que llega el evento, te ponen un cartel rojo de "30% OFF" y muchas veces no sabés si está realmente más barato o si volvió al precio que ya tenía. Con la inflación que hay, distinguir un descuento real de uno trucho a ojo es imposible.

Asi que me puse a hacer algo al respecto. Se llama **Precio Real** y es una extension de Chrome:

- **Gratis**, sin registro, sin email, sin tarjeta.
- **Open source**, codigo en GitHub.
- Funciona en **101 e-commerce argentinos**: Mercado Libre, Fravega, Garbarino, Falabella, Carrefour, Coto, Naldo, Musimundo, Cetrogar, Megatone, Jumbo, Disco, Sodimac, Amazon Argentina, Samsung Store, HP Tienda, Lenovo, CompraGamer, FullH4rd, PC Factory y muchos mas (lista completa en precio-real.firemandeveloper.com).
- Cuando entras a una ficha de producto, te muestra el **historial real de precios** de las ultimas semanas y te avisa si el "descuento" oculta un aumento previo.
- Permisos minimos: `storage` y `activeTab`. Nada de tracking de terceros. La extensión consulta el backend con la URL pública del producto y, en Mercado Libre, puede enviar precio, moneda, título e imagen públicos para actualizar el historial.

**Como la uso yo:** la instale hace un par de semanas y reviso con tiempo qué productos ya tienen historial disponible. En Mercado Libre, las visitas también pueden sumar observaciones públicas de precio.

**Por que la hice:** queria una herramienta para mi mismo. Despues pense que si me servia a mi capaz le servia a mas gente, y como no quiero monetizar nada de esto la hice abierta. Si te sirve y queres bancar el laburo hay un Cafecito en el sitio, pero no es necesario.

**Links:**
- Instalar (gratis): https://precio-real.firemandeveloper.com/#instalar
- Sitio + FAQ: https://precio-real.firemandeveloper.com
- Codigo (open source): https://github.com/larancibia/precio-real

**Que feedback me sirve mas:**
1. Si encontras un producto con un "descuento" que es trucho, mandame el link en los comentarios — lo subo como ejemplo.
2. Si te falla en algun sitio especifico, decime cual y que producto.
3. Si queres que agregue un retailer que no esta todavia, dejalo en los comentarios y lo priorizo segun el interes.

Gracias por leer. Cualquier cosa la respondo aca abajo.

**Edit (post-publicacion, completar despues):** [LINK al thread en X / a otros posts si correspond]

---

## r/argentinatecno — version corta (audiencia mas tecnica)

**Reglas relevantes:** sub mas chico, mas tolerante a self promo si el producto es honestamente tech y open source. Aclarar el stack en el cuerpo suma credibilidad.

### Titulo

- [Open Source] Extension de Chrome para detectar descuentos truchos del Hot Sale en e-commerce argentinos
- Hice una extension MV3 (open source) que muestra el historial real de precios en los principales e-commerce de AR

### Cuerpo

Buenas, comparto un proyecto personal por si a alguien le sirve o quiere contribuir.

**Que es:** Precio Real, una extension de Chrome (Manifest V3) que muestra el historial real de precios de productos en los principales e-commerce argentinos. La idea es que durante el Hot Sale puedas ver si el "descuento" es real o si subieron el precio dos semanas antes.

**Stack rapido:**
- Extension: Manifest V3, content scripts por retailer (`extension/content/`), retailer config en `extension/utils/retailers.js`.
- Backend: cron que descubre los top 500 productos populares de MLA y refresca precios periodicamente (`backend/src/scrapers/`).
- Sitios soportados v0.2.4: 101 e-commerce argentinos (lista completa en https://precio-real.firemandeveloper.com).
- Sin telemetria de terceros, permisos minimos (`storage`, `activeTab`).

**Por que lo abri:**
- No quiero monetizar (hay un Cafecito opcional pero nada mas).
- Quiero que cualquiera pueda auditar exactamente qué datos manda la extensión al backend.
- Si alguien quiere contribuir un retailer nuevo, los selectors viven en `extension/utils/retailers.js` — el README tiene una seccion para agregar uno.

**Links:**
- Instalar (gratis): https://precio-real.firemandeveloper.com/#instalar
- Repo: https://github.com/larancibia/precio-real
- Sitio: https://precio-real.firemandeveloper.com

**Donde me vendria una mano:**
- Probar la extension en sitios que tengan layouts raros (paginas de campanas, listings, busquedas) y reportar issues.
- Sugerencias de retailers a sumar (criterio: trafico real en AR + selectors estables).
- Code review honesto, especialmente sobre el modelo de almacenamiento y la deteccion de variantes.

Gracias.

---

## Variantes de hook (si no engancha el principal)

- **Variante "data"**: "El Hot Sale arranca el 11 de mayo y van a aparecer miles de carteles de OFF. Hice una extension gratis para ver el historial real y no comprar humo."
- **Variante "indignacion"**: "Me canse de los descuentos truchos del Hot Sale. Hice una extension de Chrome gratis y open source para detectarlos."
- **Variante "humilde"**: "Pase varios fines de semana en esto. Es una extension gratis que muestra el historial real de precios en los principales e-commerce de AR. Sirve sobre todo para Hot Sale."

## Reglas de oro para no comer ban / downvote

- **No cross-postear** entre r/argentina y r/argentinatecno con el mismo titulo y mismo cuerpo. Adaptar (es lo que hace este doc).
- **No postear varias veces el mismo proyecto en una semana** en el mismo sub.
- **Responder TODOS los comentarios las primeras 6 horas** — Reddit premia el engagement temprano.
- **No borrar comentarios criticos** salvo que sean ataques personales. Responder con humildad mata el hate.
- **No pedir upvotes explicitamente** en el post (se castiga). Si se puede pedir feedback.
- **Flair correcto**: en r/argentina probablemente "Tecnologia" o "Pregunta"; en r/argentinatecno probablemente "Proyecto" o "Open Source" segun lo que tenga el sub.
- **Mod-friendly**: si un mod pide bajar el post, bajarlo y preguntar como repostearlo bien. No discutir.

## Tweets / posts de seguimiento (post-publicacion)

1. **+6h**: edit al post original con un "Update: ya hay [N] instalaciones" si vale la pena.
2. **+24h**: si hay buenos casos en los comentarios (productos con descuentos truchos), armar un comentario "top" en el mismo thread mostrandolos.
3. **Inicio del Hot Sale**: nuevo post (otro angulo: "Top 5 productos que mas inflaron el precio antes del Hot Sale"), referenciar el data report del issue #23.
4. **Post Hot Sale**: comentario de cierre en el thread original con el link al data report final cuando salga.

## Checklist pre-publicacion

- [x] Link: https://precio-real.firemandeveloper.com/#instalar (GitHub releases). Actualizar a CWS URL cuando se apruebe.
- [x] Dominio confirmado: `precio-real.firemandeveloper.com` (canonical en toda la landing y extension).
- [x] Fecha Hot Sale 2026 confirmada: 11-13 de mayo de 2026 (CACE).
- [ ] Tener cuenta de Reddit con karma minimo (si la cuenta es nueva, los mods de r/argentina suelen mandar al filtro automatico).
- [ ] Postear en horario de alto trafico AR: **20:00-23:00 ART de un dia laboral** (martes/miercoles ideales para tech, jueves bien para r/argentina).
- [ ] Tener listo un comentario propio fijo (sticky) con el TL;DR + links — los redditors no leen el cuerpo entero, leen el primer comentario.
- [ ] Avisar a 2-3 contactos para tener los primeros upvotes en la primera media hora (algoritmo).
- [ ] Tener listas 3-5 respuestas pre-escritas: "funciona en Firefox?", "es de verdad gratis?", "como se que no me roba datos?", "por que no Edge / Brave / Opera?", "se viene la app mobile?".
- [ ] No publicar ambos subs el mismo dia: separar al menos 24h y adaptar titulo/cuerpo.

## Metricas a trackear (manual, primeras 72h)

- Upvotes y ratio (upvote ratio < 0.7 es senal de alarma).
- Cantidad de comentarios.
- Click-through al Web Store / landing.
- Instalaciones nuevas correlacionadas (ver dashboard analytics).
- Menciones organicas del producto fuera de los threads.

Anotar resultado en el comentario de cierre del issue #21 antes de cerrarlo manualmente.
