---
type: subsystem
title: Encryption & Key Management
description: "The ZeroHub Share cryptographic layer: AES-128-GCM payload encryption, the two key-wrapping schemes (PBKDF2 password mode and RSA-OAEP mode), key exchange via FileMetadata.key, the IV||ciphertext chunk format, and the Vitest round-trip coverage."
tags: [crypto, web-crypto, aes-gcm, pbkdf2, rsa, key-wrapping, encryption]
sources:
  - id: openwiki-source-9ab161c6e9774cf771b19ced
    resource: repo://.zerofactory/precommit.sh
  - id: openwiki-source-c6094a39fe4b3a83b055b2d7
    resource: repo://src/components/receiver/DecryptModal.svelte
  - id: openwiki-source-b44a738391e0dd972a16a1ef
    resource: repo://src/components/receiver/Receiver.svelte
  - id: openwiki-source-3715a7959eed7642cfdc71eb
    resource: repo://src/components/sender/EncryptModal.svelte
  - id: openwiki-source-d6db73741d251c8c754ff256
    resource: repo://src/components/sender/Sender.svelte
  - id: openwiki-source-8ef4b7799f3c645f0b2b5ac2
    resource: repo://src/proto/message.proto
  - id: openwiki-source-e623e6b67d883af196893411
    resource: repo://src/utils/crypto.test.ts
  - id: openwiki-source-825971ed9c72d5969af1b150
    resource: repo://src/utils/crypto.ts
generated: { by: "hermes", at: "2026-10-10T02:18:08.107Z" }
verified:
  - by: openwiki/0.6.0
    at: 2026-10-10T02:18:08.107Z
---

Encryption in ZeroHub Share is optional per-file and runs entirely in the
browser using the Web Crypto API (`crypto.subtle`). All primitives live in
`src/utils/crypto.ts`; the send/receive wiring lives in
`src/components/sender/Sender.svelte`, `src/components/receiver/Receiver.svelte`,
and the `EncryptModal` / `DecryptModal` UI.

## Scheme Overview

A per-file AES-128-GCM key encrypts every chunk. That AES key is wrapped
(one of two schemes) so only the intended receiver can recover it, and the
wrapped key travels inside `FileMetadata.key` alongside the file metadata.

1. **Password mode (active in the UI)**: the sender's `EncryptModal` asks for
   a password. `encryptAesWithPassword(aesKey, password)` generates a random
   16-byte salt, derives an AES-128-GCM wrapping key via PBKDF2-SHA-256 with
   100,000 iterations, and AES-GCM-encrypts the raw AES key. The output is
   concatenated as `salt (16) || iv (12) || ciphertext` and placed in
   `FileMetadata.key`. The receiver prompts for the password in
   `DecryptModal` and calls `decryptAesWithPassword`, which slices the salt
   (bytes 0-16) and IV (bytes 16-28), re-derives the key, and unwraps.
2. **RSA mode (implemented + tested, not wired into the UI path)**:
   `generateRsaKeyPair()` creates an RSA-1024 OAEP-SHA-256 keypair (1024-bit
   modulus is sufficient because it only ever wraps a 128-bit AES key).
   `encryptAesKeyWithRsaPublicKey` exports the AES key as raw and encrypts
   it with the public key; `decryptAesKeyWithRsaPrivateKey` recovers and
   re-imports it. The public key is serializable via
   `exportRsaPublicKeyToBase64` / `importRsaPublicKeyFromBase64` (SPKI,
   base64).

The receiver only learns the AES key after successful unwrapping; until then
the file sits in `WaitingAccept` and no `EVENT_RECEIVER_ACCEPT` is sent.

## Encrypted Chunk Format

When `isEncrypt` is set, every chunk is wrapped before being framed in a
`Message.chunk`:

- `encryptAesGcm(key, message)` generates a fresh random 12-byte IV per
  chunk, AES-128-GCM encrypts the buffer, and returns `IV (12) ||
ciphertext`.
- `decryptAesGcm(key, encryptedData)` slices the first 12 bytes as the IV
  and decrypts the remainder.

In `Sender.svelte`, `sendBuffer()` encrypts the chunk with the file's
`aesKey` when `sendingFileSelection.isEncrypt`; in `Receiver.svelte`,
`onChunkData()` decrypts with the unwrapped `aesKey` before appending to the
accumulated chunk arrays (so plaintext bytes are what get reassembled into
the final Blob).

## Key Parameters

- AES: `AES-GCM`, 128-bit key, 12-byte IV, key usage `["encrypt", "decrypt"]`.
- RSA: `RSA-OAEP`, 1024-bit modulus, public exponent 65537
  (`0x01 0x00 0x01`), SHA-256 padding hash.
- PBKDF2: SHA-256, 100,000 iterations, 16-byte random salt.
- Serialization: RSA public key as SPKI -> base64
  (`exportRsaPublicKeyToBase64`); AES keys as raw
  (`crypto.subtle.exportKey("raw", ...)`). `arrayBufferToBase64` /
  `base64ToArrayBuffer` are the base64 helpers.

## Receiver Unlock Flow

In `Receiver.svelte` `onAccept(fileId)`:

- Non-encrypted file: immediately set `Processing` and send
  `EVENT_RECEIVER_ACCEPT`.
- Encrypted file: open `DecryptModal.openUnlock()`. On a password, call
  `decryptAesWithPassword(receivedFile.encryptedAesKey, password)`; success
  stores the `aesKey` on the `ReceivingFile` (subsequent `onChunkData` then
  decrypts) and sends `EVENT_RECEIVER_ACCEPT`. A wrong password throws, is
  caught, and toasts "Unlock error: wrong password" — the file is not
  accepted and the sender keeps waiting.

## Test Coverage

`src/utils/crypto.test.ts` (Vitest) exercises every primitive with
round-trip assertions:

- `generateRsaKeyPair` produces both key halves.
- `generateAesKey` yields a defined key.
- `encryptAesGcm` / `decryptAesGcm` round-trip a message.
- `encryptAesKeyWithRsaPublicKey` / `decryptAesKeyWithRsaPrivateKey`
  round-trip an AES key.
- `exportRsaPublicKeyToBase64` / `importRsaPublicKeyFromBase64`
  round-trip the public key.
- `encryptAesWithPassword` / `decryptAesWithPassword` round-trip an AES key
  with a password.

<!-- openwiki: broken internal link [operations.md] file "operations.md" does not exist. Fix the href or restore the target, then delete this comment. -->

Run with `npx vitest run` (see [Operations](operations.md)).

## Notes & Extension Points

- RSA-mode helpers exist and are tested but the current UI flow uses
  password mode only (`Sender.svelte` always calls
  `encryptAesWithPassword` when `isEncrypt`); enabling RSA would require
  shipping the RSA public key to the receiver (the `FileMetadata.key` field
  and `is_encrypt` flag already leave room for this without a wire change).
- The README lists "Remove encrypt by RSA" and "Add encrypt AES by password"
  as historical TODOs, consistent with password mode being the active path.
- RSA-1024 is intentionally small; if the RSA path is ever enabled for
  production traffic, evaluate a larger modulus (2048-bit).
