/**
 * @civiledger/credential — SD-JWT VC issuance, presentation and verification.
 *
 * Pure: no filesystem, no network, no database, no ambient clock. Everything
 * time- or key-dependent is injected so the same code runs in the API, in the
 * anchor worker, in a browser, and inside the MIT-licensed public verifier.
 */

export * from './types.js';
export * from './vct.js';
export * from './signer.js';
export {
  createDisclosure,
  createDecoyDigests,
  parseDisclosure,
  digestOf,
  systemRandom,
  SD_ALG,
  type RandomSource,
} from './disclosure.js';
export {
  encodeBase64Url,
  decodeBase64Url,
  decodeBase64UrlToString,
  isBase64Url,
} from './base64url.js';
export { issueCredential, SD_JWT_VC_TYP, type IssueOptions } from './issue.js';
export {
  presentCredential,
  parseSdJwt,
  KB_JWT_TYP,
  type PresentOptions,
  type KeyBindingOptions,
  type ParsedSdJwt,
} from './present.js';
export { verifyCredential, type VerifyOptions, type IssuerKeyResolution } from './verify.js';
