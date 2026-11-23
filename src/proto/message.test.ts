import { expect, test } from "vitest";
import { BinaryReader } from "@bufbuild/protobuf/wire";
import { FileEvent, FilePartEvent, Message } from "./message";

// Regression test for the proto dependency manifest: `src/proto/message.ts`
// is ts-proto-generated (v2.2.0) and pulls BinaryReader/BinaryWriter from
// `@bufbuild/protobuf/wire`. That package is now a declared devDependency;
// these round-trips fail (module resolution error) if it is ever removed
// from package.json again or hoisting no longer resolves it.

test("Message encodes and decodes a full file-metadata message", () => {
  const chunk = new Uint8Array([1, 2, 3, 4, 250]);
  const original: Message = {
    id: "file-42",
    fileMetadata: {
      name: "report.pdf",
      size: 1024 * 1024,
      type: "application/pdf",
      isEncrypt: true,
      channels: 2,
      key: new Uint8Array([9, 8, 7]),
    },
    filePartMetaData: {
      partNumber: 3,
      partSize: 65536,
    },
    chunk,
  };

  const encoded = Message.encode(original).finish();
  const decoded = Message.decode(new BinaryReader(encoded));

  expect(decoded.id).toBe("file-42");
  expect(decoded.fileMetadata).toEqual(original.fileMetadata);
  expect(decoded.filePartMetaData).toEqual(original.filePartMetaData);
  expect(decoded.chunk).toEqual(chunk);
});

test("Message encodes and decodes event-only messages", () => {
  const acceptEncoded = Message.encode({
    id: "file-42",
    fileEvent: FileEvent.EVENT_RECEIVER_ACCEPT,
  }).finish();
  const accept = Message.decode(new BinaryReader(acceptEncoded));
  expect(accept.fileEvent).toBe(FileEvent.EVENT_RECEIVER_ACCEPT);

  const partMetaEncoded = Message.encode({
    id: "file-42",
    filePartEvent: FilePartEvent.EVENT_RECEIVED_FILE_PART_METADATA,
  }).finish();
  const partMeta = Message.decode(new BinaryReader(partMetaEncoded));
  expect(partMeta.filePartEvent).toBe(
    FilePartEvent.EVENT_RECEIVED_FILE_PART_METADATA,
  );
});

test("Message.decode throws on truncated wire data", () => {
  const full = Message.encode({
    id: "file-42",
    fileMetadata: {
      name: "report.pdf",
      size: 1024,
      type: "application/pdf",
      isEncrypt: false,
      channels: 1,
    },
  }).finish();
  expect(() =>
    Message.decode(
      new BinaryReader(full.slice(0, Math.floor(full.length / 2))),
    ),
  ).toThrow();
});
