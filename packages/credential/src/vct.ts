/**
 * The frozen credential-type registry. PLAN.html §8.
 *
 * Schema rule: every `vct` is versioned and immutable once published. A schema
 * change means a NEW vct plus an ADR in docs/decisions — never an edit in place.
 * Verifiers abroad pin against these identifiers and we cannot break them.
 */

import { CredentialError } from './types.js';

export type ClaimType = 'string' | 'integer' | 'number' | 'boolean' | 'date' | 'digest';

export interface ClaimDefinition {
  readonly name: string;
  readonly type: ClaimType;
  readonly required: boolean;
  /** Shown in the wallet's claim-scope picker and in the verifier's request UI. */
  readonly label: string;
  readonly maxLength?: number;
  readonly min?: number;
  readonly max?: number;
  readonly enum?: readonly string[];
  /** True for claims a verifier should have to justify (grades, ID fragments). */
  readonly sensitive?: boolean;
}

export interface CredentialTypeDefinition {
  readonly vct: string;
  readonly displayName: string;
  /** ISO date the schema was frozen. After this, the definition never changes. */
  readonly frozenAt: string;
  /** Whether credentials of this type carry a meaningful `exp`. */
  readonly expires: boolean;
  /** Whether a suspended state is meaningful (licences yes, degrees no). */
  readonly suspendable: boolean;
  readonly disclosableClaims: readonly ClaimDefinition[];
}

const DEGREE_LEVELS = ['BACHELOR', 'MASTER', 'MPHIL', 'PHD', 'DIPLOMA', 'CERTIFICATE'] as const;
const RESULT_CLASSES = [
  'FIRST_CLASS',
  'SECOND_CLASS',
  'THIRD_CLASS',
  'DISTINCTION',
  'PASS',
  'NOT_CLASSIFIED',
] as const;

const NAME_CLAIMS: readonly ClaimDefinition[] = [
  { name: 'given_name', type: 'string', required: true, label: 'Given name', maxLength: 120 },
  { name: 'family_name', type: 'string', required: true, label: 'Family name', maxLength: 120 },
  { name: 'name_bn', type: 'string', required: false, label: 'Name (Bangla)', maxLength: 160 },
  { name: 'date_of_birth', type: 'date', required: true, label: 'Date of birth', sensitive: true },
  {
    name: 'national_id_last4',
    type: 'string',
    required: false,
    label: 'National ID (last 4)',
    maxLength: 4,
    sensitive: true,
  },
];

export const ACADEMIC_DEGREE_V1: CredentialTypeDefinition = {
  vct: 'bd.civiledger.academic.degree.v1',
  displayName: 'Academic degree',
  frozenAt: '2026-09-01',
  expires: false,
  suspendable: false,
  disclosableClaims: [
    ...NAME_CLAIMS,
    { name: 'programme', type: 'string', required: true, label: 'Programme', maxLength: 200 },
    {
      name: 'degree_level',
      type: 'string',
      required: true,
      label: 'Degree level',
      enum: DEGREE_LEVELS,
    },
    { name: 'major', type: 'string', required: false, label: 'Major', maxLength: 200 },
    {
      name: 'result_cgpa',
      type: 'number',
      required: false,
      label: 'CGPA',
      min: 0,
      max: 5,
      sensitive: true,
    },
    {
      name: 'result_class',
      type: 'string',
      required: false,
      label: 'Class',
      enum: RESULT_CLASSES,
      sensitive: true,
    },
    { name: 'graduation_date', type: 'date', required: true, label: 'Graduation date' },
    {
      name: 'registration_no',
      type: 'string',
      required: true,
      label: 'Registration number',
      maxLength: 64,
    },
    { name: 'transcript_digest', type: 'digest', required: false, label: 'Transcript digest' },
    { name: 'photo_digest', type: 'digest', required: false, label: 'Photo digest' },
  ],
};

export const ACADEMIC_TRANSCRIPT_V1: CredentialTypeDefinition = {
  vct: 'bd.civiledger.academic.transcript.v1',
  displayName: 'Academic transcript',
  frozenAt: '2026-09-01',
  expires: false,
  suspendable: false,
  disclosableClaims: [
    ...NAME_CLAIMS,
    { name: 'programme', type: 'string', required: true, label: 'Programme', maxLength: 200 },
    {
      name: 'registration_no',
      type: 'string',
      required: true,
      label: 'Registration number',
      maxLength: 64,
    },
    {
      name: 'credits_earned',
      type: 'number',
      required: false,
      label: 'Credits earned',
      min: 0,
      max: 1000,
      sensitive: true,
    },
    {
      name: 'result_cgpa',
      type: 'number',
      required: false,
      label: 'CGPA',
      min: 0,
      max: 5,
      sensitive: true,
    },
    {
      // A JSON string of per-course results. Kept as one claim so a verifier
      // takes the whole transcript or none of it — partial grade disclosure
      // invites cherry-picking.
      name: 'courses_json',
      type: 'string',
      required: true,
      label: 'Course results',
      maxLength: 64000,
      sensitive: true,
    },
    { name: 'graduation_date', type: 'date', required: false, label: 'Graduation date' },
  ],
};

