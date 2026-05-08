/**
 * MercadoLibre URL helpers.
 * Item id extraction + canonical URL normalization for D1 lookups.
 */

export function extractMLAId(url: string): string | null {
  const match = url.match(/MLA-?(\d+)/i);
  if (!match) return null;
  return `MLA${match[1]}`;
}

export function normalizeMLUrl(url: string): string {
  const parsed = new URL(url);
  const host = parsed.host.toLowerCase();
  let pathname = parsed.pathname;
  // Strip trailing slash unless pathname is just "/".
  if (pathname.length > 1 && pathname.endsWith("/")) {
    pathname = pathname.slice(0, -1);
  }
  return `${parsed.protocol}//${host}${pathname}`;
}
