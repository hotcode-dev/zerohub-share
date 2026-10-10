const aesGenParams: AesKeyGenParams = {
  name: "AES-GCM",
  length: 128,
};

const keyUsage: ReadonlyArray<KeyUsage> = ["encrypt", "decrypt"];

// generateAesKey to generate an AES-128 key
export async function generateAesKey(): Promise<CryptoKey> {
  const key = await crypto.subtle.generateKey(aesGenParams, true, keyUsage);
  return key;
}

// encryptAesGcm to encrypt a message with an AES-128 key
export async function encryptAesGcm(
  key: CryptoKey,
  message: ArrayBuffer,
): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encryptedData = await crypto.subtle.encrypt(
    { name: aesGenParams.name, iv },
    key,
    message,
  );
  const encryptedArray = new Uint8Array(encryptedData);

  // Prepend the IV to the encrypted data
  const result = new Uint8Array(iv.length + encryptedArray.length);
  result.set(iv);
  result.set(encryptedArray, iv.length);

  return result;
}

// decryptAesGcm to decrypt a message with an AES-128 key
export async function decryptAesGcm(
  key: CryptoKey,
  encryptedData: Uint8Array,
): Promise<Uint8Array> {
  // Extract the IV from the encrypted data
  const iv = encryptedData.slice(0, 12);
  const encryptedMessage = encryptedData.slice(12);

  const decryptedData = await crypto.subtle.decrypt(
    { name: aesGenParams.name, iv },
    key,
    encryptedMessage,
  );

  return new Uint8Array(decryptedData);
}

// deriveKeyFromPassword to derive an AES key from a password using PBKDF2
export async function deriveKeyFromPassword(
  password: string,
  salt: BufferSource,
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    aesGenParams,
    true,
    keyUsage,
  );

  return key;
}

// encryptAesWithPassword to encrypt an AES key with a password
export async function encryptAesWithPassword(
  aesKey: CryptoKey,
  password: string,
): Promise<Uint8Array> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const derivedKey = await deriveKeyFromPassword(password, salt);
  const exportedAesKey = await crypto.subtle.exportKey("raw", aesKey);

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encryptedAesKey = await crypto.subtle.encrypt(
    { ...aesGenParams, iv },
    derivedKey,
    exportedAesKey,
  );

  const result = new Uint8Array(
    salt.length + iv.length + encryptedAesKey.byteLength,
  );
  result.set(salt);
  result.set(iv, salt.length);
  result.set(new Uint8Array(encryptedAesKey), salt.length + iv.length);

  return result;
}

// decryptAesWithPassword to decrypt an AES key with a password
export async function decryptAesWithPassword(
  encryptedAesKey: Uint8Array,
  password: string,
): Promise<CryptoKey> {
  const salt = encryptedAesKey.slice(0, 16);
  const iv = encryptedAesKey.slice(16, 28);
  const encryptedKey = encryptedAesKey.slice(28);

  const derivedKey = await deriveKeyFromPassword(password, salt);

  const decryptedAesKey = await crypto.subtle.decrypt(
    { ...aesGenParams, iv },
    derivedKey,
    encryptedKey,
  );

  const aesKey = await crypto.subtle.importKey(
    "raw",
    decryptedAesKey,
    aesGenParams,
    true,
    keyUsage,
  );

  return aesKey;
}
