/**
 * Issuer signing keys. PLAN.html §7.1, §12.1, invariant §25.
 *
 * "Issuer signing keys are non-exportable and never held by CiviLedger in a
 * unilaterally usable form." That is the single most load-bearing rule in the
 * system: if we can sign as a university, the ledger proves nothing.
 *
 * This module is the seam that keeps the rule enforceable. The rest of the API
 * only ever sees a `CredentialSigner` — an object that turns a signing input
 * into a signature — and never a private key. Where that signer comes from is
 * a deployment decision:
 *
 *   - `KmsSignerProvider` calls a cloud KMS or HSM in the issuer's own tenant.
 *     The private key is created non-exportable and we hold, at most, a
 *     permission to invoke it that the institution can revoke.
 *
 *   - `LocalDevSignerProvider` holds keys in the database, encrypted. It exists
 *     for the synthetic-data devnet and the test suite. It refuses to start in
 *     production or once real personal data has been enabled, because using it
 *     there would quietly break the invariant above.
 */

import {
  createLocalSigner,
  thumbprintToBytes32,
  type CredentialSigner,
  type JwkPublicEc,
} from '@civiledger/credential';
import type { PrismaClient } from '@prisma/client';
import { decryptJson, type KeyRing } from '../lib/crypto.js';

export interface SignerHandle {
  signer: CredentialSigner;
  thumbprint: string;
  publicJwk: JwkPublicEc;
  epoch: number;
}

export interface SignerProvider {
  readonly kind: 'kms' | 'local-dev';
  /** Resolve the current signing key for an organisation. */
  forOrganization(organizationId: string): Promise<SignerHandle>;
}

export class SignerUnavailableError extends Error {
  public readonly code = 'SIGNER_UNAVAILABLE';
  constructor(message: string) {
    super(message);
    this.name = 'SignerUnavailableError';
  }
}

/**
 * Development signer. Keys are stored encrypted in `issuer_keys.kms_key_ref`
 * as an envelope-encrypted private JWK.
 */
export class LocalDevSignerProvider implements SignerProvider {
  public readonly kind = 'local-dev' as const;
  private readonly cache = new Map<string, SignerHandle>();

  constructor(
    private readonly prisma: PrismaClient,
    private readonly keyRing: KeyRing,
    options: { isProduction: boolean; allowRealPersonalData: boolean },
  ) {
    if (options.isProduction || options.allowRealPersonalData) {
      throw new SignerUnavailableError(
        'LocalDevSignerProvider cannot be used in production or with real personal data enabled — ' +
          'configure a KMS-backed signer (PLAN §12.1, invariant §25)',
      );
    }
  }

  async forOrganization(organizationId: string): Promise<SignerHandle> {
    const cached = this.cache.get(organizationId);
    if (cached) return cached;

    const key = await this.prisma.issuerKey.findFirst({
      where: { organizationId, validUntil: null, revokedReason: null },
      orderBy: { epoch: 'desc' },
    });
    if (!key) {
      throw new SignerUnavailableError(`organisation ${organizationId} has no current signing key`);
    }
    if (!key.kmsKeyRef.startsWith('localdev:')) {
      throw new SignerUnavailableError(
        `key ${key.id} is not a local development key; a KMS provider is required`,
      );
    }

    const privateJwk = decryptJson<Record<string, unknown>>(
      this.keyRing,
      Buffer.from(key.kmsKeyRef.slice('localdev:'.length), 'base64'),
    );

    const signer = await createLocalSigner(privateJwk, `${organizationId}-${key.epoch}`);
    // `issuer_keys.jwk_thumbprint` holds the chain-facing bytes32 form.
    if (thumbprintToBytes32(signer.thumbprint) !== key.jwkThumbprint) {
      // The registry's thumbprint is what verifiers resolve. A mismatch means
      // the stored key is not the one the chain vouches for.
      throw new SignerUnavailableError(
        `stored key for ${organizationId} does not match its registered thumbprint`,
      );
    }

    const handle: SignerHandle = {
      signer,
      thumbprint: key.jwkThumbprint,
      publicJwk: key.publicJwk as unknown as JwkPublicEc,
      epoch: key.epoch,
    };
    this.cache.set(organizationId, handle);
    return handle;
  }

  /** Drop a cached signer after a rotation. */
  invalidate(organizationId: string): void {
    this.cache.delete(organizationId);
  }
}

/**
 * Production signer. Delegates to a KMS that holds a non-exportable P-256 key.
 *
 * Deliberately left as an explicit integration point rather than a guess at one
 * vendor's SDK: the key must live in the *institution's* tenant, so the client
 * is chosen when the first issuer signs their MoU. Implement `sign` against
 * that KMS's raw ECDSA-SHA256 operation and return a 64-byte R||S signature —
 * `derToJoseSignature` in @civiledger/credential converts DER if the KMS
 * returns it.
 */
export class KmsSignerProvider implements SignerProvider {
  public readonly kind = 'kms' as const;

  constructor(private readonly resolve: (organizationId: string) => Promise<SignerHandle>) {}

  async forOrganization(organizationId: string): Promise<SignerHandle> {
    return this.resolve(organizationId);
  }
}
