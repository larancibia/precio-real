# Twitter / X — Thread de lanzamiento Precio Real

Issue de tracking: #20 (P0, M5: Launch).
Ventana sugerida de publicacion: **10-11 de mayo de 2026** (pre Hot Sale).

> Borrador editable. Reemplazar los marcadores `[VERIFICAR ...]` y `[LINK ...]` antes de publicar. Las cifras de EcoGo y los retailers especificos deben venir de los datos relevados por el backend (`backend/src/scrapers/`) y/o del informe de EcoGo citado en `docs/PR-KIT.md`.

---

## Hilo principal (8 tweets)

### 1/8 — Hook

En Argentina nos acostumbramos a una mentira: el descuento del Hot Sale.

Muchos comercios suben los precios 4-6% en las semanas previas y despues "rebajan" al valor que ya tenian. La promo es humo.

Hice una extension de Chrome gratis para detectarlo. Va hilo. ↓

### 2/8 — Que es

Se llama **Precio Real**. Es una extension de Chrome (gratis, sin registro, open source) que muestra el historial real de precios de un producto mientras navegas Mercado Libre, Fravega, Carrefour, Coto, Falabella y Garbarino.

Si el "descuento" oculta un aumento previo, te avisa.

[SCREENSHOT_1 — popup mostrando historial de precios]

### 3/8 — El dato

Segun **EcoGo**, en las semanas previas al ultimo Hot Sale los precios de los productos relevados subieron entre **4% y 6%**. `[VERIFICAR ano y categorias del informe]`

Con inflacion del [VERIFICAR cifra interanual] anual, distinguir un descuento real de uno inventado se volvio imposible a ojo.

### 4/8 — Como funciona

Cuando entras a una ficha de producto en un sitio soportado, Precio Real:

- detecta el precio actual
- lo cruza contra el historial almacenado
- muestra un badge con el precio real de las ultimas semanas
- te alerta si la "rebaja" es trucha

Todo automatico. No tenes que hacer nada.

[SCREENSHOT_2 — badge sobre ficha de producto en Mercado Libre]

### 5/8 — Que no hace

- No pide registro
- No pide email
- No pide tarjeta
- No envia datos personales a ningun lado
- No tiene tracking de terceros

Permisos minimos: `storage` y `activeTab`. Codigo auditable en GitHub.

### 6/8 — Sitios soportados (v0.2.0 — 96 e-commerce argentinos)

Los principales: Mercado Libre Argentina, Fravega, Garbarino, Falabella Argentina, Carrefour Argentina, Coto Digital, Naldo, Musimundo, Cetrogar, Megatone, Jumbo, Disco, Sodimac, Amazon Argentina, Samsung Store, LG Argentina, Lenovo Argentina, HP Tienda, CompraGamer, FullH4rd, PC Factory y 75 mas.

Lista completa en https://preciorreal.com

### 7/8 — Por que ahora

El Hot Sale arranca el **13 de mayo de 2026**. La idea es que tengas la herramienta instalada **antes** de que empiecen las "ofertas" para que la extension ya tenga historial cuando hagas click.

Cuanto antes la instales, mejores datos vas a ver.

### 8/8 — CTA

Instalar (Chrome Web Store): [LINK_CHROME_STORE]
Sitio + FAQ: https://preciorreal.com
Codigo (open source): https://github.com/larancibia/precio-real

Si te sirve, RT al primer tweet asi llega a mas gente antes del Hot Sale. Gracias 🙏

---

## Variantes de hook (para A/B)

Reemplazar el tweet 1 si el hook principal no engancha en las primeras horas:

- **Variante "data"**: "EcoGo midio que los precios suben 4-6% antes del Hot Sale. Hice una extension de Chrome para que veas el historial real de cada producto y no te coman con lo de siempre. Va hilo."
- **Variante "indignacion"**: "Te juro que estoy harto de los 'descuentos' del Hot Sale que en realidad son aumentos disfrazados. Hice algo al respecto: una extension gratis que te muestra el precio real de cada producto."
- **Variante "humilde"**: "Pase varios fines de semana haciendo esto. Es una extension gratuita que muestra el historial real de precios en MercadoLibre, Fravega, Carrefour, Coto, Falabella y Garbarino. Sirve sobre todo para Hot Sale. Va hilo:"

## Tweets de seguimiento (post-thread, durante la semana)

1. **Dia 1 +6h**: "Update: ya tenemos [N] instalaciones en las primeras horas. Si encontras un producto con un 'descuento' trucho, mandame el screenshot que lo subo al hilo." (responder al thread original)
2. **Dia 2**: "Caso real: [PRODUCTO] paso de $X a $Y los ultimos 14 dias y ahora figura con 'X% off'. Asi se ve en Precio Real:" + screenshot.
3. **Dia 3-4 (arranque Hot Sale)**: thread paralelo con top 5 retailers que mas inflaron precios pre-Hot-Sale. Tease del data report del issue #23.
4. **Post Hot Sale**: link al data report final cuando salga (issue #23, 18 de mayo).

## Hashtags sugeridos

Usar con moderacion (max 2 por tweet, mejor en el ultimo):

- `#HotSale2026`
- `#HotSale`
- `#Argentina`

Evitar saturar con hashtags genericos tipo #ofertas / #descuentos — no aportan alcance organico real en X y restan credibilidad al hilo.

## Quien etiquetar / responder

- @ecogo_ok (o handle real `[VERIFICAR]`) — la fuente del dato 4-6%, agradecimiento honesto.
- Periodistas tech ya identificados en `docs/PR-KIT.md` y issue #22 (Infobae, iProUP, La Nacion tech, Perfil tech) — no etiquetar en el thread, mejor DM en paralelo.
- Cuentas de consumo / finanzas personales argentinas con buena reputacion `[VERIFICAR lista — no caer en cuentas con reputacion mala]`.

## Checklist pre-publicacion

- [ ] Reemplazar `[LINK_CHROME_STORE]` por la URL real del Web Store (depende de issue de aprobacion).
- [x] Dominio confirmado: `preciorreal.com` (canonical en toda la landing y extension).
- [ ] Adjuntar screenshots reales (no placeholders) generados desde la extension instalada en un MLA real durante la semana previa.
- [ ] Confirmar la cifra exacta de EcoGo (ano, categoria, ventana) — ahora dice 4-6% generico.
- [x] Fecha Hot Sale 2026 confirmada: 13-15 de mayo de 2026 (CACE).
- [ ] Programar el thread en TweetDeck / Buffer para 09:00 ART de un dia laboral (martes/miercoles ideales).
- [ ] Tener listas 2-3 respuestas pre-escritas para preguntas frecuentes ("funciona en Firefox?", "es de verdad gratis?", "como saben que es trucho?").
- [ ] Avisar a contactos cercanos para tener los primeros 5-10 RT en la primera hora (algoritmo).

## Metricas a trackear (manual, primeras 72h)

- Impresiones del primer tweet
- Engagement rate del thread completo
- Click-through al link del Web Store / landing
- Instalaciones nuevas correlacionadas (ver dashboard analytics)
- Menciones organicas del producto fuera del thread

Anotar resultado en el comentario de cierre del issue #20 antes de cerrarlo manualmente.
