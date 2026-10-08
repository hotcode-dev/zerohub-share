# Files

- [Encryption & Key Management](crypto.md) - The ZeroHub Share cryptographic layer: AES-128-GCM payload encryption, the two key-wrapping schemes (PBKDF2 password mode and RSA-OAEP mode), key exchange via FileMetadata.key, the IV||ciphertext chunk format, and the Vitest round-trip coverage.
- [File Transfer Protocol](file-transfer.md) - The ZeroHub Share wire protocol: the protobuf Message oneof, how a file is split across up to 16 WebRTC data channels, the per-chunk ACK handshake, receiver-side chunk accumulation, and failure handling.
