/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_CHAIN_ID?: string;
  readonly VITE_CHAIN_NAME?: string;
  readonly VITE_EXPLORER_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
