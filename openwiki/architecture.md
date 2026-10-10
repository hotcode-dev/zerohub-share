---
type: system-architecture
title: System Architecture
description: "Top-level architecture of ZeroHub Share: how the ZeroHubClient hub bootstraps WebRTC P2P data channels, how SharePage wires Sender and Receiver per peer, and the FileStatus state machine that drives file transfers."
tags: [architecture, web-rtc, zero-hub, p2p, svelte, state-machine]
verified:
  - by: openwiki/0.6.0
    at: 2026-10-10T02:18:08.107Z
sources:
  - id: openwiki-source-c50574f22a4c0741148fc769
    resource: repo://astro.config.mjs
  - id: openwiki-source-5b54a58d1b51cd490b0e7162
    resource: repo://package.json
  - id: openwiki-source-b44a738391e0dd972a16a1ef
    resource: repo://src/components/receiver/Receiver.svelte
  - id: openwiki-source-d6db73741d251c8c754ff256
    resource: repo://src/components/sender/Sender.svelte
  - id: openwiki-source-765669c312313c1b02f31f14
    resource: repo://src/components/SharePage.svelte
  - id: openwiki-source-578f160ff71c06304de2a610
    resource: repo://src/configs.ts
  - id: openwiki-source-dda9830742b9d312e36561cf
    resource: repo://src/constants.ts
  - id: openwiki-source-1b681c4ce8d10cbab258bb09
    resource: repo://src/pages/index.astro
  - id: openwiki-source-65550323294401ec19b23b8c
    resource: repo://src/stores/setting.ts
  - id: openwiki-source-ebef8d66c8ea768663c3c87f
    resource: repo://src/type.ts
generated: { by: "hermes", at: "2026-10-08T14:31:05.399Z" }
---

ZeroHub Share is a browser-based P2P file-sharing app. A ZeroHub signaling hub
introduces peers that share the same public IP (or are invited via a hub id in
the URL). Once peers are connected, file transfer happens directly between
browsers over WebRTC data channels, with ZeroHub involved only in the initial
signaling.

## Application Root

`src/pages/index.astro` mounts the Svelte app root `SharePage` with
`client:load client:only="svelte"`. Inside `SharePage.svelte`:

- The `ZeroHubClient` is constructed from `zeroHubHosts` (from
  `PUBLIC_ZEROHUB_HOST` via `src/configs.ts`) and a `Partial<ZeroHubConfig>`.
- A reactive `peers` record (keyed by `peerId.toString()`) tracks each remote
  peer's `isOnline` flag, `dataChannels` record (keyed by channel label),
  attached `Receiver` component instance, peer metadata, and a dicebear SVG
  avatar derived from the peer's name.
- One `<Sender>` instance is rendered for the local user; one `<Receiver>` is
  rendered for every remote peer whose `isOnline` is true and that has at
  least one open data channel.
- Invite sharing: the current hub id is embedded into `window.location` as the
  `?id=` query parameter (`createInviteLink`), and users can copy the link or
  open a QR code via `QrModal`.

## Hub Join Strategies

`joinOrCreateHub(id, name)` in `SharePage.svelte` chooses between two ZeroHub
client methods:

- **No `?id=` param**: `zeroHub.joinOrCreateIPHub({ name }, {})` — the client
  joins or creates a hub keyed by the client's public IP.
- **`?id=<hubId>` param**: `zeroHub.joinIPHub(hubId, { name })` — the client
  joins the specific hub named by the URL.

The hub id is surfaced via `zeroHub.onHubInfo`, which stores it as `hubId` and
calls `createInviteLink(hubId)`. The page body renders nothing (just a
spinner) until `hubId` is set.

## ZeroHubClient Configuration

The client is configured with:

- `tls: isProduction` (from `import.meta.env.PROD` in `src/configs.ts`),
- `logLevel: isProduction ? LogLevel.Error : LogLevel.Debug`,
- `waitIceCandidatesTimeout: waitIceCandidatesTimeout` (1 s, from
  `src/configs.ts`),
- `rtcConfig.iceServers` sourced from `settingAtom.iceServer` (a single
  STUN/TURN URL, default `stun:stun.l.google.com:19302`),
- `dataChannelConfig` with `numberOfChannels: MAX_DATA_CHANNELS` (16),
  `rtcDataChannelInit: { ordered: true }`, and
  `onDataChannel: handleDataChannel`.

`handleDataChannel` registers the new `RTCDataChannel` in the peer's
`dataChannels` map and wires three handlers:

