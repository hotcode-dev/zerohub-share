import type { MetaData } from "./proto/message";
import type { EventEmitter } from "eventemitter3";

export interface PeerMetaData {
  name: string;
  rsaPub: CryptoKey | undefined;
}

export interface HubMetaData {}

export enum FileStatus {
  Pending = "Pending",
  WaitingAccept = "WaitingAccept",
  Processing = "Processing",
  Success = "Success",
}

export interface FileDetail {
  metaData: MetaData;
  progress: number; // percentage
  bitrate: number; // bytes per second
  error?: Error;
  startTime: number;
  status: FileStatus;
  aesKey?: CryptoKey;
}

export interface SendingFile extends FileDetail {
  event: EventEmitter;
}

export interface SendingFileSelection {
  stop: boolean;
  file: File;
  isEncrypt: boolean;
  chunkSize: number;
  sendingFiles: {
    [peerId: string]: SendingFile;
  };
}

export interface ReceivingFile extends FileDetail {
  receivedSize: number;
  isEncrypt: boolean;
  receivedChunks: Uint8Array[];
}

export interface ReceiveOptions {
  autoAccept: boolean;
  maxSize: number;
}

export interface Setting {
  name: string;
  iceServer: string;
}
