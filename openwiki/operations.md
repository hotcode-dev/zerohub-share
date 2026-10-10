---
type: operations
title: Configuration, Build & Operations
description: "Operational reference for ZeroHub Share: the PUBLIC_ZEROHUB_HOST env var, all npm scripts, the Zero Factory precommit gate, the Prettier 3.6.2 pin, Tailwind/DaisyUI theming, and the PWA/TypeScript/Astro configuration."
tags:
  [operations, configuration, build, precommit, astro, prettier, tailwind, pwa]
sources:
  - id: openwiki-source-7ddd532074a33ef91da2f06e
    resource: repo://.github/ISSUE_TEMPLATE/bug_report.yml
  - id: openwiki-source-a3ef188491b69d9ba48062e2
    resource: repo://.github/ISSUE_TEMPLATE/config.yml
  - id: openwiki-source-e6bb7eadbc71eea2d5463daf
    resource: repo://.github/ISSUE_TEMPLATE/feature_request.yml
  - id: openwiki-source-9ab161c6e9774cf771b19ced
    resource: repo://.zerofactory/precommit.sh
  - id: openwiki-source-c50574f22a4c0741148fc769
    resource: repo://astro.config.mjs
  - id: openwiki-source-5b54a58d1b51cd490b0e7162
    resource: repo://package.json
  - id: openwiki-source-e21de4e070e82eb7a1025ce0
    resource: repo://public/manifest.webmanifest
  - id: openwiki-source-765669c312313c1b02f31f14
    resource: repo://src/components/SharePage.svelte
  - id: openwiki-source-578f160ff71c06304de2a610
    resource: repo://src/configs.ts
  - id: openwiki-source-0f39e5b9d6afcdc75bb0bd15
    resource: repo://src/env.d.ts
  - id: openwiki-source-16c1a2de5d03991cf3f4df5e
    resource: repo://svelte.config.js
  - id: openwiki-source-8da81a2fde84a0a26486d778
    resource: repo://tailwind.config.ts
  - id: openwiki-source-98d5ddb014a0fd4d678f6f2a
    resource: repo://tsconfig.json
generated: { by: "hermes", at: "2026-10-10T02:18:08.107Z" }
verified:
  - by: openwiki/0.6.0
    at: 2026-10-10T02:18:08.107Z
---

Operational reference for building, checking, and configuring ZeroHub Share
(Astro 5 + Svelte 5 + Tailwind + TypeScript, ESM).

## Environment

- `PUBLIC_ZEROHUB_HOST` — the ZeroHub signaling host. Read in
  `src/configs.ts` as `import.meta.env.PUBLIC_ZEROHUB_HOST` into
  `zeroHubHosts` (a single-entry array consumed by `ZeroHubClient`) and typed
  in `src/env.d.ts`. Provided by `.env.development` for local development;
  production builds are expected to supply it via the build environment.
- `PUBLIC_` prefix follows Astro's convention: the value is inlined into the
  browser bundle and is not secret.
- `isProduction` (`import.meta.env.PROD`) in `src/configs.ts` toggles
  `tls` and `logLevel` on the ZeroHub client.

## NPM Scripts

All scripts are declared in `package.json` (npm/yarn, ESM project via
`"type": "module"`):

| Script       | Command                                                                                          | Purpose                                                          |
| ------------ | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| `dev`        | `astro dev`                                                                                      | dev server                                                       |
| `start`      | `astro dev`                                                                                      | dev server (alias)                                               |
| `build`      | `astro check && astro build`                                                                     | type check + static build                                        |
| `preview`    | `astro preview`                                                                                  | preview the production build                                     |
| `test`       | `vitest`                                                                                         | run the test suite                                               |
| `test:watch` | `vitest --watch`                                                                                 | run tests in watch mode                                          |
| `pretty`     | `prettier --write "./src/**/*.{ts,json,astro,html,svelte}"`                                      | format src/                                                      |
| `protogen`   | `protoc --plugin=node_modules/ts-proto/protoc-gen-ts_proto --ts_proto_out=. ./src/proto/*.proto` | regenerate `src/proto/message.ts` from `src/proto/message.proto` |
| `astro`      | `astro`                                                                                          | raw astro CLI passthrough                                        |

The test suite is `src/utils/crypto.test.ts` (Vitest). Regenerating the
protobuf bindings after editing `src/proto/message.proto` is done with
`npm run protogen`; the generated `src/proto/message.ts` is committed.

## Precommit Gate

