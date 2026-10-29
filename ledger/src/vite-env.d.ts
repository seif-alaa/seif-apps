/// <reference types="vite/client" />
interface ImportMetaEnv {
  /** URL of your server-side AI proxy. Leave unset to disable AI explanations. */
  readonly VITE_LEDGER_AI_ENDPOINT?: string;
}
