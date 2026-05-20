# Public data quality policy

This policy defines how Precio Real describes coverage, freshness, retailer reliability and launch metrics in public copy. It is a product policy, not a runtime guarantee.

## Public claim standard

Precio Real may say that it shows price history and deal context when a supported retailer and product have enough recent public observations. Public copy must not say or imply that all retailers, all products, all discounts or every price on a site are covered.

Acceptable wording:

- "Supported retailers" means the extension has host permissions and product-page detection for that retailer.
- "Tracked products" means products with at least one stored public price observation.
- "Deal context" means the current price is compared against stored observations for the same product URL or a documented canonical equivalent.

Avoid wording such as "every product", "all retailers", "guaranteed accurate", "confirmed savings" or "always detects fake discounts".

## Freshness tiers

Freshness is based on the most recent successful public price observation for the product or retailer.

| Tier | Threshold | Public behavior |
| --- | --- | --- |
| Fresh | Last successful observation is within the last 24 hours. | Show normal history and verdict copy if the confidence rules below are met. |
| Recent | Last successful observation is older than 24 hours and no older than 7 days. | Show history with freshness context. Verdict copy should be cautious. |
| Stale | Last successful observation is older than 7 days and no older than 30 days. | Show history as stale. Do not call a deal trustworthy based only on this data. |
| Expired | Last successful observation is older than 30 days, or the latest observation date is unknown. | Treat as insufficient data for a deal verdict. |

## Retailer status labels

Retailer status labels are owner-facing and may be reflected publicly when useful.

| Status | Definition | Public behavior |
| --- | --- | --- |
| Supported | Product-page detection is configured and recent observations succeed. | Retailer can appear in supported lists. |
| Degraded | Detection works for some products, but selectors, availability or parsing are inconsistent. | Keep the retailer listed only with cautious wording. |
| Stale | No successful retailer observation in more than 7 days. | Do not present the retailer as actively fresh. |
| Blocked | The retailer blocks scraping, returns bot challenges, or systematically prevents price observations. | Show "sin datos recientes" or hide deal verdicts for affected products. |
| Removed | Detection is no longer maintained or the retailer no longer has useful public product pages. | Remove from public supported-retailer claims. |

## Minimum quality for a trustworthy deal

A deal may be shown as trustworthy only when all of these conditions are true:

- The retailer status is Supported or Degraded, not Stale, Blocked or Removed.
- The latest product observation is Fresh or Recent.
- The product has at least 5 valid observations.
- Observations cover at least 7 days of history.
- The current price is a sane positive ARS price and is not an obvious parse error.
- The comparison baseline excludes the current event window when possible.

If any condition is missing, public UI and copy should use neutral language such as "sin datos suficientes", "historial limitado" or "datos desactualizados". No guarantee of savings, compliance, price accuracy or retailer completeness is provided.

## Stale and blocked data behavior

When product data is stale, Precio Real can show historical context, but should not present the badge as a final deal verdict. When a retailer is blocked, the product should show no recent data or insufficient-data copy rather than an inflated, real or neutral verdict.

Blocked retailers should remain visible to owners as operational work, but public launch copy should not count them as actively fresh retailers.

## Owner-facing launch metrics

Launch reporting should track these metrics at minimum:

- Tracked products: count of products with at least one valid stored observation.
- Prices in last 24 hours: count of valid observations recorded during the last 24 hours.
- Supported retailers: count of retailers with configured support and at least one successful recent observation.
- Stale retailers: count of configured retailers with no successful observation in more than 7 days.
- Last successful run: timestamp of the latest successful scraper or observation run.

These metrics should be described as operational indicators, not as proof of complete market coverage.
In public reporting, label them exactly as tracked products, prices in last 24 hours, supported retailers, stale retailers and last successful run.

## Policy review

Review this policy before launches, store submissions and campaign pages. If scraper behavior changes, update public copy and this policy in the same pull request.
