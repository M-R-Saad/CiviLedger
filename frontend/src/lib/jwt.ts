/**
 * Reads the `exp` claim (seconds since epoch) from a JWT without verifying the
 * signature. Used only to drop an obviously-expired session on the client before
 * it makes a doomed request; the server still verifies every token.
 */
export function decodeExp(token: string): number | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const json = JSON.parse(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
    );
    return typeof json.exp === "number" ? json.exp : null;
  } catch {
    return null;
  }
}
