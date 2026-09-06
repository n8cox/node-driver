/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ADAPTER?: 'sample' | 'http';
  readonly VITE_HTTP_BASE_URL?: string;
  readonly VITE_HTTP_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
