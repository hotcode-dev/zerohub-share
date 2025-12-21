import type { FileMetadata, FilePartMetaData } from "./proto/message";
import type { EventEmitter } from "eventemitter3";

export interface PeerMetaData {
  name: string;
  isHost?: boolean;
}

export interface HubMetaData {}

export interface FilePartDetail {
  filePartMetaData: FilePartMetaData;
}

export interface SendingFilePart extends FilePartDetail {
  event: EventEmitter;
}

export enum FileStatus {
  Pending = "Pending",
  WaitingAccept = "WaitingAccept",
  Processing = "Processing",
  Success = "Success",
}

export interface SendingFile {
  fileMetadata: FileMetadata;
  error?: Error;
  status: FileStatus;
  aesKey?: CryptoKey;
  event: EventEmitter;
  fileParts: {
    [filePartChannelLabel: string]: SendingFilePart;
  };
  // for stats
  progress: number; // percentage
  bitrate: number; // bytes per second
  startTime: number;
}

export interface SendingFileSelection {
  file: File;
  isEncrypt: boolean;
  password: string;
  chunkSize: number;
  sendingFiles: {
    [peerId: string]: SendingFile;
  };
}

export interface ReceivingFilePart extends FilePartDetail {
  receivedSize: number;
  receivedChunks: Uint8Array[];
}

export interface ReceivingFile {
  fileMetadata: FileMetadata;
  status: FileStatus;
  error?: Error;
  isEncrypt: boolean;
  encryptedAesKey?: Uint8Array;
  aesKey?: CryptoKey;
  receivedSize: number;
  fileParts: {
    [filePartChannelLabel: string]: ReceivingFilePart;
  };
  // for stats
  progress: number; // percentage
  bitrate: number; // bytes per second
  startTime: number;
}

export interface Setting {
  name: string;
  iceServer: string;
  autoDownload: boolean;
  bytesPerDataChannel: number;
}
