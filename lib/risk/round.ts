/**
 * Decimal rounding, halves towards +∞. `Math.round(x * 10) / 10` misrounds values whose
 * binary form sits just below the half (e.g. 6.45 → 6.4); shifting the decimal exponent avoids that.
 */
export function roundTo(value: number, decimals: number): number {
  if (!Number.isFinite(value)) return value;
  const [mantissa, exponent = "0"] = String(value).split("e");
  const shifted = Math.round(Number(`${mantissa}e${Number(exponent) + decimals}`));
  const [shiftedMantissa, shiftedExponent = "0"] = String(shifted).split("e");
  return Number(`${shiftedMantissa}e${Number(shiftedExponent) - decimals}`);
}
