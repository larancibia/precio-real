/**
 * Public catalog filtering helpers.
 *
 * We only want obvious test / synthetic rows to stay out of public sample
 * endpoints. The helper is intentionally narrow: it filters rows that were
 * clearly inserted for testing, not normal catalog entries.
 */

import type { ProductRow } from "../types";

const TEST_TITLE_PREFIX = "test precio real";
const TEST_URL_MARKER = "test-precio-real";

export function isSyntheticPublicProduct(row: Pick<ProductRow, "title" | "url">): boolean {
  const title = row.title?.trim().toLowerCase() ?? "";
  const url = row.url.trim().toLowerCase();

  return title.startsWith(TEST_TITLE_PREFIX) || url.includes(TEST_URL_MARKER);
}

export function publicProductWhere(alias = ""): string {
  const prefix = alias ? `${alias}.` : "";
  return (
    `NOT (` +
    `LOWER(COALESCE(${prefix}title, '')) LIKE 'test precio real%' OR ` +
    `LOWER(COALESCE(${prefix}url, '')) LIKE '%test-precio-real%'` +
    `)`
  );
}
