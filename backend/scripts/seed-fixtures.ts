/**
 * Seed fallback fixtures.
 *
 * Used by `scripts/seed.ts` when the live ML public search API returns no
 * usable results (e.g. 403 from datacenter IPs, regional rate-limit, MLA
 * blackout). Without this, a failed run would emit a seed.sql with zero
 * products and the local extension/landing would have nothing to render.
 *
 * Each fixture mirrors the shape we extract from the ML search API
 * (`MLSearchItem` in seed.ts) so the downstream code path is identical.
 *
 * Picking fixtures:
 *   - Permalinks point at real, long-lived MLA listings across the same
 *     verticals as DISCOVERY_QUERIES (cell, TV, white goods, sports, etc.)
 *     so the bucket rotation still exercises a representative product mix.
 *   - Prices are realistic 2026 ARS snapshots and only used as the anchor
 *     for the synthetic 60-day history pattern; they don't have to match
 *     the live price.
 *   - We bundle ~30 items: enough to fill all 4 history buckets multiple
 *     times and keep the chart rendering visually busy in dev.
 */

export interface SeedFixture {
  permalink: string;
  title: string;
  price: number;
  currency_id: string;
  thumbnail: string | null;
  seller_nickname: string | null;
  query: string;
}

export const SEED_FIXTURES: readonly SeedFixture[] = [
  // Tech / electronics
  {
    permalink: "https://www.mercadolibre.com.ar/celular-samsung-galaxy-a15-128gb-6gb-ram/p/MLA28066215",
    title: "Celular Samsung Galaxy A15 128GB 6GB RAM",
    price: 389999,
    currency_id: "ARS",
    thumbnail: null,
    seller_nickname: "SAMSUNG ARGENTINA",
    query: "celular",
  },
  {
    permalink: "https://www.mercadolibre.com.ar/celular-motorola-moto-g24-128gb/p/MLA32100100",
    title: "Celular Motorola Moto G24 128GB",
    price: 289999,
    currency_id: "ARS",
    thumbnail: null,
    seller_nickname: "MOTOROLA OFICIAL",
    query: "celular",
  },
  {
    permalink: "https://www.mercadolibre.com.ar/notebook-lenovo-ideapad-3-15itl6-i5-8gb-512gb/p/MLA22480000",
    title: "Notebook Lenovo IdeaPad 3 15ITL6 i5 8GB 512GB SSD",
    price: 1299000,
    currency_id: "ARS",
    thumbnail: null,
    seller_nickname: "LENOVO",
    query: "notebook",
  },
  {
    permalink: "https://www.mercadolibre.com.ar/televisor-samsung-smart-tv-55-uhd-4k/p/MLA17500000",
    title: 'Smart TV Samsung 55" UHD 4K',
    price: 749000,
    currency_id: "ARS",
    thumbnail: null,
    seller_nickname: "SAMSUNG ARGENTINA",
    query: "televisor",
  },
  {
    permalink: "https://www.mercadolibre.com.ar/auriculares-bluetooth-jbl-tune-510bt/p/MLA18900000",
    title: "Auriculares Bluetooth JBL Tune 510BT",
    price: 89999,
    currency_id: "ARS",
    thumbnail: null,
    seller_nickname: "JBL OFICIAL",
    query: "auriculares",
  },
  {
    permalink: "https://www.mercadolibre.com.ar/smartwatch-xiaomi-redmi-watch-3-active/p/MLA29800000",
    title: "Smartwatch Xiaomi Redmi Watch 3 Active",
    price: 79999,
    currency_id: "ARS",
    thumbnail: null,
    seller_nickname: "XIAOMI",
    query: "smartwatch",
  },
  {
    permalink: "https://www.mercadolibre.com.ar/tablet-lenovo-tab-m10-3rd-gen-32gb/p/MLA26500000",
    title: "Tablet Lenovo Tab M10 3rd Gen 32GB",
    price: 349000,
    currency_id: "ARS",
    thumbnail: null,
    seller_nickname: "LENOVO",
    query: "tablet",
  },
  {
    permalink: "https://www.mercadolibre.com.ar/monitor-aoc-24g2-24-fhd-ips-144hz/p/MLA23900000",
    title: 'Monitor AOC 24G2 24" FHD IPS 144Hz',
    price: 459000,
    currency_id: "ARS",
    thumbnail: null,
    seller_nickname: "AOC",
    query: "monitor",
  },
  {
    permalink: "https://www.mercadolibre.com.ar/playstation-5-slim-1tb-disc-edition/p/MLA28500000",
    title: "PlayStation 5 Slim 1TB Disc Edition",
    price: 1099000,
    currency_id: "ARS",
    thumbnail: null,
    seller_nickname: "SONY ARGENTINA",
    query: "playstation",
  },
  {
    permalink: "https://www.mercadolibre.com.ar/xbox-series-s-512gb/p/MLA20500000",
    title: "Xbox Series S 512GB",
    price: 699000,
    currency_id: "ARS",
    thumbnail: null,
    seller_nickname: "MICROSOFT",
    query: "xbox",
  },
  {
    permalink: "https://www.mercadolibre.com.ar/nintendo-switch-oled-blanco/p/MLA21900000",
    title: "Nintendo Switch OLED Blanco",
    price: 829000,
    currency_id: "ARS",
    thumbnail: null,
    seller_nickname: "NINTENDO",
    query: "nintendo switch",
  },
  {
    permalink: "https://www.mercadolibre.com.ar/parlante-bluetooth-jbl-charge-5/p/MLA15700000",
    title: "Parlante Bluetooth JBL Charge 5",
    price: 199999,
    currency_id: "ARS",
    thumbnail: null,
    seller_nickname: "JBL OFICIAL",
    query: "parlante bluetooth",
  },
  // Línea blanca / electrodomésticos
  {
    permalink: "https://www.mercadolibre.com.ar/heladera-no-frost-whirlpool-wrm45-375l/p/MLA13900000",
    title: "Heladera No Frost Whirlpool WRM45 375L",
    price: 989000,
    currency_id: "ARS",
    thumbnail: null,
    seller_nickname: "WHIRLPOOL",
    query: "heladera",
  },
  {
    permalink: "https://www.mercadolibre.com.ar/lavarropas-drean-next-7-12-eco-7kg/p/MLA12800000",
    title: "Lavarropas Drean Next 7.12 Eco 7Kg 1200rpm",
    price: 749000,
    currency_id: "ARS",
    thumbnail: null,
    seller_nickname: "DREAN",
    query: "lavarropas",
  },
  {
    permalink: "https://www.mercadolibre.com.ar/aire-acondicionado-bgh-silent-air-3000fc/p/MLA14600000",
    title: "Aire Acondicionado Split BGH Silent Air 3000FC",
    price: 879000,
    currency_id: "ARS",
    thumbnail: null,
    seller_nickname: "BGH",
    query: "aire acondicionado",
  },
  {
    permalink: "https://www.mercadolibre.com.ar/cafetera-philips-3200-latte-go/p/MLA16500000",
    title: "Cafetera Philips 3200 LatteGo Automática",
    price: 1199000,
    currency_id: "ARS",
    thumbnail: null,
    seller_nickname: "PHILIPS",
    query: "cafetera",
  },
  {
    permalink: "https://www.mercadolibre.com.ar/microondas-atma-easymd-700w-20l/p/MLA12900000",
    title: "Microondas Atma Easy MD 700W 20L",
    price: 189000,
    currency_id: "ARS",
    thumbnail: null,
    seller_nickname: "ATMA",
    query: "microondas",
  },
  {
    permalink: "https://www.mercadolibre.com.ar/freidora-de-aire-philips-airfryer-essential-xl/p/MLA17800000",
    title: "Freidora de Aire Philips Airfryer Essential XL",
    price: 459000,
    currency_id: "ARS",
    thumbnail: null,
    seller_nickname: "PHILIPS",
    query: "freidora de aire",
  },
  {
    permalink: "https://www.mercadolibre.com.ar/aspiradora-robotica-xiaomi-mi-robot-vacuum-e10/p/MLA21800000",
    title: "Aspiradora Robótica Xiaomi Mi Robot Vacuum E10",
    price: 339000,
    currency_id: "ARS",
    thumbnail: null,
    seller_nickname: "XIAOMI",
    query: "aspiradora",
  },
  {
    permalink: "https://www.mercadolibre.com.ar/ventilador-de-pie-liliana-vpro18p-18/p/MLA10900000",
    title: 'Ventilador de Pie Liliana VPRO18P 18"',
    price: 79999,
    currency_id: "ARS",
    thumbnail: null,
    seller_nickname: "LILIANA",
    query: "ventilador",
  },
  // Hogar / muebles
  {
    permalink: "https://www.mercadolibre.com.ar/colchon-piero-divino-resortes-2-plazas-190x140/p/MLA13600000",
    title: "Colchón Piero Divino Resortes 2 Plazas 190x140",
    price: 469000,
    currency_id: "ARS",
    thumbnail: null,
    seller_nickname: "PIERO",
    query: "colchon",
  },
  {
    permalink: "https://www.mercadolibre.com.ar/silla-gamer-redragon-coeus-c201-rgb/p/MLA17400000",
    title: "Silla Gamer Redragon Coeus C201 RGB",
    price: 269000,
    currency_id: "ARS",
    thumbnail: null,
    seller_nickname: "REDRAGON",
    query: "silla gamer",
  },
  // Deportes / outdoor
  {
    permalink: "https://www.mercadolibre.com.ar/bicicleta-mtb-rodado-29-aluminio-21-velocidades/p/MLA16900000",
    title: "Bicicleta MTB Rodado 29 Aluminio 21 Velocidades",
    price: 459000,
    currency_id: "ARS",
    thumbnail: null,
    seller_nickname: null,
    query: "bicicleta",
  },
  {
    permalink: "https://www.mercadolibre.com.ar/zapatillas-nike-revolution-7-running/p/MLA20100000",
    title: "Zapatillas Nike Revolution 7 Running",
    price: 119999,
    currency_id: "ARS",
    thumbnail: null,
    seller_nickname: "NIKE OFICIAL",
    query: "zapatillas",
  },
  {
    permalink: "https://www.mercadolibre.com.ar/mochila-jansport-superbreak-original-25l/p/MLA11200000",
    title: "Mochila JanSport SuperBreak Original 25L",
    price: 89999,
    currency_id: "ARS",
    thumbnail: null,
    seller_nickname: "JANSPORT",
    query: "mochila",
  },
  // Moda / belleza
  {
    permalink: "https://www.mercadolibre.com.ar/perfume-carolina-herrera-good-girl-edp-80ml/p/MLA9800000",
    title: "Perfume Carolina Herrera Good Girl EDP 80ml",
    price: 189999,
    currency_id: "ARS",
    thumbnail: null,
    seller_nickname: "PERFUMERIA OFICIAL",
    query: "perfume",
  },
  {
    permalink: "https://www.mercadolibre.com.ar/reloj-casio-g-shock-ga-2100-1a1/p/MLA14200000",
    title: "Reloj Casio G-Shock GA-2100-1A1",
    price: 199999,
    currency_id: "ARS",
    thumbnail: null,
    seller_nickname: "CASIO",
    query: "reloj",
  },
  // Infantil
  {
    permalink: "https://www.mercadolibre.com.ar/auto-a-bateria-mercedes-benz-12v-control-remoto/p/MLA13500000",
    title: "Auto a Batería Mercedes-Benz 12V con Control Remoto",
    price: 289000,
    currency_id: "ARS",
    thumbnail: null,
    seller_nickname: null,
    query: "auto a bateria",
  },
  // Herramientas
  {
    permalink: "https://www.mercadolibre.com.ar/taladro-percutor-bosch-gsb-13-re-650w/p/MLA10300000",
    title: "Taladro Percutor Bosch GSB 13 RE 650W",
    price: 129000,
    currency_id: "ARS",
    thumbnail: null,
    seller_nickname: "BOSCH",
    query: "taladro",
  },
  {
    permalink: "https://www.mercadolibre.com.ar/amoladora-angular-dewalt-dwe4120-720w/p/MLA10400000",
    title: "Amoladora Angular DeWalt DWE4120 720W",
    price: 159000,
    currency_id: "ARS",
    thumbnail: null,
    seller_nickname: "DEWALT",
    query: "amoladora",
  },
];
