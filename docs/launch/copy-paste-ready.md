# Precio Real — Copys listos para publicar

Actualizado: 2026-05-09. Usar estos textos para el primer empuje de lanzamiento. No contienen placeholders ni cifras sin fuente directa.

Links:

- Landing: https://precio-real.firemandeveloper.com
- Instalar gratis: https://precio-real.firemandeveloper.com/#instalar
- Release ZIP: https://github.com/larancibia/precio-real/releases/latest
- Repo: https://github.com/larancibia/precio-real
- Kit de prensa: https://github.com/larancibia/precio-real/blob/main/docs/PR-KIT.md

Fuentes base:

- Hot Sale Argentina 2026: 11 al 13 de mayo, organizado por CACE.
- Inflacion 2025: IPC nacional INDEC, cierre anual alrededor de 31-32%.
- Producto: 101 e-commerce soportados en v0.2.4, repo publico y release publicado en GitHub.

## X / Twitter — hilo

1/8

En Argentina nos acostumbramos a una mentira: el descuento del Hot Sale.

El problema no es el cartel rojo de "30% OFF": el problema es no saber cuanto valia el mismo producto la semana pasada.

Hice una extension de Chrome gratis para detectarlo. Va hilo.

2/8

Se llama Precio Real. Es una extension de Chrome gratis, sin registro y open source que muestra el historial real de precios mientras navegas Mercado Libre, Fravega, Carrefour, Coto, Falabella, Garbarino y muchos otros e-commerce argentinos.

Si el "descuento" no mejora el precio anterior, te avisa.

3/8

El Hot Sale Argentina 2026 es del 11 al 13 de mayo, organizado por CACE.

En un pais donde 2025 cerro con inflacion anual en torno al 31-32% segun INDEC, distinguir un descuento real de uno inventado se volvio imposible a ojo.

4/8

Cuando entras a una ficha de producto en un sitio soportado, Precio Real:

- detecta el precio actual
- lo cruza contra el historial
- muestra un badge con el precio real de las ultimas semanas
- te alerta si la rebaja es humo

Todo automatico.

5/8

Privacidad:

- No pide registro
- No pide email
- No pide tarjeta
- No vende datos
- No usa tracking de terceros
- Consulta el backend con la URL pública del producto. En Mercado Libre puede enviar precio, moneda, título e imagen públicos para actualizar el historial.

Permisos minimos: storage y activeTab.
Codigo auditable en GitHub.

6/8

v0.2.4 soporta 101 e-commerce argentinos.

Principales: Mercado Libre, Fravega, Garbarino, Falabella, Carrefour, Coto, Naldo, Musimundo, Cetrogar, Megatone, Jumbo, Disco, Sodimac, Amazon Argentina, Samsung, Lenovo, HP, CompraGamer, FullH4rd y mas.

7/8

La idea es que tengas la herramienta instalada antes de que empiecen las ofertas.

Cuanto antes la uses, más tiempo tenés para revisar qué productos ya tienen historial disponible antes de comparar precios durante Hot Sale.

8/8

Instalar gratis:
https://precio-real.firemandeveloper.com/#instalar

Sitio + FAQ:
https://precio-real.firemandeveloper.com

Codigo:
https://github.com/larancibia/precio-real

Si te sirve, compartilo asi llega a mas gente antes del Hot Sale.

## Reddit r/argentina

Titulo sugerido:

Hice una extension gratis de Chrome para que no te caguen en el Hot Sale

Cuerpo:

Hola gente,

Me llamo Luis, soy desarrollador y vivo en Argentina. Hace meses que me revienta una cosa: los "descuentos" del Hot Sale que muchas veces no sabes si son descuentos reales o precios maquillados.

El problema es simple: llega el evento, te ponen un cartel rojo de "30% OFF" y vos no sabes cuanto valia ese mismo producto la semana pasada. Con la inflacion que hay, distinguir un descuento real de uno trucho a ojo es imposible.

Asi que hice Precio Real, una extension de Chrome:

