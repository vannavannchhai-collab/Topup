import { randomBytes, randomUUID } from 'node:crypto';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const uuid = (): string => randomUUID();

/** Human-friendly reference, e.g. NOVA-7QK4-XR2M */
export function reference(prefix = 'NOVA'): string {
  const pick = (n: number) =>
    Array.from(randomBytes(n))
      .map((byte) => ALPHABET[byte % ALPHABET.length])
      .join('');
  return `${prefix}-${pick(4)}-${pick(4)}`;
}

/** Voucher-style delivery code for a top-up. */
export function deliveryCode(category: string): string {
  const tag = category.slice(0, 3).toUpperCase();
  return `${tag}-${reference('D').split('-').slice(1).join('-')}`;
}

export const nowIso = (): string => new Date().toISOString();
