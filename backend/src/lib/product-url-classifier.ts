export interface ProductUrlClassification {
  isProduct: boolean;
  quarantine: boolean;
  reason: string;
  host: string | null;
}

const SUPPORT_PATH_RE = /^\/(?:ayuda|help|contacto|atencion-al-cliente|centro-de-ayuda)(?:\/|$)/i;
const LEGAL_PATH_RE = /\/(?:privacidad|privacy|terminos|terminos-y-condiciones|legales)(?:\/|$)/i;
const SITEMAP_PATH_RE = /^\/(?:sitemap(?:\.xml)?|robots\.txt)(?:\/|$)/i;
const BLOG_PATH_RE = /^\/(?:blog|ideas)(?:\/|$)/i;
const CATEGORY_PATH_RE =
  /^\/(?:c|categoria|categorias|category|cat|l|departamento|collections?|sodimac-ar\/category)(?:\/|$)/i;

const PRODUCT_RULES: Array<{ host: RegExp; path: RegExp }> = [
  { host: /(^|\.)mercadolibre\.com\.ar$/i, path: /(?:\/MLA-?\d+|\/p\/MLA\d+)/i },
  { host: /(^|\.)naldo\.com\.ar$/i, path: /\/p\/?$/i },
  { host: /(^|\.)cetrogar\.com\.ar$/i, path: /\.html$/i },
  { host: /(^|\.)carrefour\.com\.ar$/i, path: /\/p\/?$/i },
  { host: /(^|\.)amazon\./i, path: /\/(?:dp|gp\/product)\/[A-Z0-9]{10}(?:\/|$)/i },
  { host: /(^|\.)compragamer\.com$/i, path: /\/producto\//i },
  { host: /(^|\.)fravega\.com$/i, path: /\/p\//i },
  { host: /(^|\.)sodimac\.com\.ar$/i, path: /\/sodimac-ar\/product\//i },
  { host: /(^|\.)easy\.com\.ar$/i, path: /\/p(?:\/|$)/i },
  { host: /(^|\.)farmacity\.com$/i, path: /\/p(?:\/|$)/i },
  { host: /(^|\.)coppel\.com\.ar$/i, path: /\/p(?:\/|$)/i },
];

export function classifyProductUrl(input: string): ProductUrlClassification {
  let parsed: URL;
  try {
    parsed = new URL(input.trim());
  } catch {
    return { isProduct: false, quarantine: false, reason: "invalid_url", host: null };
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  const path = parsed.pathname.replace(/\/+$/, "") || "/";

  if (SITEMAP_PATH_RE.test(path)) return { isProduct: false, quarantine: true, reason: "sitemap_path", host };
  if (SUPPORT_PATH_RE.test(path)) return { isProduct: false, quarantine: true, reason: "support_path", host };
  if (LEGAL_PATH_RE.test(path)) return { isProduct: false, quarantine: true, reason: "legal_path", host };
  if (BLOG_PATH_RE.test(path)) return { isProduct: false, quarantine: true, reason: "blog_path", host };
  if (CATEGORY_PATH_RE.test(path)) return { isProduct: false, quarantine: true, reason: "category_path", host };

  const matched = PRODUCT_RULES.some((rule) => rule.host.test(host) && rule.path.test(path));
  if (matched) {
    return { isProduct: true, quarantine: false, reason: "product_allowlist", host };
  }

  return { isProduct: false, quarantine: false, reason: "unknown_pattern", host };
}
