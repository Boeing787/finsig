import Decimal from 'decimal.js';

export function toMinor(value: string, currency: string): bigint {
  if (currency !== 'USD') throw new Error(`Unsupported currency for MVP: ${currency}`);
  const decimal = new Decimal(value);
  if (!decimal.isFinite() || decimal.decimalPlaces() > 2) {
    throw new Error(`Invalid USD amount: ${value}`);
  }
  return BigInt(decimal.mul(100).toFixed(0));
}

export function fromMinor(value: bigint): string {
  return new Decimal(value.toString()).div(100).toFixed(2);
}
