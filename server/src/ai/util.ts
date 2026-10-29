/** Shared formatting helpers for AI-generated copy (server-side). */
export const money = (cents: number): string => `$${(cents / 100).toFixed(2)}`;
