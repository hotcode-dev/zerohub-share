import { expect, test } from "vitest";
import {
  generateRsaKeyPair,
  generateAesKey,
  encryptAesGcm,
  decryptAesGcm,
  encryptAesKeyWithRsaPublicKey,
  decryptAesKeyWithRsaPrivateKey,
  exportRsaPublicKeyToBase64,
  importRsaPublicKeyFromBase64,
  encryptAesWithPassword,
  decryptAesWithPassword,
} from "./crypto";

test("generateRsaKeyPair should generate a valid RSA key pair", async () => {
  const keyPair = await generateRsaKeyPair();
  expect(keyPair).toHaveProperty("publicKey");
  expect(keyPair).toHaveProperty("privateKey");
});

test("generateAesKey should generate a valid AES key", async () => {
  const key = await generateAesKey();
  expect(key).toBeDefined();
});

test("encryptAesGcm and decryptAesGcm should encrypt and decrypt a message correctly", async () => {
  const key = await generateAesKey();
  const message = new TextEncoder().encode("Hello, World!");
  const encryptedData = await encryptAesGcm(key, message.buffer);
  const decryptedData = await decryptAesGcm(key, encryptedData);
  const decryptedMessage = new TextDecoder().decode(decryptedData);
  expect(decryptedMessage).toBe("Hello, World!");
});

test("encryptAesKeyWithRsaPublicKey and decryptAesKeyWithRsaPrivateKey should encrypt and decrypt an AES key correctly", async () => {
  const rsaKeyPair = await generateRsaKeyPair();
  const aesKey = await generateAesKey();
  const encryptedAesKey = await encryptAesKeyWithRsaPublicKey(
    rsaKeyPair.publicKey,
    aesKey,
  );
  const decryptedAesKey = await decryptAesKeyWithRsaPrivateKey(
    rsaKeyPair.privateKey,
    encryptedAesKey,
  );
  expect(decryptedAesKey).toBeDefined();
});

test("exportRsaPublicKeyToBase64 and importRsaPublicKeyFromBase64 should export and import an RSA public key correctly", async () => {
  const rsaKeyPair = await generateRsaKeyPair();
  const base64PublicKey = await exportRsaPublicKeyToBase64(
    rsaKeyPair.publicKey,
  );
  const importedPublicKey = await importRsaPublicKeyFromBase64(base64PublicKey);
  expect(importedPublicKey).toBeDefined();
});

test("encryptAesWithPassword and decryptAesWithPassword should encrypt and decrypt an AES key correctly", async () => {
  const password = "strongpassword";
  const aesKey = await generateAesKey();
  const encryptedAesKey = await encryptAesWithPassword(aesKey, password);
  const decryptedAesKey = await decryptAesWithPassword(
    encryptedAesKey,
    password,
  );
  expect(decryptedAesKey).toBeDefined();
});
