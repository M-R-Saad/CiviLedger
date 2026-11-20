/** Runtime configuration, supplied at build time by Vite. */
export const config = {
  apiBaseUrl: import.meta.env['VITE_API_BASE_URL'] ?? 'http://localhost:4000',
  explorerBaseUrl: import.meta.env['VITE_EXPLORER_BASE_URL'] as string | undefined,
  specUrl: import.meta.env['VITE_SPEC_URL'] ?? 'https://github.com/civiledger/verification-spec',
};
