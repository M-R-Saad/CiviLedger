/**
 * @civiledger/ui — one design system, three surfaces.
 *
 * Consumed as source rather than as a build artefact: every surface is a Vite
 * app, and shipping TSX straight through keeps the token layer and the
 * primitives impossible to fork by accident.
 */

export * from './primitives.js';
export * from './i18n.js';
export * from './VerificationResult.js';
export * from './api.js';
