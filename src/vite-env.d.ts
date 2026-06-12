/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CHATKIT_WORKFLOW_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
