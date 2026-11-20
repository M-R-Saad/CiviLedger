/**
 * base64url helpers (RFC 4648 §5, no padding).
 *
 * SD-JWT digests are computed over the *ASCII bytes of the base64url disclosure
 * string*, not over the decoded JSON, so every conversion here has to be exact.
 */

export function encodeBase64Url(input: Uint8Array | string): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  return Buffer.from(bytes).toString('base64url');
}

export function decodeBase64Url(input: string): Uint8Array {
  return new Uint8Array(Buffer.from(input, 'base64url'));
}

export function decodeBase64UrlToString(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8');
}

/** Strict check: base64url alphabet, unpadded, non-empty. */
export function isBase64Url(input: string): boolean {
  return input.length > 0 && /^[A-Za-z0-9_-]+$/.test(input);
}
