---
type: subsystem
title: File Transfer Protocol
description: "The ZeroHub Share wire protocol: the protobuf Message oneof, how a file is split across up to 16 WebRTC data channels, the per-chunk ACK handshake, receiver-side chunk accumulation, and failure handling."
tags: [protocol, protobuf, web-rtc, data-channels, chunking, ack, file-transfer]
verified:
  - by: openwiki/0.6.0
    at: 2026-10-08T14:31:05.399Z
sources:
  - id: openwiki-source-5b54a58d1b51cd490b0e7162
    resource: repo://package.json
  - id: openwiki-source-b44a738391e0dd972a16a1ef
    resource: repo://src/components/receiver/Receiver.svelte
  - id: openwiki-source-d6db73741d251c8c754ff256
    resource: repo://src/components/sender/Sender.svelte
  - id: openwiki-source-765669c312313c1b02f31f14
    resource: repo://src/components/SharePage.svelte
  - id: openwiki-source-dda9830742b9d312e36561cf
    resource: repo://src/constants.ts
  - id: openwiki-source-8ef4b7799f3c645f0b2b5ac2
    resource: repo://src/proto/message.proto
generated: { by: "hermes", at: "2026-10-08T14:31:05.399Z" }
---

File transfer in ZeroHub Share is a custom protocol carried over WebRTC data
channels. It is split into two layers: control messages (metadata + events)
and data messages (file chunks), all framed in a single protobuf `Message`.

## Wire Format

Defined in `src/proto/message.proto` and compiled to
`src/proto/message.ts` via `npm run protogen` (ts-proto). The top-level
`Message` has an `id` (string, the file name, used as the transfer
correlation key) and a `oneof data`:

- `fileMetadata` (`FileMetadata`) — announced by the sender on channel 0.
- `filePartMetaData` (`FilePartMetaData`) — one per channel, announced after
  the receiver accepts the file.
- `chunk` (`bytes`) — a slice of a file part.
- `fileEvent` (`FileEvent`) — receiver -> sender: `EVENT_RECEIVER_ACCEPT`,
  `EVENT_RECEIVER_REJECT`, `EVENT_VALIDATE_ERROR`.
- `filePartEvent` (`FilePartEvent`) — receiver -> sender:
  `EVENT_RECEIVED_CHUNK`, `EVENT_RECEIVED_FILE_PART_METADATA`.

`FileMetadata` carries `name`, `size`, `type` (mime), `is_encrypt`,
`channels` (requested channel count), and an optional `key` (the wrapped AES

<!-- openwiki: broken internal link [subsystems/crypto.md] file "subsystems/crypto.md" does not exist. Fix the href or restore the target, then delete this comment. -->

key — see [Encryption](subsystems/crypto.md)). `FilePartMetaData` carries
`part_number` and `part_size`.

`SharePage.svelte` decodes every inbound `RTCDataChannel.onmessage` payload
with `Message.decode` and dispatches by which oneof field is set (see

<!-- openwiki: broken internal link [architecture.md] file "architecture.md" does not exist. Fix the href or restore the target, then delete this comment. -->

[Architecture](architecture.md)).

## Channel Multiplexing

A single file is spread across multiple WebRTC data channels to use the
parallel bandwidth. Constants live in `src/constants.ts`:

- `MAX_DATA_CHANNELS = 16` — hard cap on parts per file.
- `DEFAULT_BYTES_PER_DATA_CHANNEL = 25 * 1024 * 1024` (25 MB) — the bytes-per-channel
  default used to size the channel count; user-overridable via
  `settingAtom.bytesPerDataChannel`.

In `Sender.svelte` `onSend(fileId, peerId)`:

1. Collect the peer's open data channels
   (`workingFilePartChannels = Object.values(peer.dataChannels).filter(c => c.readyState === "open")`).
   If none are open, toast "No file part channels are ready" and abort.
2. Compute `requestedFilePartChannelCount = min(MAX_DATA_CHANNELS,
max(1, ceil(file.size / bytesPerChannel)))`, then
   `filePartChannelsCount = min(requestedFilePartChannelCount,
workingFilePartChannels.length)`. Take the first N channels.
3. `partSize = ceil(file.size / dataChannels.length)`.
4. Generate the AES key (if `isEncrypt`) and wrap it with the password
   (`encryptAesWithPassword`).
5. Build the `FileMetadata` and store a `SendingFile` (with
   `FileStatus.Pending`, an `EventEmitter`, `progress`, `bitrate`).
6. Send `FileMetadata` on `dataChannels[0]` and set status to
   `WaitingAccept`.

`startSendFilePart()` runs once the receiver has accepted (driven by
`EVENT_RECEIVER_ACCEPT`): for each channel, it defines the
`FilePartMetaData` (`partNumber = i`, `partSize`), a `SendingFilePart`
with its own `EventEmitter`, and the per-channel chunk loop. It then sends
`FilePartMetaData` on each channel.

## Per-Chunk ACK Flow

The chunk loop is stop-and-wait per channel:

1. The sender sends the **first** chunk on a channel only after it receives
   `EVENT_RECEIVED_FILE_PART_METADATA` for that channel (registered via
   `sendingFilePart.event.on(FILE_PART_EVENT[...])`).
