/**
 * @civiledger/verifier — the public verification library (MIT).
 *
 * A verification that depends on our uptime and honesty is not verification
 * (PLAN §16). This package performs the whole six-step check against ports you
 * supply, so a foreign employer can verify a CiviLedger credential without
 * making a single request to us.
 */

export * from './types.js';
export { verifyPresentation, type VerifyPresentationOptions } from './verify.js';
