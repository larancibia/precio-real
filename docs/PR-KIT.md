# Kit de prensa — Precio Real

## Resumen ejecutivo

Precio Real es una extensión gratuita de Chrome que muestra historial de precios cuando hay datos públicos suficientes en e-commerce argentinos configurados —Mercado Libre, Frávega, Amazon Argentina, Carrefour, Coto, Falabella, Garbarino y decenas de tiendas más (101 en total)— para detectar aumentos disfrazados de descuentos durante el Hot Sale y otras promociones. La cobertura varía por producto, frescura y retailer. Es open source, hecha en Argentina y no pide registro ni datos personales.

## El problema

Argentina convive con inflación estructural: 2025 cerró con una inflación acumulada de **31,5%** según el IPC nacional de INDEC. En ese contexto, los descuentos de eventos como el Hot Sale se vuelven difíciles de evaluar a simple vista: muchos consumidores no tienen una referencia clara de cuánto valía el mismo producto días o semanas antes.

El consumidor argentino, que ya navega una distorsión de precios permanente, queda sin herramientas simples para responder una pregunta básica: *¿esto está realmente más barato que la semana pasada?*

## Cómo funciona

Precio Real corre como extensión de Chrome (Manifest V3) y trabaja en segundo plano mientras navegás. Cuando entrás a una ficha de producto en un sitio soportado, la extensión:

1. Detecta el producto y su precio actual mediante un *content script*.
2. Consulta el backend con la URL pública del producto (`GET /api/price`) para traer el historial almacenado.
3. En Mercado Libre, puede enviar una observación (`POST /api/observe`) con URL, precio, moneda, título e imagen pública cuando están disponibles.
4. Muestra un badge en la página con historial disponible, alertas si el "descuento" oculta un aumento previo, y comparativos entre tiendas cuando hay datos suficientes.

No requiere cuenta, login ni envía datos personales. Los permisos solicitados son los mínimos necesarios: `storage` y `activeTab`.

**Sitios configurados (v0.2.4) — 101 e-commerce argentinos, con cobertura y frescura variables:**

Mercado Libre Argentina, Frávega, Garbarino, Falabella Argentina, Carrefour Argentina, Coto Digital, Naldo, Musimundo, Cetrogar, Megatone, Día Online, Jumbo, Disco, Sodimac, Easy, Hendel, Rodo, Ribeiro, Compumundo, Samsung Store, LG Argentina, Sony Store, Philips Argentina, BGH, Noblex, Whirlpool, Changomás, Electrolux, Drean, Motorola Store, Todomodo, Amazon Argentina, HiperTehno, Xiaomi Mi Store, Philco Argentina, Venex, BGood, HP Tienda, Lenovo Argentina, Alphatec, Exo, Hisense Argentina, TCL Argentina, Pycca, Newsan, Asus Store Argentina, Mac Center, Full, Micro Center, iPoint, Acer Store, Coolbox, Olimpo, Dexter, TGC, Maxiconsumo, FullH4rd, Start Tech PC, PC House, Zetta, Geek Store, Computodo, MaxiHogar, PC Factory, CompraGamer, Golden Shop, Soluciones, Arredondo, iThink, Nexstore, Cable Hogar, Bit, Digital Haus, InStore, Staples, Gotta, Power Planet, iGaming Store, Netizar, MegaStore, Century Tech, Klibr, Lazer, PC Arg, Carsa, GrupoDIN, Coppel, Megatronics, Mac Station, Winpy, GearZone, Binario, CompuPC, Autronic, Megatrix y Pixelstore.

## Características principales

- Historial de precios por producto cuando hay datos públicos suficientes.
- Alertas automáticas de aumentos disfrazados de descuento (típicos de Hot Sale / Cyber Monday).
- Comparador entre tiendas para un mismo producto.
- Contexto de inflación local para interpretar variaciones de precio sin confundirlas con descuentos reales.
- Sin registro, sin login, sin datos personales: funciona apenas la instalás.
- Open source, código auditable en GitHub.
- Hecha en Argentina, pensada para el consumidor local.
- Gratis. Soporte opcional vía Cafecito.

## Descargar

- Instalar (gratis): https://precio-real.firemandeveloper.com/#instalar (GitHub releases, activo)
- Chrome Web Store: pendiente de aprobación — ZIP v0.2.4 listo, submission en proceso
- Repositorio: https://github.com/larancibia/precio-real
- Sitio oficial: https://precio-real.firemandeveloper.com

## Sobre el creador

> "Quería entender realmente cuánto cuestan las cosas en una economía con inflación crónica. En Argentina ya nos acostumbramos a que un descuento del 30% pueda significar pagar lo mismo que la semana pasada. Precio Real nació de esa frustración: una herramienta simple, sin vueltas, que te diga si el precio que estás viendo es real o humo."
> — Luis Arancibia, creador de Precio Real


## Screenshots

> Pendiente: adjuntar capturas reales tomadas con la extensión instalada en un producto de MLA.
- Screenshot 1 — popup mostrando historial de precios (tomar en Fravega / MLA, producto con variación visible)
- Screenshot 2 — badge sobre ficha de producto en Mercado Libre con la alerta de aumento disfrazado
- Screenshot 3 — gráfico de evolución de precios cruzado con inflación

Enviar por mail junto al pitch al periodista si lo solicita; no adjuntar en el primer contacto.

## Datos de contacto

- Email: luis@firemandeveloper.com
- Twitter / X: @preciorreal_ar
- Sitio web: https://precio-real.firemandeveloper.com
- GitHub: https://github.com/larancibia/precio-real

## Recursos descargables

- Logo (SVG): `extension/icons/icon.svg` (o usar favicon.svg del landing)
- Imagen Open Graph (1200x630): https://precio-real.firemandeveloper.com/og-image.png
- Iconos de la extensión (16 / 48 / 128 px): disponibles en `extension/icons/`.

## Fuentes verificadas

- Hot Sale Argentina 2026: 11 al 13 de mayo, organizado por CACE.
- Inflación 2025: IPC nacional INDEC, cierre anual 31,5%.
- Datos propios del producto: 101 e-commerce configurados en `extension/manifest.json`, release público v0.2.4 en GitHub; ver política en `docs/PUBLIC-DATA-QUALITY-POLICY.md`.

---

Última actualización: 2026-05-09 (ciclo 1635 — 101 retailers, lista completa sincronizada con manifest v0.2.4)