`.zerofactory/precommit.sh` is the Zero Factory precommit gate. Subcommands:
`format`, `build`, `test`, `install-hook`, `all` (default runs format + build

- test).

* **format**: `prettier --write --ignore-unknown .` then
  `prettier --check --ignore-unknown .` (astro + svelte + tailwindcss plugins
  loaded via `.prettierrc`).
* **build**: `npm run build` (`astro check && astro build`).
* **test**: `npx vitest run`.
* **install-hook**: symlinks `.zerofactory/precommit.sh` to the git
  `pre-commit` hook. In a linked worktree the hook is installed against the
  main checkout's `.git` directory (a worktree's `.git` is a file), resolved
  via `git rev-parse --git-path hooks`.

The script auto-installs dependencies (`npm ci`) if `node_modules/.bin`
lacks `prettier` or `vitest`.

### Prettier pin

Prettier is pinned to **3.6.2** with **prettier-plugin-svelte 3.2.7** in
`package.json`. Prettier 3.7.x crashes on Svelte files with
`getVisitorKeys is not a function` when paired with
prettier-plugin-svelte 3.x, so do not "upgrade" these pins without resolving
that plugin incompatibility.

## Theming

Tailwind (`tailwind.config.ts`) with two DaisyUI themes from `daisyui-ntsd`
(light and dark):

- `primary: #8B5CF6`, `fontFamily: Inter` in both themes.
- `darkMode: ["class"]` — dark mode is toggled by a class on `<html>` (the
  `SunMoon` icon in the navbar drives this).
- Plugins: `@tailwindcss/typography` and `daisyui`.
- `safelist: ["alert-info", "alert-success", "alert-error"]` — DaisyUI alert
  colors kept alive even when only used via runtime class strings.
- Content glob: `./src/**/*.{astro,html,js,svelte,ts,svx,md}`.

Svelte preprocessing is `vitePreprocess()` from `@astrojs/svelte`
(`svelte.config.js`); the Svelte 5 runes are enabled through the
`@sveltejs/vite-plugin-svelte` override pinned in `package.json`
`overrides` (`^4.0.0-next.6`).

## PWA

`public/manifest.webmanifest`:

- `name`/`short_name`: "ZeroHub Share", standalone display,
  background/theme color `#0F172A`, `handle_links: "auto"`, portrait
  orientation, `favicon.svg` as the single (any-size) icon.

The service worker is generated/registered by the `astrojs-service-worker`
integration in `astro.config.mjs` (no manual `sw.js` in the repo).

## Astro / TypeScript Configuration

- `astro.config.mjs`: `output: "static"`, `compressHTML: true`,
  integrations `[tailwind(), svelte(), serviceWorker()]`, and a Vite
  `resolve.conditions: ["browser"]` so packages resolve their browser
  builds.
- `tsconfig.json` extends `astro/tsconfigs/strict`, includes
  `.astro/types.d.ts` and `**/*`, excludes `dist`.
- Static output: `astro build` emits `dist/` which can be served from any
  static host; the app has no server routes.

## GitHub Issue Templates & Triage Workflow

`.github/ISSUE_TEMPLATE/` contains the repo's issue workflow (used with Zero
Factory):

- `bug_report.yml` — "🐛 Bug Report (Zero Factory)". Title prefix `[Bug]: `,
  auto-applied labels `bug` + `zerofactory`; required sections for problem
  description, steps to reproduce, and expected vs actual behavior, plus an
  optional checkbox to request Zero Factory AI investigation.
- `feature_request.yml` — "🚀 Feature Request (Zero Factory)". Title prefix
  `[Feature]: `, auto-applied labels `feature` + `zerofactory`; required
  sections for feature summary/motivation and proposed solution, optional
  technical constraints/acceptance criteria, and the same AI-investigation
  checkbox.
- `config.yml` — `blank_issues_enabled: false`; directs blank issues to
  GitHub Discussions (`hotcode-dev/zerohub-share`) and the Zero Factory repo
  docs via `contact_links`.

Per the template markdown blocks, issues carrying the `zerofactory` label are
picked up automatically by Zero Factory's AI orchestrator into a human-gated
Triage task.

## Verification Commands

- `npm run build` — type-check and static build (the precommit `build` step).
- `npx vitest run` — crypto round-trip tests.
- `npx prettier --check --ignore-unknown .` — format gate.
- `npm run protogen` — after any `src/proto/message.proto` edit, then
  re-run build/tests to confirm the generated bindings still compile.
