/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CHATKIT_WORKFLOW_ID: string;
  readonly VITE_USER_NAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
