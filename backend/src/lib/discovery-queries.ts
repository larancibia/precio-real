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
  // Línea blanca / electrodomésticos
  "heladera",
  "lavarropas",
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
  "pava electrica",
  "tostadora",
  "freezer",
  "secador de pelo",
  "plancha de pelo",
  // Hogar / muebles
  "colchon",
  "sillon",
  "escritorio",
  "silla gamer",
  // Deportes / outdoor
  "bicicleta",
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
  // Herramientas / DIY
  "taladro",
  "amoladora",
];
