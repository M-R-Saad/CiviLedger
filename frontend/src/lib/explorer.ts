/**
 * Block-explorer link helpers. On a local Hardhat network there is no explorer,
 * so `VITE_EXPLORER_BASE_URL` is unset and these return null; callers should
 * simply not render a link in that case.
 */
const base = (import.meta.env.VITE_EXPLORER_BASE_URL || "").replace(/\/$/, "");

export function txUrl(hash: string): string | null {
  return base && hash ? `${base}/tx/${hash}` : null;
}

export function addressUrl(address: string): string | null {
  return base && address ? `${base}/address/${address}` : null;
}
