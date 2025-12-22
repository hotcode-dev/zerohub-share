import type { FileMetadata, FilePartMetaData } from "./proto/message";
import type { EventEmitter } from "eventemitter3";

export interface PeerMetaData {
  name: string;
  isHost?: boolean;
}

export interface HubMetaData {}

export interface FilePartDetail {
  filePartMetaData: FilePartMetaData;
  channelLabel: string;
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
}

export interface SendingFileSelection {
  file: File;
  isEncrypt: boolean;
  password: string;
  // chunk size in MB
  chunkSize: number;
  sendingFiles: {
    [peerId: string]: SendingFile;
  };
}

export interface ReceivingFilePart extends FilePartDetail {}

export interface ReceivingFile {
  fileMetadata: FileMetadata;
  status: FileStatus;
  error?: Error;
  isEncrypt: boolean;
  encryptedAesKey?: Uint8Array;
  aesKey?: CryptoKey;
  fileParts: {
    [filePartChannelLabel: string]: ReceivingFilePart;
  };
  // for stats
  progress: number; // percentage
  bitrate: number; // bytes per second
}

// File Stats during sending or receiving
// For non UI updates state, to reduce UI updates frequency
export interface FileStats {
  // percentage
  progress: number;
  // bytes per second
  bitrate: number;
  startTime: number;
  // next progress to update UI, if progress >= nextProgressUpdate, update UI and increase nextProgressUpdate by PROGRESS_UPDATE_UI_STEP
  nextProgressUpdate: number;
}

// Extends FileStats to include received size
// For non UI update state during receiving
export interface ReceivingFileStats extends FileStats {
  receivedSize: number;
}

// Receiving file part chunks, use to accumulate received chunks
// For non UI update state chunk received, to reduce UI updates frequency
export interface ReceivingFilePartChunks {
  receivedChunks: Uint8Array[];
}

export interface Setting {
  name: string;
  iceServer: string;
  autoDownload: boolean;
  bytesPerDataChannel: number;
}
