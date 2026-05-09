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
];
