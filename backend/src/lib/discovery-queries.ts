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
];
