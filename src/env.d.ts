/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_ZEROHUB_HOST: string;
  readonly PUBLIC_TURN_URLS?: string;
  readonly PUBLIC_TURN_USERNAME?: string;
  readonly PUBLIC_TURN_CREDENTIAL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
