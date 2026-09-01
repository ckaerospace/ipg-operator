/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API: string;
  /** Injected from package.json at build time. */
  readonly VITE_APP_VERSION: string;
  /** Set to `beta` to show a BETA mark next to the version. Live production omits this. */
  readonly VITE_CHANNEL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