- Gratis, sin registro, sin email, sin tarjeta.
- Open source, codigo en GitHub.
- Funciona en 101 e-commerce argentinos: Mercado Libre, Fravega, Garbarino, Falabella, Carrefour, Coto, Naldo, Musimundo, Cetrogar, Megatone, Jumbo, Disco, Sodimac, Amazon Argentina, Samsung, HP, Lenovo, CompraGamer, FullH4rd, PC Factory y varios mas.
- Cuando entras a una ficha de producto, te muestra el historial real de precios de las ultimas semanas.
- Permisos minimos: storage y activeTab. Nada de tracking de terceros. Consulta el backend con la URL pública del producto y, en Mercado Libre, puede enviar observaciones públicas de precio para actualizar el historial.

La hice porque queria una herramienta para mi mismo. Despues pense que si me servia a mi capaz le servia a mas gente, asi que la deje abierta.

Links:

- Instalar gratis: https://precio-real.firemandeveloper.com/#instalar
- Sitio + FAQ: https://precio-real.firemandeveloper.com
- Codigo: https://github.com/larancibia/precio-real

Feedback que me sirve:

1. Si ves un producto con descuento raro, pasame el link.
2. Si falla en algun sitio, decime cual.
3. Si falta un retailer importante, lo priorizo.

Gracias por leer. Respondo todo aca abajo.

## Reddit r/argentinatecno

Titulo sugerido:

[Open Source] Extension de Chrome para detectar descuentos truchos del Hot Sale en e-commerce argentinos

Cuerpo:

Buenas, comparto un proyecto personal por si a alguien le sirve o quiere contribuir.

Precio Real es una extension de Chrome Manifest V3 que muestra el historial real de precios de productos en e-commerce argentinos. La idea es que durante Hot Sale puedas ver si el descuento es real o si el precio actual no mejora el historial de semanas anteriores.

Stack:

- Extension MV3 con content scripts por retailer.
- Backend en Cloudflare Workers + D1.
- Scraping programado para productos populares.
- 101 e-commerce argentinos soportados en v0.2.4.
- Sin telemetria de terceros, permisos minimos: storage y activeTab.

Links:

- Instalar gratis: https://precio-real.firemandeveloper.com/#instalar
- Repo: https://github.com/larancibia/precio-real
- Sitio: https://precio-real.firemandeveloper.com

Donde me vendria una mano:

- Probar layouts raros de tiendas argentinas.
- Reportar productos donde el badge no aparece.
- Sugerir retailers con trafico real en Argentina.
- Code review sobre selectors, almacenamiento y privacidad.

Gracias.

## Pitch generico a periodistas

Asunto:

Extension argentina gratis para detectar descuentos truchos del Hot Sale

Cuerpo:

Hola,

Soy Luis Arancibia, desarrollador argentino. Lancé Precio Real, una extension gratuita y open source de Chrome que muestra el historial real de precios en e-commerce argentinos para detectar descuentos truchos durante el Hot Sale.

La idea es simple: cuando el usuario entra a una ficha de producto, la extension compara el precio actual contra el historial y muestra si la oferta realmente mejora el precio anterior o si el cartel de "OFF" es puro marketing.

Datos clave:

- Hot Sale Argentina 2026: 11 al 13 de mayo.
- 101 e-commerce soportados en v0.2.4.
- Gratis, sin registro, sin email, sin datos personales.
- Permisos minimos: storage y activeTab.
- Codigo publico en GitHub.
- Proyecto independiente, hecho por un solo desarrollador argentino.

Links:

- Landing: https://precio-real.firemandeveloper.com
- Instalar: https://precio-real.firemandeveloper.com/#instalar
- Kit de prensa: https://github.com/larancibia/precio-real/blob/main/docs/PR-KIT.md
- Repo: https://github.com/larancibia/precio-real

Quedo disponible para una entrevista corta, screenshots o casos concretos durante la semana del Hot Sale.

Gracias,
Luis Arancibia
luis@firemandeveloper.com