export const ACADEMIC_ENROLMENT_V1: CredentialTypeDefinition = {
  vct: 'bd.civiledger.academic.enrolment.v1',
  displayName: 'Enrolment status',
  frozenAt: '2026-09-01',
  expires: true,
  suspendable: true,
  disclosableClaims: [
    ...NAME_CLAIMS,
    { name: 'programme', type: 'string', required: true, label: 'Programme', maxLength: 200 },
    {
      name: 'registration_no',
      type: 'string',
      required: true,
      label: 'Registration number',
      maxLength: 64,
    },
    {
      name: 'enrolment_status',
      type: 'string',
      required: true,
      label: 'Status',
      enum: ['ENROLLED', 'ON_LEAVE', 'GRADUATED', 'WITHDRAWN'],
    },
    { name: 'current_term', type: 'string', required: false, label: 'Current term', maxLength: 40 },
    { name: 'expected_completion', type: 'date', required: false, label: 'Expected completion' },
  ],
};

export const PROFESSIONAL_LICENCE_V1: CredentialTypeDefinition = {
  vct: 'bd.civiledger.professional.licence.v1',
  displayName: 'Professional licence',
  frozenAt: '2026-09-01',
  expires: true,
  suspendable: true,
  disclosableClaims: [
    ...NAME_CLAIMS,
    {
      name: 'licence_number',
      type: 'string',
      required: true,
      label: 'Licence number',
      maxLength: 64,
    },
    { name: 'profession', type: 'string', required: true, label: 'Profession', maxLength: 120 },
    { name: 'scope', type: 'string', required: false, label: 'Scope of practice', maxLength: 400 },
    { name: 'first_licensed', type: 'date', required: false, label: 'First licensed' },
    {
      name: 'standing',
      type: 'string',
      required: true,
      label: 'Standing',
      enum: ['GOOD_STANDING', 'CONDITIONAL', 'UNDER_REVIEW'],
    },
  ],
};

const REGISTRY = new Map<string, CredentialTypeDefinition>(
  [ACADEMIC_DEGREE_V1, ACADEMIC_TRANSCRIPT_V1, ACADEMIC_ENROLMENT_V1, PROFESSIONAL_LICENCE_V1].map(
    (d) => [d.vct, d],
  ),
);

export function listCredentialTypes(): CredentialTypeDefinition[] {
  return [...REGISTRY.values()];
}

export function getCredentialType(vct: string): CredentialTypeDefinition | undefined {
  return REGISTRY.get(vct);
}

export function requireCredentialType(vct: string): CredentialTypeDefinition {
  const def = REGISTRY.get(vct);
  if (!def) {
    throw new CredentialError('UNKNOWN_VCT', `unknown credential type "${vct}"`);
  }
  return def;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const HEX_DIGEST = /^[0-9a-f]{64}$/;

export interface ClaimValidationIssue {
  claim: string;
  message: string;
}

/**
 * Validate a claim set against a frozen vct. Returns every problem rather than
 * throwing on the first, because the issuer console shows these as a review
 * queue over a whole CSV import.
 */
export function validateClaims(
  vct: string,
  claims: Record<string, unknown>,
): ClaimValidationIssue[] {
  const def = requireCredentialType(vct);
  const issues: ClaimValidationIssue[] = [];
  const known = new Set(def.disclosableClaims.map((c) => c.name));

  for (const name of Object.keys(claims)) {
    if (!known.has(name)) {
      issues.push({ claim: name, message: `claim is not part of ${vct}` });
    }
  }

  for (const claim of def.disclosableClaims) {
    const value = claims[claim.name];
    if (value === undefined || value === null || value === '') {
      if (claim.required) {
        issues.push({ claim: claim.name, message: 'required claim is missing' });
      }
      continue;
    }
    issues.push(...validateOne(claim, value));
  }

  return issues;
}

function validateOne(claim: ClaimDefinition, value: unknown): ClaimValidationIssue[] {
  const fail = (message: string): ClaimValidationIssue[] => [{ claim: claim.name, message }];

  switch (claim.type) {
    case 'string':
    case 'date':
    case 'digest': {
      if (typeof value !== 'string') return fail('expected a string');
      if (claim.maxLength !== undefined && value.length > claim.maxLength) {
        return fail(`longer than ${claim.maxLength} characters`);
      }
      if (claim.type === 'date' && !ISO_DATE.test(value)) {
        return fail('expected an ISO date (YYYY-MM-DD)');
      }
      if (claim.type === 'date' && Number.isNaN(Date.parse(value))) {
        return fail('is not a real calendar date');
      }
      if (claim.type === 'digest' && !HEX_DIGEST.test(value)) {
        return fail('expected a lowercase hex sha-256 digest');
      }
      if (claim.enum && !claim.enum.includes(value)) {
        return fail(`expected one of: ${claim.enum.join(', ')}`);
      }
      return [];
    }
    case 'integer':
    case 'number': {
      if (typeof value !== 'number' || !Number.isFinite(value)) return fail('expected a number');
      if (claim.type === 'integer' && !Number.isInteger(value)) return fail('expected an integer');
      if (claim.min !== undefined && value < claim.min)
        return fail(`must be at least ${claim.min}`);
      if (claim.max !== undefined && value > claim.max) return fail(`must be at most ${claim.max}`);
      return [];
    }
    case 'boolean': {
      if (typeof value !== 'boolean') return fail('expected a boolean');
      return [];
    }
    default: {
      const exhaustive: never = claim.type;
      return fail(`unsupported claim type ${String(exhaustive)}`);
    }
  }
}
