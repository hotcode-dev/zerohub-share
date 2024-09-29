/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_ZEROHUB_HOST: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