2. `sendNextChunk()` slices the next `chunkSize` bytes (hardcoded 32 KB,
   `32 * 1024`) from the file part at the current offset, reads the
   `ArrayBuffer`, and calls `sendBuffer`.
3. `sendBuffer` optionally AES-GCM encrypts the chunk (if `isEncrypt` and
   the `aesKey` is set) and wraps it in a `Message` with
   `id = file.name`, then calls `channel.send(payload)`.
4. On `EVENT_RECEIVED_CHUNK` for that channel, the sender advances
   `filePartoffset` and, if the part is not finished, calls
   `sendNextChunk()` again.
5. When a part's `filePartoffset` reaches `partSize`, `successFileParts` is
   incremented; when `successFileParts === dataChannels.length`, the
   `SendingFile` status is set to `Success` and a success toast is shown.

The chunk size of 32 KB is chosen so that individual `Message` frames stay
comfortably below WebRTC's ~64 KB MTU budget. The per-chunk ACK keeps memory
bounded on the sender: it never pipelines more than one in-flight chunk per
channel.

## Receiver-Side Accumulation

In `Receiver.svelte`, per-file state is held in:

- `receivingFiles: {[fileId]: ReceivingFile}` (reactive) — metadata, status,
  per-channel part details, `progress`, `bitrate`, and the unwrapped `aesKey`
  once the user has unlocked.
- `receivingFilePartChunkMap: {[fileId]: {[channelLabel]:
ReceivingFilePartChunks}}` (non-reactive) — the accumulated
  `Uint8Array[]` of received (decrypted) chunks per channel.
- `receivingFileStatsMap: {[fileId]: ReceivingFileStats}` (non-reactive) —
  running `receivedSize` and throttle bookkeeping.

On inbound:

- `onFileMetaData` creates the `ReceivingFile` (status `WaitingAccept`) and
  stats entry, and expands the collapse UI.
- `onFilePartMetaData` registers the part under the channel label and emits
  `EVENT_RECEIVED_FILE_PART_METADATA` back to the sender (starting the chunk
  flow).
- `onChunkData` decrypts the chunk if the file is encrypted
  (`decryptAesGcm`), appends it to the channel's chunk array, accumulates
  `receivedSize`, and — once `receivedSize >= fileMetadata.size` — marks the
  file `Success` and toasts.

`onDownload(fileId)` reassembles the file: it sorts the parts by
`partNumber`, flattens their per-channel chunk arrays in order, builds a
`Blob` with the original mime type, and triggers a download via
`URL.createObjectURL` + a synthetic `<a>` click, then revokes the URL.
`downloadAllFiles()` loops over all `Success` files.

## Accept / Reject

`onAccept(fileId)` in `Receiver.svelte`:

- If `!isEncrypt`: set status `Processing` and send `EVENT_RECEIVER_ACCEPT`.
- If `isEncrypt`: open `DecryptModal.openUnlock()` to prompt for the
  password, call `decryptAesWithPassword(encryptedAesKey, password)`, and on
  success store the `aesKey` on the `ReceivingFile`, set status `Processing`,
  and send `EVENT_RECEIVER_ACCEPT`. On failure, toast "Unlock error: wrong
  password" and do **not** accept (the sender will keep waiting).

`onDeny(fileId)` / `onRemove(fileId)`:

- If the file is not yet `Success`, send `EVENT_RECEIVER_REJECT` back to the
  sender, then delete the `ReceivingFile` entry.

## Failure Modes

- **No open channels**: `onSend` aborts with a toast before any metadata is
  sent.
- **Per-chunk send error**: the sender sets `sendingFile.error`, toasts
  "Failed to send chunk", and stops sending further chunks on that channel.
  The `EVENT_RECEIVED_CHUNK` handler also re-checks `sendingFile.error` and,
  if set, reverts the `SendingFile` status to `Pending` and progress to 0.
- **`EVENT_RECEIVER_REJECT`**: the sender reverts to `Pending` and stores an
  error.
- **`EVENT_VALIDATE_ERROR`**: the sender reverts to `Pending` and toasts
  "Receiver validate error".

## Progress / Bitrate

<!-- openwiki: broken internal link [architecture.md] file "architecture.md" does not exist. Fix the href or restore the target, then delete this comment. -->

The same throttling described in [Architecture](architecture.md) applies on
both sides: `progress` and `bitrate` on the reactive `SendingFile` /
`ReceivingFile` are only updated when the non-reactive `FileStats`
`nextProgressUpdate` threshold is crossed (in 3%-point increments via
`PROGRESS_UPDATE_UI_STEP`).

## Extension Points

- **Channel count**: change `MAX_DATA_CHANNELS` in `src/constants.ts` or
  override `settingAtom.bytesPerDataChannel` to alter how many channels a
  file uses.
- **Chunk size**: currently a literal `32 * 1024` in
`Sender.svelte#onFilesPick`; a `TODO` marks this as a candidate for a
user-facing setting.
<!-- openwiki: broken internal link [subsystems/crypto.md] file "subsystems/crypto.md" does not exist. Fix the href or restore the target, then delete this comment. -->
- **Encryption**: see [Encryption & Key Management](subsystems/crypto.md);
  the protocol already carries the wrapped key in `FileMetadata.key` and the
  `is_encrypt` flag, so RSA-only key exchange can be enabled without changing
  the wire format.
