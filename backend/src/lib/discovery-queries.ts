/**
 * Shared list of MLA discovery / seed queries.
 *
 * Used by:
 *   - src/scrapers/discovery.ts  (cron)        → LIMIT_PER_QUERY = 20
 *   - scripts/seed.ts            (local dev)   → LIMIT_PER_QUERY = 10
 *
 * Single source of truth so the local seed and the production cron always hit
 * the same Hot-Sale-flagship vertical mix. Add new categories here only.
 */

export const DISCOVERY_QUERIES: readonly string[] = [
  // Tech / electronics
  "celular",
  "notebook",
  "televisor",
  "auriculares",
  "smart tv",
  "smartwatch",
  "tablet",
  "monitor",
  "playstation",
  "xbox",
  "consola",
  "nintendo switch",
  "camara",
  "parlante bluetooth",
  "impresora",
  "auriculares inalambricos",
  "drone",
  "ssd",
  "memoria ram",
  "router wifi",
  "joystick",
  // Línea blanca / electrodomésticos
  "heladera",
  "lavarropas",
  "lavavajillas",
  "aire acondicionado",
  "cafetera",
  "microondas",
  "freidora de aire",
  "aspiradora",
  "ventilador",
  "anafe",
  "secarropas",
  "termotanque",
  "horno electrico",
  "licuadora",
  "batidora",
  "procesadora",
  "sandwichera",
  "pava electrica",
  "tostadora",
  "freezer",
  "secador de pelo",
  "plancha de pelo",
  "purificador de aire",
  // Hogar / muebles
  "colchon",
  "sillon",
  "escritorio",
  "silla gamer",
  "termo",
  // Deportes / outdoor
  "bicicleta",
  "monopatin electrico",
  "zapatillas",
  "pelota",
  "carpa",
  "mochila",
  // Moda / belleza
  "perfume",
  "reloj",
  "campera",
  // Infantil
  "juguetes",
  "auto a bateria",
  "cuna",
  "cochecito",
  // Fitness / gym
  "bicicleta fija",
  "cinta de correr",
  "pesas",
  "colchoneta yoga",
  // Mascotas
  "alimento perro",
  "alimento gato",
  "comedero automatico",
  // Auto / moto
  "bateria auto",
  "gps auto",
  "casco moto",
  "silla auto bebe",
  // Herramientas / DIY
  "taladro",
  "amoladora",
  "sierra circular",
  "compresor de aire",
  // Hogar adicional
  "sommier",
  "silla de oficina",
  "lampara led",
  "alarma casa",
  // Tech adicional
  "notebook gamer",
  "camara de seguridad",
  "robot aspiradora",
  "disco rigido externo",
  "mouse gamer",
  "teclado mecanico",
  "webcam",
  // Climatización
  "calefactor",
  "estufa electrica",
  // Bebés / puericultura
  "silla de comer bebe",
  "andador bebe",
  // Fitness adicional
  "eliptica",
  // Electrohogar adicional
  "caloventor",
  "purificador agua",
  // Hogar inteligente / smart home
  "parlante inteligente",
  "lampara inteligente",
  "enchufe inteligente",
  "timbre con camara",
  // Gaming / accesorios
  "silla gamer reclinable",
  "auriculares gamer",
  "monitor gamer",
  "control xbox",
  // Oficina / estudio
  "silla ergonomica",
  "soporte notebook",
  "hub usb",
  "disco solido",
  // Cuidado personal
  "afeitadora electrica",
  "depiladora",
  "cepillo dental electrico",
  // Nutricion / salud
  "proteina whey",
  "suplemento deportivo",
  // Audio / video
  "barra de sonido",
  "proyector",
  "vinilo parlante",
  "camara gopro",
  // Hot Sale 2026 — Apple / premium brand flagships
  "iphone",
  "ipad",
  "apple watch",
  "macbook",
  // Hot Sale 2026 — movilidad eléctrica
  "moto electrica",
  "bicicleta electrica",
  // Hot Sale 2026 — ropa / moda deportiva
  "zapatillas running",
  "zapatillas nike",
  "zapatillas adidas",
  // Hot Sale 2026 — conectividad / trabajo remoto
  "ups para pc",
  "adaptador usb c",
  // Hot Sale 2026 — hogar inteligente adicional
  "cerradura inteligente",
  "camara ip wifi",
  // Hot Sale 2026 — audio premium
  "auriculares noise cancelling",
  "auriculares sony",
  // Hot Sale 2026 — marcas phones (alta rotación en landing pages de HS)
  "samsung galaxy",
  "xiaomi celular",
  "motorola celular",
  "realme celular",
  // Hot Sale 2026 — TV por marca (top vendidos en electrodomésticos HS)
  "samsung smart tv",
  "lg smart tv",
  "tcl televisor",
  // Hot Sale 2026 — notebooks por marca
  "lenovo notebook",
  "hp notebook",
  "dell notebook",
  "asus notebook",
  // Hot Sale 2026 — electrodomésticos premium
  "dyson aspiradora",
  "roomba",
  "philips airfryer",
  // Hot Sale 2026 — gaming hardware
  "nvidia rtx",
  "procesador intel",
  "procesador amd ryzen",
  // Hot Sale 2026 — audio / foto adicional
  "camara sony",
  "camara canon",
  "lente camara",
  // Hot Sale 2026 — indumentaria deportiva adicional
  "zapatillas puma",
  "zapatillas under armour",
  "ropa deportiva",
  // Hot Sale 2026 — modelos específicos phones (alta conversión en búsquedas directas)
  "iphone 16",
  "iphone 15",
  "samsung galaxy s24",
  "samsung galaxy a55",
  "motorola edge 50",
  "xiaomi redmi note",
  // Hot Sale 2026 — TVs por pulgadas (categoría top HS)
  "smart tv 55 pulgadas",
  "smart tv 65 pulgadas",
  "smart tv 43 pulgadas",
  // Hot Sale 2026 — notebooks gamer por marca
  "lenovo legion",
  "asus rog",
  "msi notebook",
  // Hot Sale 2026 — accesorios tech de alta rotación
  "cargador inalambrico",
  "cable usb c",
  "funda celular",
  "vidrio templado celular",
  // Hot Sale 2026 — electrodomésticos de cocina premium
  "cafetera nespresso",
  "cafetera dolce gusto",
  "licuadora oster",
  "olla arrocera",
  // Hot Sale 2026 — climatización residencial
  "aire acondicionado split",
  "ventilador de torre",
  "purificador de aire hepa",
  // Hot Sale 2026 — hogar / decoración
  "lampara de pie",
  "ventilador de techo",
  "cortina roller",
  // CyberMonday Argentina Nov 2026 — electrónica de alta rotación
  "iphone 17",
  "samsung galaxy s25",
  "samsung galaxy a56",
  "motorola edge 60",
  "xiaomi 15",
  "tablet samsung",
  "ipad pro",
  // CyberMonday Nov 2026 — gaming (temporada fuerte post-Hot-Sale)
  "playstation 5",
  "ps5 consola",
  "xbox series x",
  "nintendo switch oled",
  "joystick ps5",
  "silla gamer rgb",
  // CyberMonday Nov 2026 — audio / entretenimiento
  "soundbar samsung",
  "airpods",
  "jbl parlante",
  "headset gamer",
  // CyberMonday Nov 2026 — computación
  "notebook acer",
  "computadora de escritorio",
  "monitor 4k",
  "teclado gaming",
  "mouse inalambrico",
  // CyberMonday Nov 2026 — electro / línea blanca (verano austral)
  "ventilador split",
  "aire portatil",
  "heladera no frost",
  "lavarropas inverter",
  "microondas con grill",
  // CyberMonday Nov 2026 — movilidad y outdoor
  "bicicleta mtb",
  "monopatin xiaomi",
  "mochila notebook",
  "cámara acción",
  // CyberMonday Nov 2026 — smart home / IoT
  "smart speaker alexa",
  "chromecast",
  "strip led inteligente",
  "termostato inteligente",
  // Categorías sin cobertura — alta rotación en Hot Sale / CyberMonday
  // Música / instrumentos
  "guitarra electrica",
  "teclado piano",
  "auriculares estudio",
  // Jardín / exterior / piscina
  "pileta inflable",
  "silla de jardin",
  "parrilla electrica",
  "asador a gas",
  // Material escolar / oficina
  "mochila escolar",
  "lapicera parker",
  "calculadora cientifica",
  // Repuestos y accesorios celular
  "bateria celular repuesto",
  "pantalla celular",
  "auriculares tipo c",
  // Salud / bienestar
  "tensiómetro digital",
  "oximetro",
  "bascula digital",
  "masajeador electrico",
  // Cocina / vajilla
  "olla a presion",
  "set cuchillos",
  "tabla de picar",
  "juego de vasos",
  // Bebés adicional
  "monitor bebe wifi",
  "silla booster bebe",
  // Viaje / turismo
  "maleta de viaje",
  "candado tsa",
  "almohada de viaje",
  // Ciclo 1607 — categorías faltantes y alta rotación 2026
  // Carga portátil / powerbank
  "powerbank",
  "cargador portatil",
  "bateria portatil celular",
  // Streaming / dispositivos TV
  "fire tv stick",
  "apple tv",
  "proyector portatil",
  "smart tv 4k uhd",
  // Impresión 3D / maker
  "impresora 3d",
  "filamento pla impresora",
  // Conectividad / redes
  "repetidor wifi",
  "access point wifi",
  // Videojuegos físicos — alta rotación post-lanzamiento
  "juego ps5",
  "juego nintendo switch",
  // Moda / indumentaria específica
  "remera deportiva",
  "ropa termica",
  "buzo hoodie",
  // Cámara / creación de contenido
  "camara instantanea",
  "gimbal estabilizador celular",
  // Auto adicional
  "dashcam auto",
  "soporte celular auto",
  // Salud / bienestar adicional
  "glucometro",
  "nebulizador",
  "humidificador ultrasonico",
  // Gaming periféricos
  "capturadora hdmi",
  "pad mouse gamer xl",
  // Trabajo remoto / oficina adicional
  "standing desk",
  "soporte monitor brazo",
  // Fitness adicional
  "smartwatch amazfit",
  "pesa rusa",
  "rueda abdominales",
  // Almacenamiento / computación específico
  "disco nvme m2",
  "memoria micro sd",
  // Accesorios celular marca
  "auriculares samsung galaxy buds",
  "cargador inalambrico samsung",
  // Ciclo 1606 — categorías nuevas sin cobertura previa
  // Instrumentos musicales adicional
  "bajo electrico",
  "bateria electronica",
  "ukulele",
  // Energía solar / renovable
  "panel solar portatil",
  "bateria litio recargable",
  // Mascotas — accesorios faltantes
  "correa perro retractil",
  "transportin mascotas",
  "juguetes para perros",
  // Ropa bebé / niños
  "ropa bebe recien nacido",
  "zapatillas nenas",
  "mochila escolar primaria",
  // Fitness / wearables adicional
  "garmin forerunner",
  "mancuernas ajustables",
  "barra dominadas",
  // Hogar / iluminación
  "espejo led baño",
  "lampara escritorio led",
  "foco led smart",
  // Accesorios hogar tech
  "medidor consumo electrico",
  "enchufe inteligente wifi",
  // Ciclo 1610 — electrónica portátil / gaming de alta conversión
  "auriculares true wireless",
  "joystick bluetooth",
  "cargador rapido usb c",
  "notebook core i5",
  "notebook core i7",
  "ssd nvme 1tb",
  // Ciclo 1610 — línea blanca marcas premium (alta rotación HS/CM)
  "heladera samsung",
  "lavarropas samsung",
  "lavarropas whirlpool",
  "aire acondicionado inverter",
  "aire acondicionado samsung",
  // Ciclo 1610 — TV marcas adicionales y formatos
  "smart tv 50 pulgadas",
  "smart tv 75 pulgadas",
  "smart tv oled",
  "smart tv qled",
  // Ciclo 1610 — celulares específicos 2026
  "motorola razr",
  "samsung galaxy z flip",
  "iphone 16 pro",
  "xiaomi poco",
  // Ciclo 1610 — hogar / muebles de oficina
  "silla de escritorio",
  "escritorio de madera",
  // Ciclo 1610 — outdoor / verano
  "sombrilla playa",
  "reposera de playa",
  "ventilador de pie",
  // Ciclo 1611 — otoño/invierno Argentina (mayo-agosto)
  "calefactor a gas",
  "estufa catalítica",
  "estufa infrarroja",
  "calefactor por aceite",
  "manta electrica",
  "frazada electrica",
  "campera de pluma",
  "campera impermeable",
  "botas de invierno mujer",
  "calzado de invierno",
  "medias termicas",
  "ropa termica interior",
  // Ciclo 1611 — gaming / tech 2025-2026 nuevos lanzamientos
  "nintendo switch 2",
  "steam deck",
  "meta quest 3",
  "apple vision pro",
  "lentes vr",
  // Ciclo 1611 — accesorios tech faltantes
  "ups para router",
  "switch hdmi 4k",
  "hub thunderbolt",
  "base carga inalambrica magsafe",
  "stylus tablet",
  "lapiz apple pencil",
  // Ciclo 1611 — hogar / confort
  "almohada cervical viscoelastica",
  "colcha nordica",
  "sabanas 300 hilos",
  "purificador de agua osmosis",
  // Ciclo 1612 — nuevos retailers: Hisense AR, TCL AR, Pycca
  // Hisense AR (VTEX): aires acondicionados, TVs, heladeras
  "hisense aire acondicionado",
  "hisense smart tv",
  "hisense heladera",
  "hisense lavarropas",
  // TCL AR (Shopify): TVs, tablets, auriculares
  "tcl smart tv 4k",
  "tcl qled televisor",
  "tcl tab tablet",
  // Pycca (Magento 2, Tucumán/nationwide): electrónica general
  "celular samsung tucuman",
  "notebook hp tucuman",
  // Ciclo 1612 — electrónica de alta conversión sin cobertura previa
  "tablet lenovo tab",
  "auriculares apple airpods pro",
  "cargador macbook",
  "apple pencil 2",
  // Ciclo 1612 — línea blanca marcas faltantes
  "heladera drean",
  "lavarropas drean",
  "heladera mabe",
  "lavarropas mabe",
  // Ciclo 1612 — gaming periféricos adicionales
  "tarjeta grafica rtx 4060",
  "tarjeta grafica rx 7600",
  "ram ddr5 16gb",
  "fuente de poder 750w",
  // Ciclo 1612 — outdoor / camping (temporada otoño AR)
  "bolsa de dormir",
  "carpa camping 4 personas",
  "linterna recargable",
  // Ciclo 1612 — movilidad urbana
  "casco bicicleta",
  "luz bicicleta led",
  "candado bicicleta",
  // Ciclo 1613 — invierno AR (junio-agosto 2026) alta conversión
  // Calefacción / abrigo
  "bolsa termoterapia",
  "guantes de cuero hombre",
  "bufanda lana mujer",
  "gorro tejido invierno",
  "pantalon termico",
  "chaleco de pluma",
  "calza termica",
  // Salud / bienestar invierno
  "vaporizador de ambiente",
  "inhalador nebulizador infantil",
  "vitamina c efervescente",
  // Tech / vuelta al cole (AR invierno = 2do semestre escolar)
  "mochila universitaria",
  "auriculares estudio para home office",
  "tablet educativa",
  "notebook core i3",
  // Línea blanca temporada alta invierno
  "secadora de ropa",
  "deshumidificador",
  "humidificador bebe",
  // Entretenimiento hogar (invierno = más tiempo en casa)
  "smart tv 32 pulgadas",
  "parlante karaoke",
  "consola retro",
  // Gaming: lanzamientos esperados 2026 H2
  "playstation 5 slim",
  "xbox series s",
  "juego xbox",
  "headset xbox",
  // Ciclo 1613 — calzado invierno (alta rotación en MLA otoño/invierno AR)
  "bota de lluvia",
  "bota de cuero mujer",
  "botines de cuero hombre",
  "mocasines hombre cuero",
  "zapatillas urbanas invierno",
  // Ciclo 1613 — calefacción marcas nacionales
  "estufa eskabe",
  "estufa emege",
  "estufa orbis",
  "calefactor orbis",
  "caloventor bajo consumo",
  // Ciclo 1613 — ropa de cama invierno
  "frazada",
  "edredon doble",
  "plumón cama",
  "sabanas flaneladas",
  // Ciclo 1613 — salud / bienestar invierno ampliado
  "termometro digital infrarrojo",
  "vaporizador vicks",
  "nebulizador compacto",
  // Ciclo 1613 — emergencias / cortes de luz invierno AR
  "generador electrico",
  "lampara de emergencia recargable",
  "linterna frontal led",
  // Ciclo 1613 — abrigo interior / complementos
  "camiseta termica interior",
  "medias de lana",
  "bufanda polar",
  // Ciclo 1613 — electrodomésticos cocina invierno (consumo hogar aumenta en frío)
  "pava electrica acero inoxidable",
  "tostadora 2 ranuras",
  "horno electrico sobremesa",
  "cafetera espresso",
  "cafetera drip programable",
  // Ciclo 1613 — indumentaria técnica invierno
  "campera pluma hombre",
  "piloto impermeable mujer",
  "ropa interior termica set",
  // Ciclo 1613 — calefacción ampliada
  "estufa infrarroja 1500w",
  "caloventor fensa",
  "calefactor a gas tiro balanceado",
  // Ciclo 1613 — deporte en casa / gimnasio domicilio
  "bicicleta fija spinning",
  "cinta de correr plegable",
  "colchoneta yoga antideslizante",
  // Ciclo 1614 — Hot Sale mayo 2026: categorías de mayor conversión
  // Tech — accesorios gaming y periféricos
  "auriculares gaming usb",
  "silla gamer ergonomica",
  "monitor curvo",
  "teclado gaming rgb",
  "mouse gaming inalambrico",
  // Ciclo 1614 — celulares: modelos nuevos alta rotación
  "samsung galaxy a35",
  "motorola moto g85",
  "xiaomi redmi 13",
  "tecno spark 20",
  // Ciclo 1614 — TV y entretenimiento
  "proyector laser 4k",
  "soundbar dolby atmos",
  "smart tv 85 pulgadas",
  // Ciclo 1614 — electrodomésticos pequeños kitchen
  "exprimidor electrico",
  "maquina de pan",
  "yogurtera electrica",
  "desgranadora de maiz electrica",
  // Ciclo 1614 — salud y bienestar
  "colchon viscoelastico",
  "almohada memory foam",
  "puff de descanso",
  // Ciclo 1614 — hogar conectado
  "robot aspiradora wifi",
  "camara seguridad interior wifi",
  "sensor movimiento inteligente",
  // Ciclo 1614 — indumentaria AR otoño (mayo)
  "remera manga larga hombre",
  "pantalon jogger hombre",
  "zapatillas outdoor impermeables",
  // Ciclo 1614 — energía / generadores
  "inversor solar 1000w",
  "bateria litio 12v",
  "panel solar 200w",
  // Ciclo 1614 — audio premium AR
  "auriculares planar magneticos",
  "amplificador de auriculares",
  "dac usb audio",
  // Ciclo 1614 — mascotas nuevas categorías
  "cama para perro",
  "arbol para gatos",
  "bebedero automatico mascotas",
  // Ciclo 1614 — movilidad / bicicletas
  "bicicleta ruta carbono",
  "bicicleta urbana aluminio",
  "bicicleta plegable",
  // Ciclo 1615 — Hot Sale mayo 2026: categorías de alta conversión semana HS
  // Wearables y accesorios salud
  "glucosa continua cgm",
  "smartwatch deportivo",
  "banda de actividad xiaomi",
  "anillo inteligente",
  // PC builder / upgrade temporada
  "gabinete pc gamer",
  "placa madre gaming",
  "disipador cpu liquido",
  "case atx vidrio templado",
  // Smart home hub / ecosistema
  "hub hogar inteligente",
  "hub zigbee home assistant",
  "sensor temperatura wifi",
  "camara doorbell video",
  // TV streaming / media players
  "android tv box 4k",
  "tv stick uhd",
  "google tv hdmi",
  // Impresión / papel / oficina
  "impresora multifuncion tinta",
  "impresora laser monocromo",
  "cartucho tinta hp",
  // Audio hogar / multiroom
  "parlante multiroom wifi",
  "receiver amplificador hifi",
  "barra de sonido 5.1",
  // Deportes acuáticos / verano tardío
  "tabla de surf",
  "kayak inflable",
  "chaleco salvavidas",
  // Electro portátil viaje
  "hervidor viaje 220v",
  "adaptador viaje universal",
  "plancha de viaje",
  // Moda masculina otoño
  "camisa de vestir hombre",
  "traje hombre slim fit",
  "cinturon de cuero hombre",
  // Moda femenina otoño
  "vestido casual mujer",
  "cartera cuero mujer",
  "bufanda de seda mujer",
  // Relojería / joyería
  "reloj automatico hombre",
  "reloj mujer acero",
  "pulsera plata mujer",
  // Bebidas / soda
  "sifon soda stream",
  "cafetera de capsulas",
  "maquina de espresso manual",
  // Ciclo 1616 — muebles / dormitorio (alta rotación compras hogar AR)
  "sommier queen",
  "sommier king",
  "colchon resorte queen",
  "placard ropero puertas corredizas",
  "mesa de luz madera",
  "mesa de comedor 4 sillas",
  "silla de cocina",
  "biblioteca estantería",
  "perchero de pie",
  // Ciclo 1616 — fotografía / video creación de contenido
  "trípode para celular",
  "ring light con trípode",
  "micrófono de condensador usb",
  "micrófono de solapa",
  "luz led panel video",
  "fondo verde croma",
  // Ciclo 1616 — smartphones nuevos modelos 2026
  "xiaomi poco x6",
  "xiaomi redmi note 13",
  "motorola moto g54",
  "samsung galaxy a15 5g",
  "oneplus celular",
  "realme c65",
  // Ciclo 1616 — accesorios tech faltantes alta rotación
  "teclado inalambrico bluetooth",
  "monitor ultrawide 34",
  "cable hdmi 2.1",
  "soporte celular escritorio",
  "hub usb c 7 en 1",
  "base notebook refrigerante",
  "lector de tarjetas sd",
  // Ciclo 1616 — hogar / jardín exterior
  "cortadora de cesped electrica",
  "manguera extensible jardin",
  "regadera jardin",
  "pala de jardin",
  "maceta plastico grande",
  "sustrato plantas",
  // Ciclo 1616 — construcción / pintura / ferretería
  "pintura latex interior blanca",
  "rodillo de pintura",
  "sellador para paredes",
  "kit herramientas basico",
  "caja de herramientas plastica",
  // Ciclo 1616 — salud / bienestar ampliado
  "tensiómetro muñeca digital",
  "electro estimulador muscular",
  "pistola masajeadora percusion",
  // Ciclo 1616 — ropa de marca adicional
  "remera lacoste",
  "zapatillas new balance",
  "mochila the north face",
  // Ciclo 1616 — entretenimiento familiar
  "juego de mesa adultos",
  "puzzle 1000 piezas",
  "juego de cartas",
  // Ciclo 1617 — pesca / deportes pesca (alta rotación MLA AR)
  "caña de pesca",
  "reel de pesca",
  "kit pesca completo",
  "señuelo de pesca",
  // Ciclo 1617 — cocina / repostería
  "amasadora repostera",
  "deshidratador de frutas",
  "sorbetiera heladera casera",
  "molde silicona reposteria",
  "manga pastelera set",
  // Ciclo 1617 — electrónica — carga rápida GaN
  "cargador gan 65w",
  "cargador gan 100w",
  "cable usb c 100w",
  // Ciclo 1617 — audio vinilo / hifi
  "tocadiscos portatil",
  "bandeja giradiscos usb",
  "amplificador hifi stereo",
  // Ciclo 1617 — deportes específicos gym / box
  "guantes de boxeo",
  "saco de boxeo",
  "cuerda de saltar velocidad",
  "rodillera deportiva",
  "tobillera lastrada",
  // Ciclo 1617 — bebés / puericultura adicional
  "bañera plegable bebe",
  "portabebe ergonomico",
  "cuna viaje plegable",
  "mochila maternal",
  // Ciclo 1617 — energía / emergencia (blackout AR)
  "power station portatil",
  "generador solar portatil",
  "bateria power bank solar",
  "ups 1500va",
  // Ciclo 1617 — limpieza del hogar
  "aspiradora vertical sin cable",
  "mopa electrica recargable",
  "limpiador a vapor multiuso",
  "cepillo sonic limpieza",
  // Ciclo 1617 — tecnología wearable
  "lentes realidad virtual vr",
  "smartwatch samsung galaxy watch",
  "fitbit pulsera actividad",
  // Ciclo 1617 — accesorios auto adicional
  "cubierta auto 175/70 r13",
  "aceite motor 10w40",
  "kit luces led auto",
  "funda asiento auto universal",
  // Ciclo 1617 — componentes PC adicional
  "gabinete mini itx",
  "placa madre am5",
  "cooler cpu 120mm",
  "case pc vidrio templado",
  // Ciclo 1618 — fútbol / deportes team sports (alta rotación pretemporada AR)
  "camiseta seleccion argentina",
  "pelota futbol oficial",
  "arco de futbol patio",
  "raqueta de tenis",
  "pelota de basquet",
  "guantes de arquero",
  "tobillera de futbol",
  // Ciclo 1618 — gaming retro / handhelds (tendencia 2025-2026)
  "anbernic rg35xx",
  "miyoo mini plus",
  "consola retro portatil",
  "game boy advance repuesto",
  // Ciclo 1618 — e-readers / lectura digital
  "kindle amazon",
  "e-reader pantalla tinta",
  "kindle paperwhite",
  // Ciclo 1618 — joyería / accesorios moda fina
  "anillo de plata mujer",
  "cadena de plata hombre",
  "aros de plata",
  "pulsera de cuero hombre",
  // Ciclo 1618 — audio profesional / podcast / streaming
  "interfaz de audio usb",
  "controlador midi teclado",
  "microfono dinamico podcast",
  "auriculares monitoreo",
  // Ciclo 1618 — fotografía avanzada / creadores
  "flash externo camara",
  "tripode profesional aluminio",
  "dji mini 4 pro",
  "filtro nd camara",
  // Ciclo 1618 — calzado de trabajo / seguridad
  "bota de seguridad punta de acero",
  "zapatilla de seguridad",
  "calzado de trabajo",
  // Ciclo 1618 — electrónica automotriz adicional
  "radio auto android pantalla",
  "camara de reversa auto",
  "sensor de estacionamiento",
  "alarm car tracker gps",
  // Ciclo 1618 — textil hogar / blanco (siempre activo en MLA)
  "juego de toallas algodon",
  "mantel antimanchas",
  "cortina de baño impermeable",
  "cubre sommier elastizado",
  // Ciclo 1618 — papelería / arte / manualidades
  "marcadores acuarelables",
  "lienzo para pintar",
  "acuarelas profesionales",
  "block de dibujo a4",
  // Ciclo 1618 — marcas línea blanca AR sin cobertura previa
  "heladera bgh",
  "heladera patrick",
  "lavarropas patrick",
  "cocina a gas longvie",
  "heladera aurora",
  // Ciclo 1618 — skateboarding / deportes urbanos
  "tabla de skate completa",
  "patines en linea adultos",
  "casco patines skate",
  // Ciclo 1620 — yerba mate / infusiones argentinas (categoría endemic AR)
  "yerba mate",
  "yerba mate sin palo",
  "mate y bombilla set",
  "termo mate acero",
  "te verde organico",
  "infusiones herbales",
  // Ciclo 1620 — café de especialidad / equipamiento barista
  "cafetera de capsulas nespresso",
  "cafetera prensa francesa",
  "molinillo de cafe electrico",
  "cafe de especialidad grano",
  "cafetera aeropress",
  "cafetera cold brew",
  // Ciclo 1620 — cosmética / skincare (alta conversión MLA)
  "crema facial vitamina c",
  "serum vitamina c",
  "protector solar facial spf50",
  "acido hialuronico serum",
  "contorno de ojos",
  "limpiador facial espuma",
  // Ciclo 1620 — perfumería (enorme volumen MLA AR)
  "perfume mujer importado",
  "perfume hombre importado",
  "colonia masculina",
  "set perfume regalo",
  // Ciclo 1620 — ropa bebé / maternidad
  "ropa bebe recien nacido",
  "cochecito bebe",
  "porta bebe ergonomico",
  "cuna bebe",
  "monitor bebe wifi",
  // Ciclo 1620 — juguetes STEM / educativos
  "kit robotica niños",
  "microscopio niños",
  "lego technic",
  "cubo rubik profesional",
  "telescopio niños",
  // Ciclo 1620 — iluminación LED inteligente
  "tira led wifi rgb",
  "foco led inteligente alexa",
  "lampara de escritorio led",
  "proyector laser estrellas",
  // Ciclo 1620 — mochilas / bolsos viaje
  "mochila universitaria",
  "mochila de viaje 40l",
  "valija cabina spinner",
  "riñonera deportiva",
  // Ciclo 1620 — herramientas eléctricas adicionales
  "amoladora angular 115mm",
  "soldadora inverter",
  "caladora eléctrica",
  "fresadora de mano",
  // Ciclo 1620 — ventilación / climatización portátil
  "ventilador de torre silencioso",
  "aire acondicionado portatil",
  "deshumidificador electrico",
  // Ciclo 1621 — libros / lectura / papelería premium
  "libro de cocina",
  "libro educativo infantil",
  "agenda ejecutiva 2026",
  "planner mensual",
  // Ciclo 1621 — impresión profesional / plotters
  "impresora de etiquetas",
  "impresora de fotos portatil",
  "plotter de corte",
  // Ciclo 1621 — accesorios fotografía / video
  "estabilizador gimbal 3 ejes",
  "microfono para celular",
  "luz de video portatil",
  "bateria camara sony",
  "bateria camara canon",
  // Ciclo 1621 — colchones / descanso premium
  "colchon espuma alta densidad",
  "colchon pocket spring",
  "almohada latex",
  "protector colchon impermeable",
  // Ciclo 1621 — muebles de exterior / jardín
  "mesa de jardin aluminio",
  "silla de jardin plegable",
  "hamaca de jardin",
  "sombrilla de jardin 3 metros",
  "parrilla a carbon",
  // Ciclo 1621 — ropa de trabajo / uniformes
  "pantalon de trabajo cargo",
  "camisa de trabajo hombre",
  "chaleco de trabajo reflectante",
  // Ciclo 1621 — accesorios para pc gaming streaming
  "camara web 1080p",
  "microfono gaming rgb",
  "alfombra gamer xl",
  "silla secretlab",
  // Ciclo 1621 — telefonía / accessories 2026
  "auriculares samsung buds",
  "funda magsafe iphone",
  "soporte celular magnetico auto",
  "cargador inalambrico 15w",
  // Ciclo 1621 — instrumentos musicales
  "guitarra acustica cuerdas nylon",
  "amplificador guitarra",
  "pedal efecto guitarra",
  "bateria electronica compacta",
  "teclado midi 49 teclas",
  // Ciclo 1621 — deportes agua / natación
  "tabla de paddleboard",
  "traje de neoprene",
  "lentes de natacion",
  "aletas de buceo",
  // Ciclo 1621 — electrodomésticos cocina 2026
  "olla multicoccion",
  "sandwichera grill electrica",
  "juguera extractora frio",
  "yogurtera digital",
  // Ciclo 1622 — calefacción invierno 2026
  "calefactor a gas sin tiraje",
  "estufa a pellet",
  "radiador electrico a aceite",
  "convector electrico 2000w",
  "panel calefactor infrarrojo",
  "lona termica pileta",
  // Ciclo 1622 — ropa de abrigo / invierno
  "campera de pluma hombre",
  "campera de pluma mujer",
  "buzo hoodie oversize",
  "polar fleece hombre",
  "camiseta termica hombre",
  "calza termica mujer",
  "guantes esqui",
  "gorro de lana hombre",
  // Ciclo 1622 — calzado invierno
  "bota de nieve mujer",
  "bota de cuero hombre",
  "ugg sintetico mujer",
  "mocasin hombre cuero",
  // Ciclo 1622 — smartphones nuevos 2026
  "samsung galaxy s25",
  "motorola edge 50 pro",
  "xiaomi 14 ultra",
  "iphone 16 pro max",
  "realme 13 pro",
  // Ciclo 1622 — accesorios gaming consolas
  "joystick ps5 dualsense",
  "auriculares pulse 3d ps5",
  "base carga ps5",
  "volante gaming pc",
  "tarjeta captura elgato",
  // Ciclo 1622 — movilidad eléctrica
  "monopatin electrico adulto",
  "bicicleta electrica plegable",
  "casco electrico certificado",
  "bateria monopatin xiaomi",
  // Ciclo 1622 — herramientas eléctricas inalámbricas
  "atornillador inalambrico makita",
  "sierra caladora inalambrica",
  "amoladora inalambrica 18v",
  "nivel laser verde autonivelante",
  // Ciclo 1622 — bienestar / salud
  "masajeador percusion theragun",
  "luz terapia sad 10000 lux",
  "humidificador ultrasonico habitacion",
  "purificador aire hepa",
  "oximetro de pulso",
  // Ciclo 1622 — electrodomésticos premium
  "lavavajillas libre instalacion",
  "secadora ropa heat pump",
  "aspiradora robot con mopa",
  "cafetera superautomatica jura",
  "heladera french door",
  // Ciclo 1623 — Hot Sale activo mayo 2026: tech de alta conversión
  "notebook gamer rtx",
  "celular reacondicionado",
  "smartwatch galaxy watch ultra",
  "tablet ipad mini",
  "auriculares marshall",
  // Ciclo 1623 — Hot Sale activo mayo 2026: hogar / electrodomésticos
  "heladera combi",
  "lavarropas carga frontal",
  "horno combinado microondas",
  "campana de cocina",
  "cocina de gas encastre",
  // Ciclo 1623 — Hot Sale activo mayo 2026: indumentaria / calzado
  "zapatillas skechers",
  "zapatillas fila",
  "ropa deportiva mujer",
  "remera algodon hombre",
  "jeans skinny mujer",
  // Ciclo 1623 — Hot Sale activo mayo 2026: gaming periféricos
  "controlador nintendo switch",
  "auriculares gaming inalambrico",
  "monitor 165hz",
  "placa de video rx 7700",
  // Ciclo 1623 — Hot Sale activo mayo 2026: movilidad y outdoor
  "bicicleta electrica urbana",
  "casco de bicicleta mips",
  "mochila montaña 30l",
  "carpa ultraligera",
  // Ciclo 1623 — Hot Sale activo mayo 2026: salud / bienestar
  "colchon ortopedico",
  "almohada ergonomica cuello",
  "bicicleta estatica con pantalla",
  "pesas ajustables 20kg",
  // Ciclo 1623 — Hot Sale activo mayo 2026: conectividad / smart home
  "router wifi 6",
  "switch red gigabit",
  "nas almacenamiento red",
  "camara seguridad exterior",
  // Ciclo 1623 — Hot Sale activo mayo 2026: cocina premium
  "procesadora de alimentos philips",
  "freidora air fryer ninja",
  "olla de hierro fundido",
  "cuchillo chef profesional",
  // Ciclo 1623 — Hot Sale activo mayo 2026: TV premium y audio
  "smart tv oled lg",
  "soundbar con subwoofer",
  "proyector 4k laser",
  "receiver av amplificador",
  // Ciclo 1623 — Hot Sale activo mayo 2026: bebés / niños
  "cochecito gemelar",
  "silla de auto isofix",
  "juguete educativo stem",
  "set lego ciudad",
  // Ciclo 1623 — Hot Sale activo mayo 2026: mascotas
  "cama ortopedica perro",
  "rascador grande gatos",
  "correa ajustable perro",
  "arena sanitaria gatos",
  // Ciclo 1624 — electrónica consumo / pagos digitales
  "lector pos bluetooth",
  "impresora de tickets termica",
  "escaner de codigo de barras",
  "balanza digital comercial",
  // Ciclo 1624 — arte / decoración del hogar
  "cuadro decorativo sala",
  "marco de foto madera",
  "espejo decorativo pared",
  "lampara de sal himalaya",
  "vela aromatica decoracion",
  // Ciclo 1624 — moda tallas grandes / plus size
  "campera talle grande mujer",
  "remera talle especial hombre",
  "pantalon cargo talle grande",
  // Ciclo 1624 — alimentos saludables / dietéticos
  "proteina vegana polvo",
  "collageno hidrolizado",
  "aceite de coco organico",
  "semillas chia",
  "granola sin azucar",
  // Ciclo 1624 — vinos / bebidas (alta rotación MLA AR)
  "vino tinto malbec",
  "set copas de vino cristal",
  "decantador de vino",
  "enfriador de vino electrico",
  // Ciclo 1624 — coleccionables / figuras
  "figura funko pop",
  "figura de accion marvel",
  "coleccionable dragon ball",
  "maqueta auto a escala",
  // Ciclo 1624 — instrumentos de viento / cuerdas
  "flauta traversa",
  "trompeta de estudio",
  "violin estudiante",
  "armonica diatonica",
  // Ciclo 1624 — repuestos y herramientas específicas
  "disco de corte amoladora",
  "broca para concreto set",
  "llave torque",
  "multimetro digital",
  "destornillador de precision set",
  // Ciclo 1624 — tecnología accesibilidad / adultos mayores
  "celular tecla grande adulto mayor",
  "amplificador de sonido personal",
  "reloj gps adulto mayor",
  // Ciclo 1624 — outdoor / survival / aventura
  "navaja suiza victorinox",
  "brujula de orientacion",
  "filtro de agua purificador portatil",
  "saco de dormir ultraligero",
  // Ciclo 1625 — post-Hot Sale / pre-invierno AR (mayo-junio 2026)
  // Termoformado / vajilla caliente (aumento de demanda en frío)
  "jarra termica acero",
  "taza termica doble pared",
  "contenedor termico alimentos",
  // Calefacción ecológica / eficiencia energética
  "estufa a leña hierro fundido",
  "termoventilador bajo consumo",
  "calefactor ceramico",
  // Ciclo 1625 — electrónica portátil: nuevos modelos y accesorios 2026
  "xiaomi redmi pad 2",
  "samsung galaxy tab a9",
  "ipad 10ma generacion",
  "notebook macbook air m3",
  // Ciclo 1625 — audio / música en casa (invierno = más tiempo indoor)
  "equipo de musica bluetooth",
  "minicomponente samsung",
  "vinilo disco lp",
  "cassette deck restaurado",
  // Ciclo 1625 — conectividad / trabajo remoto invierno
  "monitor portatil 15 pulgadas",
  "docking station usb c",
  "teclado bluetooth mac",
  "mouse ergonomico vertical",
  // Ciclo 1625 — gaming / PC components: upgrade temporada baja
  "nvidia geforce rtx 4070",
  "amd radeon rx 7800 xt",
  "memoria ram ddr5 32gb",
  "placa madre b650",
  "gabinete atx full tower",
  // Ciclo 1625 — electrodomésticos cocina invierno AR
  "fondue electrico",
  "raclette grill electrico",
  "olla arrocera digital",
  "freidora de aire xl 8l",
  "grill de contacto electrico",
  // Ciclo 1625 — calzado deporte / lifestyle 2026 AR
  "zapatillas converse all star",
  "zapatillas vans old skool",
  "zapatillas hoka running",
  "zapatillas on running cloud",
  // Ciclo 1625 — cuidado del hogar / limpieza
  "aspiradora sin cable dyson",
  "robot aspiradora lidar",
  "mopa electrostatica recargable",
  "purificador de agua osmosis inversa",
  // Ciclo 1625 — streaming / entretenimiento digital
  "joystick xbox inalambrico",
  "control ps5 edge",
  "audifono gaming pc usb",
  "capturador video hdmi usb",
  // Ciclo 1625 — belleza / cuidado personal
  "rizador de cabello ceramico",
  "alisadora de cabello profesional",
  "maquina de afeitar electrica gillette",
  "cepillo sonic oral b",
  // Ciclo 1625 — accesorios premium iPhone / Android
  "funda silicona iphone 16",
  "protector pantalla samsung s25",
  "cargador magsafe 15w",
  "soporte magsafe auto",
  // Ciclo 1625 — outdoor / camping post-temporada (precio bajo, stock verano)
  "sleeping pad aislante",
  "mochila trekking 50l",
  "bastones trekking telescopicos",
  "botella hidratacion camelbak",
  // Ciclo 1626 — invierno AR profundo (junio-agosto 2026): calefacción y confort
  "calefactor split inverter",
  "estufa de alta eficiencia",
  "calefactor electrico bajo consumo",
  "radiador de panel electrico",
  "alfombra electrica calefactora",
  "cama electrica calefactada",
  // Ciclo 1626 — indumentaria técnica invierno avanzada
  "campera esqui hombre",
  "campera esqui mujer",
  "traje de ski completo",
  "pantalon de nieve impermeable",
  "guantes ski impermeables",
  "anteojos de ski snowboard",
  // Ciclo 1626 — smartphones emergentes y modelos 2026 H2
  "samsung galaxy s25 fe",
  "xiaomi redmi 14 pro",
  "motorola razr 50",
  "oneplus 13 celular",
  "google pixel 9",
  "honor magic7",
  // Ciclo 1626 — computacion: portátiles nuevos 2026
  "notebook arm windows",
  "chromebook escolar",
  "notebook 2 en 1 touch",
  "laptop ultradelgada 14 pulgadas",
  // Ciclo 1626 — audio / música: alta rotación invierno
  "auriculares over ear hifi",
  "dac amplificador portatil",
  "parlante resistente agua",
  "radiotransmisor fm auto",
  // Ciclo 1626 — salud y bienestar: dispositivos médicos domésticos
  "monitor de glucosa continuo",
  "espirómetro digital",
  "electro estimulador tens",
  "cama de luz infrarroja",
  // Ciclo 1626 — hogar conectado: nuevos dispositivos 2026
  "robot cortacesped inteligente",
  "medidor calidad aire interior",
  "detector de humo inteligente",
  "interruptor inteligente wifi",
  // Ciclo 1626 — gaming: lanzamientos y periféricos 2026 H2
  "ps5 pro consola",
  "joystick hall effect pc",
  "monitor oled 27 gaming",
  "teclado 65 porciento compacto",
  "mouse trackball ergonomico",
  // Ciclo 1626 — electrodomésticos inteligentes / eficiencia
  "lavarropas con secadora integrada",
  "heladera inverter a",
  "lavavajillas pequeño 45cm",
  "horno vapor combinado",
  // Ciclo 1626 — moda / lifestyle invierno AR
  "botas de cuero mujer taco",
  "zapatillas plataforma mujer",
  "cartera de cuero genuino",
  "reloj cronografo hombre",
  // Ciclo 1626 — mascotas: nuevas categorías
  "cama calefaccionada mascotas",
  "gps collar perro",
  "bebedero fuente gatos",
  "ropa abrigo perro invierno",
  // Ciclo 1626 — construcción / mejoras del hogar invierno
  "pistola de calor electrica",
  "aislante termico rollos",
  "espuma poliuretano expansiva",
  "burletes para puertas",
];