- `onmessage`: decodes the protobuf `Message` and dispatches by the oneof:
  `chunk` -> peer's `Receiver.onChunkData`,
  `filePartMetaData` -> peer's `Receiver.onFilePartMetaData`,
  `filePartEvent` -> local `Sender.onFilePartEvent`,
  `fileMetadata` -> peer's `Receiver.onFileMetaData`,
  `fileEvent` -> local `Sender.onFileEvent`.
- `onopen`/`onclose`: flip the peer's `isOnline` flag; when the last channel
  of a peer closes, the peer is marked offline.

## Per-Peer Data Channel Lifecycle

The peer record is created lazily by `ensurePeerEntry(peer)` whenever the
client reports a peer (via `onPeerStatusChange` or `onDataChannel`). The peer
record holds:

- `isOnline: boolean` — toggled by channel open/close and by `PeerStatus`.
- `dataChannels: Record<channelLabel, RTCDataChannel>` — one entry per open
  WebRTC data channel.
- `receiver: Receiver | undefined` — the attached Svelte component instance,
  used to invoke its public methods (`onChunkData`, `onFileMetaData`,
  `onFilePartMetaData`).
- `metadata: PeerMetaData` and `svgAvatar: string`.

When the client reports `PeerStatus.Connected` for a peer with a higher id
than `myPeerId` (the offerer side), the peer is marked online immediately.
When `PeerStatus.ZeroHubDisconnected` fires, `SharePage` explicitly closes
every channel in the peer's `dataChannels` map, clears the map, and marks the
peer offline.

## FileStatus State Machine

Defined in `src/type.ts` and driven by `FileEvent` / `FilePartEvent` protobuf
enums from `src/proto/message.ts`:

| State           | Trigger                                                                            |
| --------------- | ---------------------------------------------------------------------------------- |
| `Pending`       | Initial state; also the reset state on reject/error                                |
| `WaitingAccept` | Sender has published `FileMetadata` on `channel[0]`                                |
| `Processing`    | Receiver's `EVENT_RECEIVER_ACCEPT` event fired                                     |
| `Success`       | All file-part chunks received (receiver side) or all file parts sent (sender side) |

The sender transitions `Pending -> WaitingAccept` when `onSend` publishes the
`FileMetadata` message on the first channel. The receiver's `EVENT_RECEIVER_ACCEPT`
event flips the sender to `Processing` and starts the per-channel chunk loop.
`EVENT_RECEIVER_REJECT` and `EVENT_VALIDATE_ERROR` both revert the sender to
`Pending` (and set `sendingFile.error`). On the receiver side, `Success` is
reached when `receivedSize >= fileMetadata.size` (see
[File Transfer Protocol](subsystems/file-transfer.md)).

## Per-User Settings

User settings are persisted to `localStorage` under the key `"setting"` via
`@nanostores/persistent` (`settingAtom`). Defaults live in
`src/stores/setting.ts`:

- `name`: random Star Wars character name (via `unique-names-generator`).
- `iceServer`: `stunServers[0]` (`stun:stun.l.google.com:19302`).
- `autoDownload`: `true`.
- `bytesPerDataChannel`: `25 * 1024 * 1024` (25 MB), used to compute how many
  channels a file needs.

The UI exposes these fields via the `SettingModal` in the navbar; the
`SharePage` reads `settingAtom.name` and `settingAtom.iceServer` directly
when constructing the client.

## UI Update Throttling

File progress and bitrate are not updated on every chunk. Both sender and
receiver keep a non-reactive `FileStats` (in `src/type.ts`) with
`progress`, `bitrate`, `startTime`, and `nextProgressUpdate`. The reactive
`SendingFile` / `ReceivingFile` state is only touched when
`progress >= nextProgressUpdate`, after which `nextProgressUpdate` is
incremented by `PROGRESS_UPDATE_UI_STEP` (3 percentage points). This keeps
Svelte's reactive diff small and avoids re-rendering the file cards on every
32 KB chunk.

## Extension Points

- Adding a new ZeroHub host: extend the `zeroHubHosts` array in
  `src/configs.ts` (currently a single-entry array sourced from
  `PUBLIC_ZEROHUB_HOST`).
- Adding more STUN/TURN servers: the `stunServers` array in
  `src/configs.ts` is the default pool; users can override via
  `settingAtom.iceServer`.
- Configuring the number of data channels: currently hardcoded to
  `MAX_DATA_CHANNELS` (16) in both `SharePage` and `Sender`.
