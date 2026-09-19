export const config = {
  apiBaseUrl: import.meta.env['VITE_API_BASE_URL'] ?? 'http://localhost:4000',
  verifyOrigin: import.meta.env['VITE_VERIFY_ORIGIN'] ?? 'http://localhost:5174',
};
