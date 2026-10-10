import { expect, test } from "vitest";
import {
  generateAesKey,
  encryptAesGcm,
  decryptAesGcm,
  encryptAesWithPassword,
  decryptAesWithPassword,
} from "./crypto";

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
