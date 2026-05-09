# DM / pitch a periodistas tech — Precio Real

Issue de tracking: #22 (P1, M5: Launch).
Ventana sugerida de envio: **10-12 de mayo de 2026** (pre Hot Sale, en paralelo al thread de X #20 y al post de Reddit #21).

> Borrador editable. Reemplazar los marcadores `[VERIFICAR ...]`, `[LINK ...]` y los datos personales de cada periodista antes de enviar. Cifras y citas tienen que coincidir con `docs/PR-KIT.md` y `docs/launch/twitter-thread-launch.md`.

---

## Estrategia general

- **Objetivo**: conseguir 2-3 notas pre Hot Sale en medios tech argentinos con angulo "consumidor + inflacion + open source", no review tecnica.
- **Canal preferido por target**: email > DM en X / LinkedIn > formulario de redaccion. El DM funciona como warm-up cuando ya hay hilo de X publicado y el periodista interactuo (like/RT). Si no, ir directo por email.
- **Tono**: corto, directo, primera persona, una sola pregunta clara. No adjuntar PDFs ni decks. Linkear al kit de prensa publico (`docs/PR-KIT.md` -> rendereado en el repo) y a la landing.
- **Reglas**:
  - Un solo medio por persona (no spam masivo con CC oculto).
  - Personalizar el primer parrafo con una nota reciente del periodista sobre consumo / e-commerce / inflacion.
  - Nada de `[VERIFICAR]` en el mensaje final — todos los datos confirmados antes de enviar.
  - Seguimiento unico a las 72h si no hay respuesta. Despues, archivar.

---

## Lista de targets (priorizada)

| # | Medio | Seccion | Periodista candidato | Canal preferido | Angulo |
|---|-------|---------|---------------------|-----------------|--------|
| 1 | **Infobae** | Tecno / Economia | `[VERIFICAR — confirmar firma actual de seccion tecno y consumo]` | Email redaccion + DM en X | Consumidor + inflacion, dato de EcoGo |
| 2 | **iProUP** | Innovacion / Apps | `[VERIFICAR — periodista que cubre apps argentinas]` | Email + LinkedIn | Producto argento, open source, Hot Sale |
| 3 | **La Nacion** | Tecnologia / Economia personal | `[VERIFICAR — firma de seccion tecno o economia domestica]` | Email | Inflacion + herramienta para el consumidor |
| 4 | **Perfil** | Tecnologia | `[VERIFICAR — firma de seccion tecno]` | Email | Hot Sale + transparencia de precios |
| 5 | **Clarin** (bonus si entra) | Economia / Pyme | `[VERIFICAR]` | Email | Consumidor + inflacion |
| 6 | **TN Tecno** (bonus si entra) | Apps / Internet | `[VERIFICAR]` | Email + DM | Hot Sale + extension gratis |

> Antes de enviar: cruzar con `docs/PR-KIT.md` para asegurar que los handles, cifras y links estan actualizados. Si no se logra confirmar la firma actual de un medio en menos de 10 min, mandar al email general de redaccion (`redaccion@medio.com` o `tecno@medio.com`) con el subject estandar y el cuerpo "media generalista".

---

## Plantillas

### Plantilla A — Email cold (medio generalista, sin contacto previo)

**Subject**: Extension argentina gratis para detectar "descuentos" truchos del Hot Sale (open source)

**Cuerpo**:

Hola [NOMBRE],

Lei tu nota sobre [TEMA RECIENTE — consumo / e-commerce / inflacion / Hot Sale] y me parecio que esto te puede interesar.

Soy Luis Arancibia, desarrollador. Hice **Precio Real**, una extension de Chrome gratuita y open source que muestra el historial real de precios de los productos en Mercado Libre, Fravega, Carrefour, Coto, Falabella y Garbarino. La idea es que el consumidor pueda detectar los "descuentos" del Hot Sale que en realidad son aumentos disfrazados.

El angulo es bastante argento:
- Segun EcoGo, en las semanas previas al ultimo Hot Sale los precios subieron entre **4% y 6%** antes de las "rebajas" `[VERIFICAR ano y categorias del informe]`.
- La extension corre local, no pide registro ni datos personales, y el codigo esta auditable en GitHub.
- Esta hecha por un solo desarrollador argentino. No hay empresa ni fondeo detras.

Si te sirve, te dejo:
- Landing + FAQ: https://precio-real.firemandeveloper.com
- Chrome Web Store: [LINK_CHROME_STORE]
- Kit de prensa (cifras, screenshots, logos): https://github.com/larancibia/precio-real/blob/main/docs/PR-KIT.md
- Repo: https://github.com/larancibia/precio-real

Quedo a disposicion para una entrevista corta o para mandarte capturas concretas con casos reales del Hot Sale en vivo (puedo armar comparativos por retailer durante la semana de la promo).

Gracias por el tiempo,
Luis Arancibia
ale.larancibia@gmail.com
@preciorreal_ar

---

### Plantilla B — Email warm (ya hubo interaccion en X o se conocen)

**Subject**: Te paso esto por las dudas — extension gratis para Hot Sale

**Cuerpo**:

Hola [NOMBRE], como va.

Te tiro corto: lance **Precio Real**, una extension de Chrome gratis y open source que muestra el historial real de precios en los principales e-commerce argentinos para detectar "descuentos" truchos del Hot Sale.

El dato fuerte: EcoGo midio que los precios suben **4-6%** las semanas previas al Hot Sale `[VERIFICAR]`. La extension cruza eso con el historial real y avisa cuando la rebaja es humo.

Si te sirve para una nota, links y kit de prensa aca:
- Landing: https://precio-real.firemandeveloper.com
- Web Store: [LINK_CHROME_STORE]
- Kit prensa: https://github.com/larancibia/precio-real/blob/main/docs/PR-KIT.md

Cualquier cosa que necesites (entrevista, screenshots especificos, datos por retailer durante el Hot Sale) me decis.

Abrazo,
Luis

---

### Plantilla C — DM en X / LinkedIn

(maximo ~600 caracteres, sin links largos en el primer mensaje)

> Hola [NOMBRE], te leo seguido en [MEDIO]. Lance Precio Real, una extension de Chrome gratis y open source que muestra el historial real de precios en MercadoLibre, Fravega, Carrefour, Coto, Falabella y Garbarino — pensada para detectar los "descuentos" truchos del Hot Sale (EcoGo midio que suben 4-6% antes de las rebajas). Si te sirve para una nota, te paso el kit de prensa por DM o mail. Gracias!

Si responde con interes, mandar Plantilla A o B por el canal que el periodista prefiera.

---

### Plantilla D — Seguimiento unico (72h despues, solo si no hubo respuesta)

**Subject**: Re: [SUBJECT ORIGINAL]

**Cuerpo**:

Hola [NOMBRE],

Te escribia por las dudas del mail anterior sobre **Precio Real** (extension gratis para detectar descuentos truchos del Hot Sale, dato de EcoGo 4-6%). Si no es para vos no hay drama, lo dejo aca y no molesto mas.

Si te interesa pero no es el momento, escribime cuando puedas y te armo lo que necesites.

Gracias igual,
Luis

---

## Bullet points para periodistas (copy/paste)

Para tener a mano si el periodista pide "mandame los datos clave en bullets":

- Que es: extension de Chrome gratuita y open source que muestra historial real de precios en e-commerce argentinos.
- Sitios soportados (v0.2.1): 96 e-commerce argentinos (lista completa en https://precio-real.firemandeveloper.com).
- Dato fuerte: EcoGo midio aumentos de 4-6% las semanas previas al Hot Sale `[VERIFICAR ano/categorias]`. La extension cruza eso con el historial real y alerta cuando la "rebaja" es trucha.
- Privacidad: corre local, no pide registro ni email, no envia datos personales. Permisos minimos (`storage`, `activeTab`).
- Modelo: gratis, sin ads, sin tracking. Soporte opcional via Cafecito.
- Codigo: open source, auditable en https://github.com/larancibia/precio-real.
- Creador: Luis Arancibia, desarrollador argentino, proyecto solo. Sin empresa ni fondeo.
- Disponibilidad: Chrome Web Store (pendiente de aprobación — ZIP v0.2.1 listo), Hot Sale 2026: 11 al 13 de mayo.

---

## Quotes listas para citar

- **Sobre el problema**: "En Argentina ya nos acostumbramos a que un descuento del 30% pueda significar pagar lo mismo que la semana pasada. Precio Real nacio de esa frustracion."
- **Sobre el producto**: "No quiero que el consumidor argentino dependa de su memoria o de planillas de Excel para saber si una promo es real. La extension hace ese trabajo automaticamente."
- **Sobre privacidad**: "No pido email, no pido tarjeta, no pido cuenta. La extension corre en tu maquina y el codigo esta publico. Si no me crees, abri el repo."
- **Sobre el modelo**: "Es gratis y va a seguir siendo gratis. Si a alguien le sirve y quiere bancar el desarrollo, hay un Cafecito. Nada mas."

---

## Checklist pre-envio

- [ ] Confirmar firma actual de cada periodista del listado (no enviar a redacciones genericas si se pudo identificar firma).
- [ ] Personalizar el primer parrafo con una nota reciente real del periodista (no inventar).
- [ ] Reemplazar todos los `[VERIFICAR]`, `[LINK_CHROME_STORE]`, `[NOMBRE]`, `ale.larancibia@gmail.com`, `@preciorreal_ar`.
- [x] Dominio confirmado: `precio-real.firemandeveloper.com` (canonical en toda la landing y extension). Deploy listo en Cloudflare Pages (#29).
- [ ] Confirmar que el link al Chrome Web Store funciona y muestra la extension publicada.
- [ ] Confirmar la cifra exacta de EcoGo (ano, categoria, ventana). Si no se logra confirmar, remover el dato y dejar el angulo cualitativo.
- [ ] Tener 3 screenshots reales listos para mandar como adjuntos cuando el periodista los pida (no en el primer mail).
- [ ] Tener disponibilidad para entrevista en las 48h siguientes al envio (idealmente video corto en zoom / google meet).

---

## Tracking

Llevar planilla simple (Notion / sheet) con columnas:

- Medio
- Periodista
- Canal usado
- Fecha de envio
- Plantilla usada (A / B / C)
- Estado (enviado / leido / respondido / publicado / sin respuesta)
- Link de la nota (si publica)
- Notas internas

Actualizar el issue #22 con el resultado final (cuantos contactados, cuantos respondieron, cuantas notas publicadas) antes de cerrarlo manualmente.

---

## Reglas de no hacer

- No enviar el mismo correo a varios medios con CC / BCC oculto.
- No adjuntar PDFs pesados ni decks. Todo en links publicos.
- No pedir embargo (no tiene sentido para este lanzamiento).
- No insistir mas de una vez si no hay respuesta.
- No tirar datos sin verificar (la cifra de EcoGo va con `[VERIFICAR]` hasta confirmar).
- No prometer features que no existen aun (Firefox, mas retailers, app mobile).
- No mentir sobre la escala: es un proyecto solo, sin empresa, sin fondeo. Eso suma — no resta.

---

Ultima actualizacion: 2026-05-09
