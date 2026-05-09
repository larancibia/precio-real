# Kit de prensa — Precio Real

## Resumen ejecutivo

Precio Real es una extensión gratuita de Chrome que muestra el historial real de precios de cada producto en los principales e-commerce argentinos —Mercado Libre, Frávega, Carrefour, Coto, Falabella y Garbarino— para detectar aumentos disfrazados de descuentos durante el Hot Sale y otras promociones. Se apoya en datos de **EcoGo** para contextualizar los precios en una economía con inflación crónica. Es open source, hecha en Argentina y no pide registro ni datos personales.

## El problema

Argentina convive con inflación estructural: en los últimos años la suba interanual osciló entre el ~100% y el ~200% según el período `[VERIFICAR cifra exacta y ventana temporal con informe de EcoGo]`. En ese contexto, los descuentos de eventos como el Hot Sale se vuelven tramposos: muchos comercios suben los precios en las semanas previas para después "rebajarlos" al valor que ya tenían.

Según el seguimiento de **EcoGo**, en las semanas previas al Hot Sale los precios de productos relevados subieron entre **4% y 6%** `[VERIFICAR año y categorías exactas del informe EcoGo citado]`. El consumidor argentino, que ya navega una distorsión de precios permanente, queda sin herramientas simples para responder una pregunta básica: *¿esto está realmente más barato que la semana pasada?*

## Cómo funciona

Precio Real corre como extensión de Chrome (Manifest V3) y trabaja en segundo plano mientras navegás. Cuando entrás a una ficha de producto en un sitio soportado, la extensión:

1. Detecta el producto y su precio actual mediante un *content script*.
2. Cruza ese precio contra el historial almacenado y los datos de referencia de EcoGo.
3. Muestra un badge en la página con el precio histórico real, alertas si el "descuento" oculta un aumento previo, y comparativos entre tiendas.

No requiere cuenta, login ni envía datos personales. Los permisos solicitados son los mínimos necesarios: `storage` y `activeTab`.

**Sitios soportados (v0.1.0):**

- Mercado Libre Argentina
- Frávega
- Garbarino
- Falabella Argentina
- Carrefour Argentina
- Coto Digital

## Características principales

- Historial de precios real por producto en los principales e-commerce de Argentina.
- Alertas automáticas de aumentos disfrazados de descuento (típicos de Hot Sale / Cyber Monday).
- Comparador entre tiendas para un mismo producto.
- Datos de inflación de EcoGo integrados para contextualizar los precios.
- Sin registro, sin login, sin datos personales: funciona apenas la instalás.
- Open source, código auditable en GitHub.
- Hecha en Argentina, pensada para el consumidor local.
- Gratis. Soporte opcional vía Cafecito.

## Descargar

- Chrome Web Store: `[LINK_CHROME_STORE_PLACEHOLDER]`
- Repositorio: https://github.com/larancibia/precio-real
- Sitio oficial: https://preciorreal.com `[VERIFICAR dominio definitivo — el HTML referencia preciorreal.com]`

## Sobre el creador

> "Quería entender realmente cuánto cuestan las cosas en una economía con inflación crónica. En Argentina ya nos acostumbramos a que un descuento del 30% pueda significar pagar lo mismo que la semana pasada. Precio Real nació de esa frustración: una herramienta simple, sin vueltas, que te diga si el precio que estás viendo es real o humo."
> — Luis Arancibia, creador de Precio Real

`[QUOTE_CREADOR_PLACEHOLDER — Luis puede reemplazar o ajustar la cita según preferencia]`

## Screenshots

- `[SCREENSHOT_1_PLACEHOLDER]` — Captura del popup de la extensión mostrando el historial de precios.
- `[SCREENSHOT_2_PLACEHOLDER]` — Badge sobre una ficha de producto en Mercado Libre con la alerta de aumento disfrazado.
- `[SCREENSHOT_3_PLACEHOLDER]` — Gráfico de evolución de precios de un producto cruzado con el índice de inflación de EcoGo.

## Datos de contacto

- Email: `[EMAIL_PLACEHOLDER — sugerido: prensa@preciorreal.com o contacto personal de Luis]`
- Twitter / X: `[TWITTER_PLACEHOLDER]`
- Sitio web: https://preciorreal.com `[VERIFICAR dominio real]`
- GitHub: https://github.com/larancibia/precio-real

## Recursos descargables

- Logo (PNG, fondo transparente): `[LOGO_PLACEHOLDER]`
- Logo (SVG): `[LOGO_SVG_PLACEHOLDER]`
- Imagen Open Graph (1200x630): `[OG_IMAGE_PLACEHOLDER — referenciada en el HTML como https://preciorreal.com/og-image.png]`
- Iconos de la extensión (16 / 48 / 128 px): disponibles en `extension/icons/`.

---

Última actualización: 2026-05-08
