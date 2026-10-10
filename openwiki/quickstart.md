---
type: quickstart
title: ZeroHub Share - Task Routing & Quickstart
description: "Canonical entry point for agents working in this repo: what ZeroHub Share is, where the code lives, how to build/test it, and which openwiki page to read for a given task."
tags: [quickstart, task-routing, entry-points, navigation]
sources:
  - id: openwiki-source-7ddd532074a33ef91da2f06e
    resource: repo://.github/ISSUE_TEMPLATE/bug_report.yml
  - id: openwiki-source-a3ef188491b69d9ba48062e2
    resource: repo://.github/ISSUE_TEMPLATE/config.yml
  - id: openwiki-source-e6bb7eadbc71eea2d5463daf
    resource: repo://.github/ISSUE_TEMPLATE/feature_request.yml
  - id: openwiki-source-9ab161c6e9774cf771b19ced
    resource: repo://.zerofactory/precommit.sh
  - id: openwiki-source-5b54a58d1b51cd490b0e7162
    resource: repo://package.json
  - id: openwiki-source-e21de4e070e82eb7a1025ce0
    resource: repo://public/manifest.webmanifest
  - id: openwiki-source-765669c312313c1b02f31f14
    resource: repo://src/components/SharePage.svelte
  - id: openwiki-source-df978645d63dae43a14eab47
    resource: repo://src/layouts/main.astro
  - id: openwiki-source-1b681c4ce8d10cbab258bb09
    resource: repo://src/pages/index.astro
  - id: openwiki-source-8ef4b7799f3c645f0b2b5ac2
    resource: repo://src/proto/message.proto
  - id: openwiki-source-825971ed9c72d5969af1b150
    resource: repo://src/utils/crypto.ts
  - id: openwiki-source-98d5ddb014a0fd4d678f6f2a
    resource: repo://tsconfig.json
generated: { by: "hermes", at: "2026-10-10T02:18:08.107Z" }
verified:
  - by: openwiki/0.6.0
    at: 2026-10-10T02:18:08.107Z
---

ZeroHub Share (`zero-hub-share`) is a browser web app for **secure P2P file
sharing using WebRTC**. A ZeroHub signaling hub introduces peers sharing a
public IP (or invited by hub link); the actual file bytes move
peer-to-peer over up to 16 ordered WebRTC data channels, optionally
encrypted per-file with AES-128-GCM.

Built with **Astro 5 (static) + Svelte 5 (runes) + Tailwind/DaisyUI +
TypeScript strict**, and uses `@zero-hub/client` for signaling + WebRTC
setup.

## Where things live

| Area                       | Path(s)                                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------ |
| Astro shell / page         | `src/pages/index.astro` (mounts `SharePage` client-side)                                   |
| Layout                     | `src/layouts/main.astro` (head, Navbar, Footer, manifest)                                  |
| Svelte app root            | `src/components/SharePage.svelte` (ZeroHubClient + peers)                                  |
| Sender (upload) side       | `src/components/sender/Sender.svelte` (+ `SendingFileList`, `DragAndDrop`, `EncryptModal`) |
| Receiver (download) side   | `src/components/receiver/Receiver.svelte` (+ `ReceivingFileList`, `DecryptModal`)          |
| Wire protocol              | `src/proto/message.proto` -> `src/proto/message.ts` (ts-proto)                             |
| Crypto primitives          | `src/utils/crypto.ts` (+ `crypto.test.ts`)                                                 |
| Shared types / state model | `src/type.ts`                                                                              |
| Constants (channels, step) | `src/constants.ts`                                                                         |
| Config (host, STUN, page)  | `src/configs.ts`, `src/env.d.ts`                                                           |
| Persistent user settings   | `src/stores/setting.ts` (nanostores, localStorage `"setting"`)                             |
| Toasts                     | `src/stores/toast.ts` + `src/components/Toast.svelte`                                      |
| QR / invite                | `src/components/qr/QrModal.svelte`                                                         |
| App config                 | `astro.config.mjs`, `svelte.config.js`, `tailwind.config.ts`, `tsconfig.json`              |
| PWA manifest / assets      | `public/manifest.webmanifest`, `public/favicon.svg`, `public/logo.svg`                     |
| Precommit gate             | `.zerofactory/precommit.sh`                                                                |

## NPM scripts

| Script          | Command                                                          |
| --------------- | ---------------------------------------------------------------- |
| `dev` / `start` | `astro dev`                                                      |
| `build`         | `astro check && astro build`                                     |
| `preview`       | `astro preview`                                                  |
| `test`          | `vitest` (suite: `src/utils/crypto.test.ts`)                     |
| `pretty`        | `prettier --write "./src/**/*.{ts,json,astro,html,svelte}"`      |
| `protogen`      | regenerate `src/proto/message.ts` from `src/proto/message.proto` |
| `astro`         | astro CLI passthrough                                            |

## Task routing (read the wiki, not the source, first)

| You need to ...                                                                                | Read first                                                   |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Understand the big picture / component tree / hub & data-channel lifecycle / FileStatus states | [`architecture.md`](architecture.md)                         |
| Change the transfer protocol, chunk size, channel count, or ACK flow                           | [`subsystems/file-transfer.md`](subsystems/file-transfer.md) |
| Add/change encryption, key wrapping, or the unlock flow                                        | [`subsystems/crypto.md`](subsystems/crypto.md)               |
| Change build config, env vars, Prettier, precommit hook, theming, or PWA                       | [`operations.md`](operations.md)                             |
| Just get the repo building/running                                                             | This page + `operations.md`                                  |

## Quick start (run it)

1. `npm ci` (or `yarn`; `packageManager` pins yarn 1.22.22).
2. `npm run dev` -> dev server. Set `PUBLIC_ZEROHUB_HOST` in `.env.development`
   to your ZeroHub signaling host.
3. `npm run build` -> type-check + static build into `dist/`.
4. `npx vitest run` -> run the crypto tests.
5. Before committing, run `./.zerofactory/precommit.sh` (format + build +
   test).

## Conventions for this repo

- **Svelte 5 runes** (`$state`, `$props`, `$bindable`, `$effect`) — not the
  legacy `export let` store pattern.
- **Strict TS** (`astro/tsconfigs/strict`).
- **Prettier pinned to 3.6.2** — do not upgrade to 3.7.x (crashes on Svelte).
- **Never hand-edit generated files** — `src/proto/message.ts` is produced by
  `npm run protogen` from `message.proto`.
- **Don't commit** `.github/workflows/openwiki-update.yml` or `CLAUDE.md` if a
  tool generates them; Zero Factory manages updates via background cron, not
  GitHub Actions.
- **Issue triage**: GitHub issues filed through the templates in
  `.github/ISSUE_TEMPLATE/` carry the `zerofactory` label and are picked up
  by Zero Factory's AI orchestrator for human-gated triage — see the
  `GitHub Issue Templates & Triage Workflow` section in `operations.md`.
- This `openwiki/` directory is the agent knowledge base; keep it in sync via
  the OpenWiki lifecycle, not by hand.
