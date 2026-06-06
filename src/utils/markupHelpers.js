/**
 * Markup / Suggested Retail Price (SRP) helpers.
 *
 * SRP is derived from a net (VAT-exclusive) cost basis plus a markup. The
 * markup can be expressed either as a percentage or an exact amount; the user
 * enters one and the other is derived against the current net cost.
 *
 *   markupAmount     = netCost * (markupPercentage / 100)
 *   markupPercentage = netCost > 0 ? (markupAmount / netCost) * 100 : 0
 *   SRP              = netCost + markupAmount  ==  netCost * (1 + markupPercentage / 100)
 *
 * `markupPercentage` is the canonical stored driver, so a displayed SRP scales
 * with the (changing) net cost over time. `markupAmount` is stored as the
 * snapshot the user entered. No VAT is added — a transfer/markup does not add
 * tax, matching the app's net-cost convention.
 */

const toNumber = value => {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
};

/** Exact markup amount derived from a percentage against the net cost. */
export function computeMarkupAmount(netCost, markupPercentage) {
  return toNumber(netCost) * (toNumber(markupPercentage) / 100);
}

/** Markup percentage derived from an exact amount against the net cost. */
export function computeMarkupPercentage(netCost, markupAmount) {
  const net = toNumber(netCost);
  if (net <= 0) return 0;
  return (toNumber(markupAmount) / net) * 100;
}

/**
 * SRP from the canonical markup percentage. Use this on display screens so the
 * SRP tracks the current net cost.
 */
export function computeSrpFromPercentage(netCost, markupPercentage) {
  return toNumber(netCost) * (1 + toNumber(markupPercentage) / 100);
}

/**
 * SRP from an exact markup amount. Use this in forms while the user is typing
 * an amount, so SRP stays intuitive even when net cost is unknown (0).
 */
export function computeSrpFromAmount(netCost, markupAmount) {
  return toNumber(netCost) + toNumber(markupAmount);
}

/**
 * SRP inclusive of the selling-side Sales Tax. SRP itself is net (VAT-exclusive,
 * = net cost + markup); the effective sales tax is added on top to get the
 * tax-inclusive retail price a customer pays. A 0 / missing rate returns the
 * net SRP unchanged.
 *
 * `taxRatePercentage` must be the *effective* selling tax rate — the per-item
 * Sales Tax, falling back to the cost tax when none is set — i.e. the same
 * `sales_tax_rate_percentage` the POS uses (see salesCounter.js).
 */
export function computeSrpWithTax(srp, taxRatePercentage) {
  return toNumber(srp) * (1 + toNumber(taxRatePercentage) / 100);
}
