/**
 * Bilingual strings. PRODUCT.md principle 3.
 *
 * The API and the verifier library emit stable machine codes and never
 * user-facing English. This is where a code becomes a sentence, which is what
 * makes the Bangla version a first-class translation rather than an
 * afterthought bolted onto English copy.
 *
 * Copy is written for a nervous graduate or a busy HR officer, not for an
 * engineer. "This certificate is genuine" beats "VALID".
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export const LOCALES = ['en', 'bn'] as const;
export type Locale = (typeof LOCALES)[number];

type Dictionary = Record<string, string>;

const en: Dictionary = {
  'brand.name': 'CiviLedger',
  'lang.toggle': 'বাংলা',
  'lang.label': 'Language',
  'skip.main': 'Skip to main content',

  'action.verify': 'Verify',
  'action.verifyAnother': 'Verify another',
  'action.retry': 'Try again',
  'action.cancel': 'Cancel',
  'action.close': 'Close',
  'action.copy': 'Copy',
  'action.copied': 'Copied',
  'action.signIn': 'Sign in',
  'action.signOut': 'Sign out',
  'action.share': 'Share',
  'action.revoke': 'Revoke',
  'action.approve': 'Approve and sign',
  'action.upload': 'Upload',
  'action.download': 'Download report',
  'action.back': 'Back',
  'action.viewDetails': 'View details',

  'common.loading': 'Loading',
  'common.of': 'of',
  'common.showing': 'Showing',
  'common.none': 'None',
  'common.never': 'Never',
  'common.optional': 'optional',
  'common.required': 'required',
  'common.issuer': 'Issuer',
  'common.issued': 'Issued',
  'common.expires': 'Expires',
  'common.noExpiry': 'Does not expire',
  'common.checkedAt': 'Checked',

  // --- verification verdicts ------------------------------------------
  'result.valid': 'This credential is genuine',
  'result.valid.body': 'The issuing institution signed it, and it has not been withdrawn.',
  'result.revoked': 'This credential has been withdrawn',
  'result.revoked.body':
    'The issuing institution revoked it. Do not accept it as proof of the award.',
  'result.suspended': 'This credential is suspended',
  'result.suspended.body':
    'The issuing institution has paused it. Ask the holder for current proof.',
  'result.expired': 'This credential has expired',
  'result.expired.body': 'It was genuine when issued, but its validity period has ended.',
  'result.invalid': 'This credential does not check out',
  'result.invalid.body': 'It failed at least one check. Treat it as unverified.',
  'result.unknown_issuer': 'We do not recognise this issuer',
  'result.unknown_issuer.body':
    'The institution that signed this is not in the CiviLedger registry. That does not prove the document is false, only that we cannot vouch for it.',
  'result.undetermined': 'We could not complete the check',
  'result.undetermined.body':
    'Something we needed was unreachable. This is not a pass. Try again in a moment.',

  'basis.live': 'Checked live against the ledger',
  'basis.cached': 'Checked against a saved copy of the registry',
  'basis.cached.at': 'Registry snapshot from {at}',

  // --- the six checks --------------------------------------------------
  'check.issuer_known': 'Issuer is in the registry',
  'check.issuer_key_valid_at_signing': 'Signing key was valid when this was signed',
  'check.signature': 'Signature covers the disclosed details',
  'check.status': 'Not revoked',
  'check.status_list_anchored': 'Revocation list matches the ledger',
  'check.anchor_inclusion': 'Recorded in a published batch',
  'check.holder_binding': 'Presented by the holder',

  // --- check codes -----------------------------------------------------
  'code.ISSUER_ACTIVE': 'Registered and active',
  'code.ISSUER_SUSPENDED': 'This institution is currently suspended',
  'code.ISSUER_RETIRED': 'This institution no longer issues credentials',
  'code.ISSUER_PENDING': 'This institution has not been admitted yet',
  'code.ISSUER_NOT_IN_REGISTRY': 'Not found in the registry',
  'code.REGISTRY_UNREACHABLE': 'The registry could not be reached',
  'code.KEY_VALID_AT_SIGNING': 'Valid at the time of signing',
  'code.KEY_NOT_VALID_AT_SIGNING': 'The key was not valid when this was signed',
  'code.SIGNATURE_OK': 'Signature verified',
  'code.BAD_SIGNATURE': 'The signature does not match',
  'code.UNMATCHED_DISCLOSURE': 'A detail was added after the institution signed',
  'code.DUPLICATE_CLAIM': 'The same detail was sent twice',
  'code.EXPIRED': 'Past its validity period',
  'code.STATUS_CLEAR': 'Not revoked',
  'code.CREDENTIAL_REVOKED': 'Revoked by the issuing institution',
  'code.CREDENTIAL_SUSPENDED': 'Suspended by the issuing institution',
  'code.NO_STATUS_LIST': 'This type cannot be revoked',
  'code.STATUS_LIST_UNREACHABLE': 'The revocation list could not be reached',
  'code.LIST_MATCHES_CHAIN': 'Matches the ledger record',
  'code.LIST_MATCHES_CHAIN_BUT_STALE': 'Matches the ledger, but the list is overdue for refresh',
  'code.LIST_ANCHOR_PENDING': 'A recent change is not yet confirmed on the ledger',
  'code.LIST_NOT_ANCHORED': 'Not confirmed against the ledger',
  'code.CHAIN_UNREACHABLE': 'The ledger could not be reached',
  'code.VERSION_ROLLBACK': 'An out-of-date revocation list was served',
  'code.CHAIN_HASH_MISMATCH': 'The revocation list does not match the ledger record',
  'code.CHAIN_VERSION_MISMATCH': 'The revocation list is older than the ledger record',
  'code.URI_MISMATCH': 'The revocation list came from an unexpected address',
  'code.ANCHOR_INCLUDED': 'Found in the published batch',
  'code.ANCHOR_NOT_INCLUDED': 'Not found in the batch it claims',
  'code.ANCHOR_NOT_PRESENTED': 'No batch proof was included',
  'code.ANCHOR_UNREACHABLE': 'The batch record could not be reached',
  'code.HOLDER_BINDING_VERIFIED': 'The holder proved they control this credential',
  'code.HOLDER_BINDING_ABSENT': 'Possession was not proved',
  'code.KEY_BINDING_REQUIRED': 'Proof of possession was required but not given',
  'code.MALFORMED_SD_JWT': 'This is not a CiviLedger credential',
  'code.MALFORMED_CREDENTIAL': 'This is not a CiviLedger credential',
  'code.SHARE_LINK_EXPIRED': 'This link has expired',
  'code.SHARE_LINK_USED_UP': 'Already used',
  'code.SHARE_LINK_REVOKED': 'Withdrawn by the holder',

  // --- assurance -------------------------------------------------------
  'assurance.label': 'How this was checked',
  'assurance.AL0': 'Self-asserted, not checked',
  'assurance.AL1': 'Document scan matched to the institution record',
  'assurance.AL2': 'Confirmed by institution staff against their records',
  'assurance.AL3': 'Issued directly from the institution system at graduation',
  'assurance.AL3+': 'Issued at graduation, with a verified identity check',
  'assurance.AL3_PLUS': 'Issued at graduation, with a verified identity check',
  'assurance.explain':
    'Not every credential is checked the same way. This tells you exactly what the institution did.',

  'evidence.method.SELF_ASSERTED': 'Self-asserted',
  'evidence.method.DOCUMENT_SCAN_OCR': 'Document scan, matched by name',
  'evidence.method.REGISTRAR_SOURCE_CHECK': 'Registrar checked the institution record',
  'evidence.method.SYSTEM_OF_RECORD_SYNC': 'Read directly from the institution system',
  'evidence.method.SYSTEM_OF_RECORD_SYNC_WITH_ID_CHECK':
    'Read from the institution system, with an identity check',

  'accreditation.UGC_RECOGNIZED': 'UGC recognised',
  'accreditation.BOARD': 'Education board',
  'accreditation.PROFESSIONAL_BODY': 'Professional body',
  'accreditation.SELF_ASSERTED': 'Not accredited',

  // --- credential states ----------------------------------------------
  'state.ISSUED': 'Active',
  'state.DRAFT': 'Draft',
  'state.REVOKED': 'Revoked',
  'state.SUSPENDED': 'Suspended',
  'state.SUPERSEDED': 'Replaced',

  'batch.DRAFT': 'Draft',
  'batch.PENDING_APPROVAL': 'Awaiting approval',
  'batch.APPROVED': 'Approved',
  'batch.SIGNING': 'Signing',
  'batch.ANCHORING': 'Recording on the ledger',
  'batch.PUBLISHED': 'Published',
  'batch.FAILED': 'Failed',

  'import.UPLOADED': 'Uploaded',
  'import.REVIEW': 'Awaiting review',
  'import.APPROVED': 'Approved',
  'import.REJECTED': 'Rejected',

  'row.READY': 'Ready',
  'row.CONFLICT': 'Needs attention',
  'row.ISSUED': 'Issued',
  'row.REJECTED': 'Rejected',
  'row.PENDING': 'Pending',

  // --- claims -----------------------------------------------------------
  'claim.given_name': 'Given name',
  'claim.family_name': 'Family name',
  'claim.name_bn': 'Name in Bangla',
  'claim.date_of_birth': 'Date of birth',
  'claim.national_id_last4': 'National ID (last 4)',
  'claim.programme': 'Programme',
  'claim.degree_level': 'Degree level',
  'claim.major': 'Major',
  'claim.result_cgpa': 'CGPA',
  'claim.result_class': 'Class',
  'claim.graduation_date': 'Graduation date',
  'claim.registration_no': 'Registration number',
  'claim.transcript_digest': 'Transcript fingerprint',
  'claim.photo_digest': 'Photo fingerprint',
  'claim.licence_number': 'Licence number',
  'claim.profession': 'Profession',
  'claim.standing': 'Standing',
  'claim.enrolment_status': 'Enrolment status',
  'claim.courses_json': 'Course results',
  'claim.credits_earned': 'Credits earned',
  'claim.current_term': 'Current term',
  'claim.expected_completion': 'Expected completion',
  'claim.scope': 'Scope of practice',
  'claim.first_licensed': 'First licensed',

  'claims.disclosed': 'Details shared with you',
  'claims.withheld': 'Withheld by the holder',
  'claims.withheld.explain':
    'The holder chose not to share these. That is normal and does not affect whether the credential is genuine.',

  // --- evidence labels --------------------------------------------------
  'evidence.orgId': 'Institution ID',
  'evidence.didWeb': 'Institution identifier',
  'evidence.keyThumbprint': 'Signing key',
  'evidence.signedAt': 'Signed at',
  'evidence.listVersion': 'Revocation list version',
  'evidence.listHash': 'Revocation list fingerprint',
  'evidence.batchId': 'Batch',

  // --- verification page ------------------------------------------------
  'start.title': 'Check a credential',
  'start.body':
    'Scan the QR code on the document, or paste the verification link you were given. You do not need an account.',
  'start.label': 'Verification link or code',
  'start.hint': 'It looks like a web address, or a long string of letters and numbers.',
  'start.badToken': 'That does not look like a CiviLedger verification link.',
  'start.openTitle': 'You do not have to take our word for it',
  'start.openBody':
    'The verification method is published, and the library that performs it is open source. Anyone can reproduce this answer without using our servers.',
  'start.openLink': 'Read the specification',
  'result.recheck': 'Check again',
  'footer.note': 'Every institution that can issue through CiviLedger is listed publicly.',
  'footer.registry': 'View the issuer registry',

  'error.notFound': 'We could not find that credential',
  'error.notFound.body':
    'The link may have been mistyped, or the holder may have withdrawn it. Ask them for a new one.',
  'error.expired.body':
    'Verification links are deliberately short-lived. Ask the holder to send a fresh one.',
  'error.offline': 'We could not reach the service',
  'error.offline.body': 'Check your connection and try again.',
  'error.generic': 'Something went wrong',
  'error.generic.body': 'This is not a verdict on the credential. Please try again.',

  // --- issuer console ---------------------------------------------------
  'console.title': 'Issuer console',
  'console.nav.imports': 'Imports',
  'console.nav.batches': 'Batches',
  'console.nav.credentials': 'Credentials',
  'console.nav.analytics': 'Dashboard',
  'console.signIn.title': 'Sign in',
  'console.signIn.body': 'Use the account your institution issued you.',
  'console.email': 'Email',
  'console.password': 'Password',
  'console.signIn.failed': 'That email and password do not match an account.',

  'imports.title': 'Imports',
  'imports.description':
    'Upload a record export, review what normalised cleanly, then have a colleague approve it.',
  'imports.new': 'New import',
  'imports.empty': 'No imports yet',
  'imports.empty.body':
    'Start by exporting graduate records from your student information system as CSV.',
  'imports.file': 'Record export (CSV)',
  'imports.file.hint':
    'The first row must be a header row. Column names match the credential type.',
  'imports.type': 'Credential type',
  'imports.assurance': 'How was this checked?',
  'imports.assurance.hint':
    'This appears on every credential in the batch and is shown to every verifier. Describe what actually happened.',
  'imports.sourceSystem': 'System of record',
  'imports.checkedBy': 'Checked by (role)',
  'imports.checkedAt': 'Date checked',
  'imports.synthetic': 'This file contains no real graduate data',
  'imports.synthetic.hint':
    'Required until a signed data-processing agreement, in-country hosting and a completed DPIA are in place.',
  'imports.rows': 'Rows',
  'imports.ready': 'Ready',
  'imports.conflicts': 'Need attention',
  'imports.review': 'Review',
  'imports.uploaded': 'Uploaded',

  'review.title': 'Review',
  'review.description':
    'Nothing is signed until you approve. Rows that need attention are skipped, not guessed at.',
  'review.approve': 'Approve and sign',
  'review.approve.confirm':
    'This signs {count} credentials with your institution key and records the batch on the ledger. It cannot be undone; a mistake has to be revoked.',
  'review.fourEyes':
    'You cannot approve a batch you uploaded yourself. Ask a colleague to approve it.',
  'review.allReady': 'All rows are ready',
  'review.issue': 'Issue',
  'review.row': 'Row',

  'credentials.title': 'Credentials',
  'credentials.empty': 'No credentials yet',
  'credentials.empty.body': 'Approve an import to issue your first batch.',
  'credentials.holder': 'Holder',
  'credentials.type': 'Type',
  'credentials.status': 'Status',
  'credentials.revoke.title': 'Revoke this credential',
  'credentials.revoke.body':
    'The holder will no longer be able to prove this award, and any verifier who checks it will be told it was withdrawn. Revocation cannot be undone.',
  'credentials.revoke.reason': 'Reason',
  'credentials.revoked.toast': 'Revoked. The revocation list is live now.',

  'reason.ISSUED_IN_ERROR': 'Issued in error',
  'reason.SUPERSEDED': 'Replaced by a corrected credential',
  'reason.RECORD_CORRECTED': 'The underlying record was corrected',
  'reason.FRAUD_CONFIRMED': 'Fraud confirmed',
  'reason.AWARD_RESCINDED': 'The award was rescinded',
  'reason.HOLDER_REQUEST': 'At the holder\u2019s request',
  'reason.ADMINISTRATIVE': 'Administrative',

  'batches.title': 'Batches',
  'batches.empty': 'No batches yet',
  'batches.leafCount': 'Credentials',
  'batches.anchored': 'Recorded on ledger',
  'batches.pending': 'Not yet recorded on the ledger. This does not affect verification.',

  'analytics.title': 'Dashboard',
  'analytics.issued': 'Credentials issued',
  'analytics.revoked': 'Revoked',
  'analytics.verifications': 'Verifications answered',
  'analytics.last30': 'Last 30 days',
  'analytics.reuse': 'Verifications per credential',
  'analytics.reuse.hint':
    'How often each credential is checked per year. Below one, this is a service. Above five, it is infrastructure.',
  'analytics.hours': 'Staff hours avoided',
  'analytics.estimate': 'Estimate',
  'analytics.share': 'Your revenue share',

  // --- wallet ------------------------------------------------------------
  'wallet.title': 'My credentials',
  'wallet.nav.credentials': 'Credentials',
  'wallet.nav.shares': 'Shared links',
  'wallet.nav.receipts': 'Who checked my credentials',
  'wallet.signIn.title': 'Sign in to your wallet',
  'wallet.signIn.body': 'Use the email your institution has on record for you.',
  'wallet.empty': 'No credentials yet',
  'wallet.empty.body': 'When your institution issues a credential to you, it will appear here.',
  'wallet.share.title': 'Share this credential',
  'wallet.share.body':
    'Choose exactly what to reveal. Everything you leave unticked stays private, and the person checking is told only that you withheld it.',
  'wallet.share.scope': 'What to share',
  'wallet.share.purpose': 'What is it for?',
  'wallet.share.ttl': 'How long should the link work?',
  'wallet.share.uses': 'How many times can it be used?',
  'wallet.share.create': 'Create link',
  'wallet.share.created': 'Link created',
  'wallet.share.copyBody':
    'Copy this now. For your safety it is not stored and cannot be shown again.',
  'wallet.share.selectAtLeastOne': 'Choose at least one detail to share.',
  'wallet.share.sensitive': 'Sensitive',
  'wallet.ttl.15m': '15 minutes',
  'wallet.ttl.1h': '1 hour',
  'wallet.ttl.24h': '24 hours',
  'wallet.ttl.7d': '7 days',
  'wallet.shares.empty': 'No active links',
  'wallet.shares.empty.body': 'Links you create will appear here so you can withdraw them.',
  'wallet.shares.withdraw': 'Withdraw',
  'wallet.shares.uses': 'Used {used} of {max}',
  'wallet.shares.withdrawn': 'Withdrawn',
  'wallet.receipts.empty': 'Nobody has checked your credentials yet',
  'wallet.receipts.empty.body':
    'Every time someone verifies a credential of yours, it is recorded here with what they saw.',
  'wallet.receipts.saw': 'They saw',
  'wallet.receipts.anchored': 'Recorded in the daily audit log',
  'wallet.receipts.pending': 'Will be added to tonight\u2019s audit log',
};

const bn: Dictionary = {
  'brand.name': 'সিভিলেজার',
  'lang.toggle': 'English',
  'lang.label': 'ভাষা',
  'skip.main': 'মূল অংশে যান',

  'action.verify': 'যাচাই করুন',
  'action.verifyAnother': 'আরেকটি যাচাই করুন',
  'action.retry': 'আবার চেষ্টা করুন',
  'action.cancel': 'বাতিল',
  'action.close': 'বন্ধ',
  'action.copy': 'কপি',
  'action.copied': 'কপি হয়েছে',
  'action.signIn': 'সাইন ইন',
  'action.signOut': 'সাইন আউট',
  'action.share': 'শেয়ার',
  'action.revoke': 'বাতিল করুন',
  'action.approve': 'অনুমোদন ও স্বাক্ষর',
  'action.upload': 'আপলোড',
  'action.download': 'রিপোর্ট ডাউনলোড',
  'action.back': 'ফিরে যান',
  'action.viewDetails': 'বিস্তারিত দেখুন',

  'common.loading': 'লোড হচ্ছে',
  'common.of': 'এর',
  'common.showing': 'দেখানো হচ্ছে',
  'common.none': 'কিছু নেই',
  'common.never': 'কখনো নয়',
  'common.optional': 'ঐচ্ছিক',
  'common.required': 'আবশ্যক',
  'common.issuer': 'প্রদানকারী প্রতিষ্ঠান',
  'common.issued': 'প্রদানের তারিখ',
  'common.expires': 'মেয়াদ শেষ',
  'common.noExpiry': 'মেয়াদ শেষ হয় না',
  'common.checkedAt': 'যাচাইয়ের সময়',

  'result.valid': 'এই সনদটি আসল',
  'result.valid.body': 'প্রদানকারী প্রতিষ্ঠান এটি স্বাক্ষর করেছে এবং এটি প্রত্যাহার করা হয়নি।',
  'result.revoked': 'এই সনদটি প্রত্যাহার করা হয়েছে',
  'result.revoked.body':
    'প্রদানকারী প্রতিষ্ঠান এটি বাতিল করেছে। এটি ডিগ্রির প্রমাণ হিসেবে গ্রহণ করবেন না।',
  'result.suspended': 'এই সনদটি স্থগিত আছে',
  'result.suspended.body':
    'প্রদানকারী প্রতিষ্ঠান এটি সাময়িকভাবে স্থগিত করেছে। ধারকের কাছে হালনাগাদ প্রমাণ চান।',
  'result.expired': 'এই সনদের মেয়াদ শেষ হয়েছে',
  'result.expired.body': 'প্রদানের সময় এটি আসল ছিল, তবে বৈধতার মেয়াদ শেষ হয়ে গেছে।',
  'result.invalid': 'এই সনদটি যাচাই করা যায়নি',
  'result.invalid.body': 'অন্তত একটি পরীক্ষা ব্যর্থ হয়েছে। এটিকে অযাচাইকৃত হিসেবে গণ্য করুন।',
  'result.unknown_issuer': 'এই প্রতিষ্ঠানটি আমাদের নিবন্ধনে নেই',
  'result.unknown_issuer.body':
    'যে প্রতিষ্ঠান এটি স্বাক্ষর করেছে তারা সিভিলেজার নিবন্ধনে নেই। এর মানে এই নয় যে সনদটি ভুয়া, শুধু এই যে আমরা এর দায়িত্ব নিতে পারছি না।',
  'result.undetermined': 'আমরা যাচাই সম্পূর্ণ করতে পারিনি',
  'result.undetermined.body':
    'প্রয়োজনীয় কিছু তথ্যে পৌঁছানো যায়নি। এটি কোনো ছাড়পত্র নয়। কিছুক্ষণ পর আবার চেষ্টা করুন।',

  'basis.live': 'লেজারের সাথে সরাসরি যাচাই করা হয়েছে',
  'basis.cached': 'নিবন্ধনের সংরক্ষিত অনুলিপি দিয়ে যাচাই করা হয়েছে',
  'basis.cached.at': '{at} সময়ের নিবন্ধন অনুলিপি',

  'check.issuer_known': 'প্রতিষ্ঠানটি নিবন্ধনে আছে',
  'check.issuer_key_valid_at_signing': 'স্বাক্ষরের সময় কী বৈধ ছিল',
  'check.signature': 'স্বাক্ষর প্রকাশিত তথ্য জুড়ে বৈধ',
  'check.status': 'প্রত্যাহার করা হয়নি',
  'check.status_list_anchored': 'প্রত্যাহার তালিকা লেজারের সাথে মেলে',
  'check.anchor_inclusion': 'প্রকাশিত ব্যাচে নথিভুক্ত',
  'check.holder_binding': 'ধারক নিজে উপস্থাপন করেছেন',

  'code.ISSUER_ACTIVE': 'নিবন্ধিত ও সক্রিয়',
  'code.ISSUER_SUSPENDED': 'এই প্রতিষ্ঠানটি বর্তমানে স্থগিত',
  'code.ISSUER_RETIRED': 'এই প্রতিষ্ঠান আর সনদ প্রদান করে না',
  'code.ISSUER_PENDING': 'এই প্রতিষ্ঠান এখনো অনুমোদিত হয়নি',
  'code.ISSUER_NOT_IN_REGISTRY': 'নিবন্ধনে পাওয়া যায়নি',
  'code.REGISTRY_UNREACHABLE': 'নিবন্ধনে পৌঁছানো যায়নি',
  'code.KEY_VALID_AT_SIGNING': 'স্বাক্ষরের সময় বৈধ ছিল',
  'code.KEY_NOT_VALID_AT_SIGNING': 'স্বাক্ষরের সময় কী-টি বৈধ ছিল না',
  'code.SIGNATURE_OK': 'স্বাক্ষর যাচাই হয়েছে',
  'code.BAD_SIGNATURE': 'স্বাক্ষর মেলেনি',
  'code.UNMATCHED_DISCLOSURE': 'প্রতিষ্ঠান স্বাক্ষর করার পরে একটি তথ্য যোগ করা হয়েছে',
  'code.DUPLICATE_CLAIM': 'একই তথ্য দুইবার পাঠানো হয়েছে',
  'code.EXPIRED': 'বৈধতার মেয়াদ পার হয়েছে',
  'code.STATUS_CLEAR': 'প্রত্যাহার করা হয়নি',
  'code.CREDENTIAL_REVOKED': 'প্রদানকারী প্রতিষ্ঠান প্রত্যাহার করেছে',
  'code.CREDENTIAL_SUSPENDED': 'প্রদানকারী প্রতিষ্ঠান স্থগিত করেছে',
  'code.NO_STATUS_LIST': 'এই ধরনের সনদ প্রত্যাহারযোগ্য নয়',
  'code.STATUS_LIST_UNREACHABLE': 'প্রত্যাহার তালিকায় পৌঁছানো যায়নি',
  'code.LIST_MATCHES_CHAIN': 'লেজারের নথির সাথে মেলে',
  'code.LIST_MATCHES_CHAIN_BUT_STALE': 'লেজারের সাথে মেলে, তবে তালিকাটি হালনাগাদ হওয়া প্রয়োজন',
  'code.LIST_ANCHOR_PENDING': 'সাম্প্রতিক একটি পরিবর্তন এখনো লেজারে নিশ্চিত হয়নি',
  'code.LIST_NOT_ANCHORED': 'লেজারের সাথে নিশ্চিত করা যায়নি',
  'code.CHAIN_UNREACHABLE': 'লেজারে পৌঁছানো যায়নি',
  'code.VERSION_ROLLBACK': 'একটি পুরোনো প্রত্যাহার তালিকা সরবরাহ করা হয়েছে',
  'code.CHAIN_HASH_MISMATCH': 'প্রত্যাহার তালিকা লেজারের নথির সাথে মেলে না',
  'code.CHAIN_VERSION_MISMATCH': 'প্রত্যাহার তালিকাটি লেজারের নথির চেয়ে পুরোনো',
  'code.URI_MISMATCH': 'প্রত্যাহার তালিকা অপ্রত্যাশিত ঠিকানা থেকে এসেছে',
  'code.ANCHOR_INCLUDED': 'প্রকাশিত ব্যাচে পাওয়া গেছে',
  'code.ANCHOR_NOT_INCLUDED': 'দাবিকৃত ব্যাচে পাওয়া যায়নি',
  'code.ANCHOR_NOT_PRESENTED': 'কোনো ব্যাচ প্রমাণ দেওয়া হয়নি',
  'code.ANCHOR_UNREACHABLE': 'ব্যাচের নথিতে পৌঁছানো যায়নি',
  'code.HOLDER_BINDING_VERIFIED': 'ধারক প্রমাণ করেছেন সনদটি তাঁর',
  'code.HOLDER_BINDING_ABSENT': 'মালিকানার প্রমাণ দেওয়া হয়নি',
  'code.KEY_BINDING_REQUIRED': 'মালিকানার প্রমাণ প্রয়োজন ছিল কিন্তু দেওয়া হয়নি',
  'code.MALFORMED_SD_JWT': 'এটি কোনো সিভিলেজার সনদ নয়',
  'code.MALFORMED_CREDENTIAL': 'এটি কোনো সিভিলেজার সনদ নয়',
  'code.SHARE_LINK_EXPIRED': 'এই লিংকের মেয়াদ শেষ',
  'code.SHARE_LINK_USED_UP': 'ইতিমধ্যে ব্যবহৃত',
  'code.SHARE_LINK_REVOKED': 'ধারক প্রত্যাহার করেছেন',

  'assurance.label': 'যেভাবে যাচাই করা হয়েছে',
  'assurance.AL0': 'স্ব-ঘোষিত, যাচাই করা হয়নি',
  'assurance.AL1': 'নথির স্ক্যান প্রতিষ্ঠানের নথির সাথে মেলানো হয়েছে',
  'assurance.AL2': 'প্রতিষ্ঠানের কর্মী নিজেদের নথির সাথে মিলিয়ে নিশ্চিত করেছেন',
  'assurance.AL3': 'সমাবর্তনের সময় প্রতিষ্ঠানের সিস্টেম থেকে সরাসরি প্রদান করা',
  'assurance.AL3+': 'সমাবর্তনের সময় প্রদান, পরিচয় যাচাইসহ',
  'assurance.AL3_PLUS': 'সমাবর্তনের সময় প্রদান, পরিচয় যাচাইসহ',
  'assurance.explain':
    'প্রতিটি সনদ একইভাবে যাচাই হয় না। প্রতিষ্ঠান ঠিক কী করেছে তা এখানে বলা আছে।',

  'evidence.method.SELF_ASSERTED': 'স্ব-ঘোষিত',
  'evidence.method.DOCUMENT_SCAN_OCR': 'নথির স্ক্যান, নাম মিলিয়ে',
  'evidence.method.REGISTRAR_SOURCE_CHECK': 'রেজিস্ট্রার প্রতিষ্ঠানের নথি মিলিয়ে দেখেছেন',
  'evidence.method.SYSTEM_OF_RECORD_SYNC': 'প্রতিষ্ঠানের সিস্টেম থেকে সরাসরি পড়া',
  'evidence.method.SYSTEM_OF_RECORD_SYNC_WITH_ID_CHECK':
    'প্রতিষ্ঠানের সিস্টেম থেকে পড়া, পরিচয় যাচাইসহ',

  'accreditation.UGC_RECOGNIZED': 'ইউজিসি স্বীকৃত',
  'accreditation.BOARD': 'শিক্ষা বোর্ড',
  'accreditation.PROFESSIONAL_BODY': 'পেশাজীবী সংস্থা',
  'accreditation.SELF_ASSERTED': 'স্বীকৃতিহীন',

  'state.ISSUED': 'সক্রিয়',
  'state.DRAFT': 'খসড়া',
  'state.REVOKED': 'প্রত্যাহৃত',
  'state.SUSPENDED': 'স্থগিত',
  'state.SUPERSEDED': 'প্রতিস্থাপিত',

  'batch.DRAFT': 'খসড়া',
  'batch.PENDING_APPROVAL': 'অনুমোদনের অপেক্ষায়',
  'batch.APPROVED': 'অনুমোদিত',
  'batch.SIGNING': 'স্বাক্ষর হচ্ছে',
  'batch.ANCHORING': 'লেজারে নথিভুক্ত হচ্ছে',
  'batch.PUBLISHED': 'প্রকাশিত',
  'batch.FAILED': 'ব্যর্থ',

  'import.UPLOADED': 'আপলোড হয়েছে',
  'import.REVIEW': 'পর্যালোচনার অপেক্ষায়',
  'import.APPROVED': 'অনুমোদিত',
  'import.REJECTED': 'প্রত্যাখ্যাত',

  'row.READY': 'প্রস্তুত',
  'row.CONFLICT': 'সংশোধন প্রয়োজন',
  'row.ISSUED': 'প্রদান করা হয়েছে',
  'row.REJECTED': 'প্রত্যাখ্যাত',
  'row.PENDING': 'অপেক্ষমাণ',

  'claim.given_name': 'নাম',
  'claim.family_name': 'পদবি',
  'claim.name_bn': 'বাংলায় নাম',
  'claim.date_of_birth': 'জন্মতারিখ',
  'claim.national_id_last4': 'জাতীয় পরিচয়পত্র (শেষ ৪ সংখ্যা)',
  'claim.programme': 'প্রোগ্রাম',
  'claim.degree_level': 'ডিগ্রির স্তর',
  'claim.major': 'মেজর',
  'claim.result_cgpa': 'সিজিপিএ',
  'claim.result_class': 'শ্রেণি',
  'claim.graduation_date': 'সমাবর্তনের তারিখ',
  'claim.registration_no': 'রেজিস্ট্রেশন নম্বর',
  'claim.transcript_digest': 'ট্রান্সক্রিপ্ট ফিঙ্গারপ্রিন্ট',
  'claim.photo_digest': 'ছবির ফিঙ্গারপ্রিন্ট',
  'claim.licence_number': 'লাইসেন্স নম্বর',
  'claim.profession': 'পেশা',
  'claim.standing': 'অবস্থা',
  'claim.enrolment_status': 'ভর্তির অবস্থা',
  'claim.courses_json': 'কোর্সের ফলাফল',
  'claim.credits_earned': 'অর্জিত ক্রেডিট',
  'claim.current_term': 'বর্তমান টার্ম',
  'claim.expected_completion': 'সম্ভাব্য সমাপ্তি',
  'claim.scope': 'কাজের পরিধি',
  'claim.first_licensed': 'প্রথম লাইসেন্সের তারিখ',

  'claims.disclosed': 'আপনার সাথে শেয়ার করা তথ্য',
  'claims.withheld': 'ধারক যা শেয়ার করেননি',
  'claims.withheld.explain':
    'ধারক এগুলো শেয়ার না করার সিদ্ধান্ত নিয়েছেন। এটি স্বাভাবিক এবং সনদটি আসল কি না তাতে কোনো প্রভাব ফেলে না।',

  'evidence.orgId': 'প্রতিষ্ঠান আইডি',
  'evidence.didWeb': 'প্রতিষ্ঠানের শনাক্তকারী',
  'evidence.keyThumbprint': 'স্বাক্ষর কী',
  'evidence.signedAt': 'স্বাক্ষরের সময়',
  'evidence.listVersion': 'প্রত্যাহার তালিকার সংস্করণ',
  'evidence.listHash': 'প্রত্যাহার তালিকার ফিঙ্গারপ্রিন্ট',
  'evidence.batchId': 'ব্যাচ',

  'start.title': 'একটি সনদ যাচাই করুন',
  'start.body':
    'নথিতে থাকা কিউআর কোড স্ক্যান করুন, অথবা আপনাকে দেওয়া যাচাই লিংকটি পেস্ট করুন। কোনো অ্যাকাউন্ট লাগবে না।',
  'start.label': 'যাচাই লিংক বা কোড',
  'start.hint': 'এটি একটি ওয়েব ঠিকানার মতো, অথবা অক্ষর ও সংখ্যার একটি দীর্ঘ সারি।',
  'start.badToken': 'এটি সিভিলেজারের যাচাই লিংক বলে মনে হচ্ছে না।',
  'start.openTitle': 'আমাদের কথায় বিশ্বাস করতে হবে না',
  'start.openBody':
    'যাচাইয়ের পদ্ধতি প্রকাশ করা আছে, এবং যে লাইব্রেরি এটি করে তা ওপেন সোর্স। আমাদের সার্ভার ব্যবহার না করেও যে কেউ এই ফল যাচাই করতে পারেন।',
  'start.openLink': 'স্পেসিফিকেশন পড়ুন',
  'result.recheck': 'আবার যাচাই করুন',
  'footer.note': 'সিভিলেজারের মাধ্যমে সনদ দিতে পারে এমন প্রতিটি প্রতিষ্ঠানের তালিকা প্রকাশ্য।',
  'footer.registry': 'প্রতিষ্ঠানের নিবন্ধন দেখুন',

  'error.notFound': 'সনদটি খুঁজে পাওয়া যায়নি',
  'error.notFound.body':
    'লিংকটি ভুল হতে পারে, অথবা ধারক এটি প্রত্যাহার করে থাকতে পারেন। তাঁর কাছে নতুন একটি চান।',
  'error.expired.body': 'যাচাই লিংক ইচ্ছাকৃতভাবে স্বল্পমেয়াদি। ধারকের কাছে নতুন একটি লিংক চান।',
  'error.offline': 'সেবায় পৌঁছানো যায়নি',
  'error.offline.body': 'আপনার সংযোগ দেখে আবার চেষ্টা করুন।',
  'error.generic': 'কিছু একটা ভুল হয়েছে',
  'error.generic.body': 'এটি সনদের বিষয়ে কোনো রায় নয়। অনুগ্রহ করে আবার চেষ্টা করুন।',

  'console.title': 'প্রদানকারীর কনসোল',
  'console.nav.imports': 'ইমপোর্ট',
  'console.nav.batches': 'ব্যাচ',
  'console.nav.credentials': 'সনদ',
  'console.nav.analytics': 'ড্যাশবোর্ড',
  'console.signIn.title': 'সাইন ইন',
  'console.signIn.body': 'আপনার প্রতিষ্ঠানের দেওয়া অ্যাকাউন্ট ব্যবহার করুন।',
  'console.email': 'ইমেইল',
  'console.password': 'পাসওয়ার্ড',
  'console.signIn.failed': 'এই ইমেইল ও পাসওয়ার্ড কোনো অ্যাকাউন্টের সাথে মেলে না।',

  'imports.title': 'ইমপোর্ট',
  'imports.description':
    'রেকর্ড এক্সপোর্ট আপলোড করুন, কোনগুলো ঠিকভাবে এসেছে দেখুন, তারপর একজন সহকর্মীকে অনুমোদন করতে বলুন।',
  'imports.new': 'নতুন ইমপোর্ট',
  'imports.empty': 'এখনো কোনো ইমপোর্ট নেই',
  'imports.empty.body':
    'আপনার স্টুডেন্ট ইনফরমেশন সিস্টেম থেকে স্নাতকদের রেকর্ড সিএসভি আকারে এক্সপোর্ট করে শুরু করুন।',
  'imports.file': 'রেকর্ড এক্সপোর্ট (CSV)',
  'imports.file.hint': 'প্রথম সারিটি হেডার হতে হবে। কলামের নাম সনদের ধরনের সাথে মিলতে হবে।',
  'imports.type': 'সনদের ধরন',
  'imports.assurance': 'এটি কীভাবে যাচাই করা হয়েছে?',
  'imports.assurance.hint':
    'এই ব্যাচের প্রতিটি সনদে এটি থাকবে এবং প্রতিটি যাচাইকারী এটি দেখতে পাবেন। বাস্তবে যা হয়েছে তাই লিখুন।',
  'imports.sourceSystem': 'রেকর্ডের উৎস সিস্টেম',
  'imports.checkedBy': 'যাচাইকারীর পদ',
  'imports.checkedAt': 'যাচাইয়ের তারিখ',
  'imports.synthetic': 'এই ফাইলে কোনো প্রকৃত শিক্ষার্থীর তথ্য নেই',
  'imports.synthetic.hint':
    'স্বাক্ষরিত ডেটা প্রসেসিং চুক্তি, দেশের ভেতরে হোস্টিং এবং সম্পন্ন ডিপিআইএ না হওয়া পর্যন্ত এটি আবশ্যক।',
  'imports.rows': 'সারি',
  'imports.ready': 'প্রস্তুত',
  'imports.conflicts': 'সংশোধন প্রয়োজন',
  'imports.review': 'পর্যালোচনা',
  'imports.uploaded': 'আপলোডের সময়',

  'review.title': 'পর্যালোচনা',
  'review.description':
    'আপনি অনুমোদন না করা পর্যন্ত কিছুই স্বাক্ষর হয় না। সমস্যাযুক্ত সারি বাদ দেওয়া হয়, অনুমান করা হয় না।',
  'review.approve': 'অনুমোদন ও স্বাক্ষর',
  'review.approve.confirm':
    'এটি আপনার প্রতিষ্ঠানের কী দিয়ে {count}টি সনদ স্বাক্ষর করবে এবং ব্যাচটি লেজারে নথিভুক্ত করবে। এটি ফেরানো যায় না; ভুল হলে প্রত্যাহার করতে হবে।',
  'review.fourEyes':
    'নিজের আপলোড করা ব্যাচ আপনি অনুমোদন করতে পারবেন না। একজন সহকর্মীকে অনুমোদন করতে বলুন।',
  'review.allReady': 'সব সারি প্রস্তুত',
  'review.issue': 'সমস্যা',
  'review.row': 'সারি',

  'credentials.title': 'সনদ',
  'credentials.empty': 'এখনো কোনো সনদ নেই',
  'credentials.empty.body': 'প্রথম ব্যাচ প্রদানের জন্য একটি ইমপোর্ট অনুমোদন করুন।',
  'credentials.holder': 'ধারক',
  'credentials.type': 'ধরন',
  'credentials.status': 'অবস্থা',
  'credentials.revoke.title': 'এই সনদটি প্রত্যাহার করুন',
  'credentials.revoke.body':
    'ধারক আর এই ডিগ্রি প্রমাণ করতে পারবেন না, এবং যে কেউ যাচাই করলে জানতে পারবেন এটি প্রত্যাহার করা হয়েছে। প্রত্যাহার ফেরানো যায় না।',
  'credentials.revoke.reason': 'কারণ',
  'credentials.revoked.toast': 'প্রত্যাহার করা হয়েছে। প্রত্যাহার তালিকা এখনই কার্যকর।',

  'reason.ISSUED_IN_ERROR': 'ভুলবশত প্রদান করা হয়েছিল',
  'reason.SUPERSEDED': 'সংশোধিত সনদ দিয়ে প্রতিস্থাপিত',
  'reason.RECORD_CORRECTED': 'মূল রেকর্ড সংশোধন করা হয়েছে',
  'reason.FRAUD_CONFIRMED': 'জালিয়াতি নিশ্চিত',
  'reason.AWARD_RESCINDED': 'ডিগ্রি বাতিল করা হয়েছে',
  'reason.HOLDER_REQUEST': 'ধারকের অনুরোধে',
  'reason.ADMINISTRATIVE': 'প্রশাসনিক',

  'batches.title': 'ব্যাচ',
  'batches.empty': 'এখনো কোনো ব্যাচ নেই',
  'batches.leafCount': 'সনদ সংখ্যা',
  'batches.anchored': 'লেজারে নথিভুক্ত',
  'batches.pending': 'এখনো লেজারে নথিভুক্ত হয়নি। এতে যাচাইয়ে কোনো প্রভাব পড়ে না।',

  'analytics.title': 'ড্যাশবোর্ড',
  'analytics.issued': 'প্রদত্ত সনদ',
  'analytics.revoked': 'প্রত্যাহৃত',
  'analytics.verifications': 'যাচাইয়ের উত্তর দেওয়া হয়েছে',
  'analytics.last30': 'গত ৩০ দিন',
  'analytics.reuse': 'প্রতি সনদে যাচাই',
  'analytics.reuse.hint':
    'প্রতিটি সনদ বছরে কতবার যাচাই হয়। একের নিচে হলে এটি একটি সেবা। পাঁচের উপরে হলে এটি অবকাঠামো।',
  'analytics.hours': 'কর্মঘণ্টা সাশ্রয়',
  'analytics.estimate': 'আনুমানিক',
  'analytics.share': 'আপনার রাজস্ব অংশ',

  'wallet.title': 'আমার সনদ',
  'wallet.nav.credentials': 'সনদ',
  'wallet.nav.shares': 'শেয়ার করা লিংক',
  'wallet.nav.receipts': 'কারা আমার সনদ দেখেছেন',
  'wallet.signIn.title': 'আপনার ওয়ালেটে সাইন ইন করুন',
  'wallet.signIn.body': 'আপনার প্রতিষ্ঠানের নথিতে থাকা ইমেইলটি ব্যবহার করুন।',
  'wallet.empty': 'এখনো কোনো সনদ নেই',
  'wallet.empty.body': 'আপনার প্রতিষ্ঠান সনদ দিলে তা এখানে দেখা যাবে।',
  'wallet.share.title': 'এই সনদটি শেয়ার করুন',
  'wallet.share.body':
    'ঠিক কী প্রকাশ করবেন তা বেছে নিন। যেগুলো টিক দেবেন না সেগুলো গোপন থাকবে, এবং যাচাইকারী শুধু জানবেন আপনি সেগুলো দেননি।',
  'wallet.share.scope': 'কী শেয়ার করবেন',
  'wallet.share.purpose': 'কী কাজে লাগবে?',
  'wallet.share.ttl': 'লিংকটি কতক্ষণ কাজ করবে?',
  'wallet.share.uses': 'কতবার ব্যবহার করা যাবে?',
  'wallet.share.create': 'লিংক তৈরি করুন',
  'wallet.share.created': 'লিংক তৈরি হয়েছে',
  'wallet.share.copyBody':
    'এখনই কপি করে নিন। আপনার নিরাপত্তার জন্য এটি সংরক্ষণ করা হয় না এবং আর দেখানো যাবে না।',
  'wallet.share.selectAtLeastOne': 'অন্তত একটি তথ্য শেয়ারের জন্য বেছে নিন।',
  'wallet.share.sensitive': 'সংবেদনশীল',
  'wallet.ttl.15m': '১৫ মিনিট',
  'wallet.ttl.1h': '১ ঘণ্টা',
  'wallet.ttl.24h': '২৪ ঘণ্টা',
  'wallet.ttl.7d': '৭ দিন',
  'wallet.shares.empty': 'কোনো সক্রিয় লিংক নেই',
  'wallet.shares.empty.body':
    'আপনার তৈরি লিংকগুলো এখানে দেখা যাবে, যাতে প্রয়োজনে প্রত্যাহার করতে পারেন।',
  'wallet.shares.withdraw': 'প্রত্যাহার',
  'wallet.shares.uses': '{max} বারের মধ্যে {used} বার ব্যবহৃত',
  'wallet.shares.withdrawn': 'প্রত্যাহৃত',
  'wallet.receipts.empty': 'এখনো কেউ আপনার সনদ যাচাই করেননি',
  'wallet.receipts.empty.body':
    'কেউ আপনার সনদ যাচাই করলে, তিনি কী দেখেছেন তাসহ এখানে নথিভুক্ত হবে।',
  'wallet.receipts.saw': 'তাঁরা দেখেছেন',
  'wallet.receipts.anchored': 'দৈনিক নিরীক্ষা লগে নথিভুক্ত',
  'wallet.receipts.pending': 'আজ রাতের নিরীক্ষা লগে যুক্ত হবে',
};

const DICTIONARIES: Record<Locale, Dictionary> = { en, bn };

export type Translate = (key: string, vars?: Record<string, string | number>) => string;

interface I18nValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translate;
  formatDate: (value: string | Date | null | undefined, withTime?: boolean) => string;
  formatNumber: (value: number) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

const STORAGE_KEY = 'civiledger.locale';

function initialLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'bn') return stored;
  } catch {
    // Private browsing, or storage blocked. The default is fine.
  }
  return navigator.language?.startsWith('bn') ? 'bn' : 'en';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  useEffect(() => {
    document.documentElement.lang = locale;
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      // Not fatal: the choice simply does not persist.
    }
  }, [locale]);

  const value = useMemo<I18nValue>(() => {
    const dictionary = DICTIONARIES[locale];
    const t: Translate = (key, vars) => {
      // Fall back to English rather than showing a raw key: a missing Bangla
      // string is a translation gap, not something a user should ever see.
      const template = dictionary[key] ?? en[key] ?? key;
      if (!vars) return template;
      return template.replace(/\{(\w+)\}/g, (match, name: string) =>
        name in vars ? String(vars[name]) : match,
      );
    };

    const localeTag = locale === 'bn' ? 'bn-BD' : 'en-GB';

    return {
      locale,
      setLocale: setLocaleState,
      t,
      formatDate(value, withTime = false) {
        if (!value) return t('common.never');
        const date = typeof value === 'string' ? new Date(value) : value;
        if (Number.isNaN(date.getTime())) return String(value);
        return new Intl.DateTimeFormat(localeTag, {
          dateStyle: 'medium',
          ...(withTime ? { timeStyle: 'short' } : {}),
        }).format(date);
      },
      formatNumber: (value) => new Intl.NumberFormat(localeTag).format(value),
    };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside an I18nProvider');
  return value;
}

export function LanguageToggle() {
  const { locale, setLocale, t } = useI18n();
  return (
    <button
      type="button"
      className="cl-btn cl-btn--ghost cl-btn--sm"
      onClick={() => setLocale(locale === 'en' ? 'bn' : 'en')}
      aria-label={t('lang.label')}
      lang={locale === 'en' ? 'bn' : 'en'}
    >
      {t('lang.toggle')}
    </button>
  );
}
