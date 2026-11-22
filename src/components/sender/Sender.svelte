<script lang="ts">
  import DragAndDrop from "./DragAndDrop.svelte";
  import EventEmitter from "eventemitter3";
  import {
    FileStatus,
    type FileStats,
    type PeerMetaData,
    type SendingFile,
    type SendingFilePart,
    type SendingFileSelection,
  } from "../../type";
  import SendingFileList from "./SendingFileList.svelte";
  import {
    encryptAesGcm,
    encryptAesWithPassword,
    generateAesKey,
  } from "../../utils/crypto";
  import {
    FileMetadata,
    Message,
    FilePartMetaData,
    FileEvent,
    FilePartEvent,
  } from "../../proto/message";
  import { addToastMessage } from "../../stores/toast";
  import SendDropdown from "./SendDropdown.svelte";
  import UpTray from "../icons/UpTray.svelte";
  import {
    DEFAULT_BYTES_PER_DATA_CHANNEL,
    MAX_DATA_CHANNELS,
    PROGRESS_UPDATE_UI_STEP,
  } from "../../constants";
  import { settingAtom } from "../../stores/setting";

  type Props = {
    peers: {
      [peerId: string]: {
        isOnline: boolean;
        dataChannels: Record<string, RTCDataChannel>;
        metadata: PeerMetaData;
        svgAvatar: string;
      };
    };
    isDrop?: boolean;
    hideSendButton?: boolean;
  };

  const { peers, isDrop, hideSendButton }: Props = $props();

  let sendingFileSelections: { [fileId: string]: SendingFileSelection } =
    $state({});

  let queuedCount = $derived(Object.keys(sendingFileSelections).length);

  const FILE_EVENT: { [key in FileEvent]: string } = {
    [FileEvent.EVENT_RECEIVER_ACCEPT]: "receiver_accept",
    [FileEvent.EVENT_RECEIVER_REJECT]: "receiver_reject",
    [FileEvent.EVENT_VALIDATE_ERROR]: "validate_error",
    [FileEvent.UNRECOGNIZED]: "unrecognized",
  };

  const FILE_PART_EVENT: {
    [key in FilePartEvent]: string;
  } = {
    [FilePartEvent.EVENT_RECEIVED_CHUNK]: "received_chunk",
    [FilePartEvent.EVENT_RECEIVED_FILE_PART_METADATA]:
      "received_file_part_metadata",
    [FilePartEvent.UNRECOGNIZED]: "unrecognized",
  };

  export function onFileEvent(
    fileId: string,
    peerId: string,
    fileEvent: FileEvent,
  ) {
    sendingFileSelections[fileId].sendingFiles[peerId].event.emit(
      FILE_EVENT[fileEvent],
    );
  }

  export function onFilePartEvent(
    fileId: string,
    peerId: string,
    channelLabel: string,
    filePartEvent: FilePartEvent,
  ) {
    const sendingFilePart =
      sendingFileSelections[fileId].sendingFiles[peerId].fileParts[
        channelLabel
      ];
    sendingFilePart.event.emit(FILE_PART_EVENT[filePartEvent]);
  }

  async function onSend(fileId: string, peerId: string) {
    const sendingFileSelection = sendingFileSelections[fileId];
    const file = sendingFileSelection.file;
    const peer = peers[peerId];
    const fileStats: FileStats = {
      progress: 0,
      bitrate: 0,
      startTime: Date.now(),
      nextProgressUpdate: 0,
    };

    if (!peer) {
      addToastMessage("Peer not found", "error");
      return;
    }

    const workingFilePartChannels = Object.values(peer.dataChannels).filter(
      (channel) => channel && channel.readyState === "open",
    );
    if (workingFilePartChannels.length === 0) {
      addToastMessage("No file part channels are ready", "error");
      return;
    }

    const bytesPerChannel = Math.max(
      1,
      $settingAtom.bytesPerDataChannel ?? DEFAULT_BYTES_PER_DATA_CHANNEL,
    );
    const requestedFilePartChannelCount = Math.min(
      MAX_DATA_CHANNELS,
      Math.max(1, Math.ceil(file.size / bytesPerChannel)),
    );
    const filePartChannelsCount = Math.min(
      requestedFilePartChannelCount,
      workingFilePartChannels.length,
    );
    let dataChannels = workingFilePartChannels.slice(0, filePartChannelsCount);
    const partSize = Math.ceil(file.size / dataChannels.length);

    let aesKey;
    let aesEncrypted: Uint8Array | undefined;
    if (sendingFileSelection.isEncrypt) {
      aesKey = await generateAesKey();
      aesEncrypted = await encryptAesWithPassword(
        aesKey,
        sendingFileSelection.password,
      );
    }

    const fileMetadata: FileMetadata = {
      name: file.name,
      size: file.size,
      type: file.type,
      isEncrypt: sendingFileSelection.isEncrypt,
      key: aesEncrypted,
      channels: requestedFilePartChannelCount,
    };

    const sendingFile: SendingFile = {
      status: FileStatus.Pending,
      aesKey: aesKey,
      fileMetadata: fileMetadata,
      fileParts: {},
      progress: 0,
      bitrate: 0,
      event: new EventEmitter(),
    };
    sendingFileSelection.sendingFiles[peerId] = sendingFile;

    const startSendFilePart = () => {
      let fileOffset = 0;
      let successFileParts = 0;
      for (let i = 0; i < dataChannels.length; i++) {
        const channel = dataChannels[i];

        const start = i * partSize;
        const end = Math.min(start + partSize, file.size);
        const filePart = file.slice(start, end);

        let filePartoffset = 0;

        const filePartMetaData: FilePartMetaData = {
          partNumber: i,
          partSize: filePart.size,
        };

        const sendingFilePart: SendingFilePart = {
          filePartMetaData: filePartMetaData,
          channelLabel: channel.label,
          event: new EventEmitter(),
        };

        sendingFileSelection.sendingFiles[peerId].fileParts[channel.label] =
          sendingFilePart;

        sendingFilePart.event.on(
          FILE_PART_EVENT[FilePartEvent.EVENT_RECEIVED_CHUNK],
          async () => {
            if (sendingFile.error) {
              console.log("error", sendingFile.error);
              sendingFileSelections[fileId].sendingFiles[peerId].status =
                FileStatus.Pending;
              sendingFileSelections[fileId].sendingFiles[peerId].progress = 0;
              return;
            }

            if (
              filePartoffset <
              sendingFileSelections[fileId].sendingFiles[peerId].fileParts[
                channel.label
              ].filePartMetaData.partSize
            ) {
              sendNextChunk();
              return;
            }

            successFileParts += 1;
            if (successFileParts === dataChannels.length) {
              sendingFileSelections[fileId].sendingFiles[peerId].status =
                FileStatus.Success;
              addToastMessage(
                `File ${sendingFile.fileMetadata.name} sent successfully`,
                "success",
              );
            }
          },
        );

        async function sendBuffer(buffer: ArrayBuffer) {
          if (sendingFileSelection.isEncrypt) {
            const aesKey = sendingFile.aesKey;
            if (aesKey) {
              const encrypted = await encryptAesGcm(aesKey, buffer);
              const payload = Message.encode({
                id: fileId,
                chunk: encrypted,
              }).finish();

              channel.send(payload);
              return;
            }
          }

          const payload = Message.encode({
            id: fileId,
            chunk: new Uint8Array(buffer),
          }).finish();

          channel.send(payload);
        }

        const sendNextChunk = async () => {
          const slice = filePart.slice(
            filePartoffset,
            filePartoffset + sendingFileSelection.chunkSize,
          );
          const buffer = await slice.arrayBuffer();

          try {
            await sendBuffer(buffer);
          } catch (error) {
            console.error("Failed to send chunk", error);
            sendingFileSelections[fileId].sendingFiles[peerId].error =
              error instanceof Error
                ? error
                : new Error("Failed to send chunk");
            addToastMessage("Failed to send chunk", "error");
            return;
          }

          filePartoffset += buffer.byteLength;
          fileOffset += buffer.byteLength;

          fileStats.progress = Math.round(
            (fileOffset / sendingFile.fileMetadata.size) * 100,
          );
          if (fileStats.progress >= fileStats.nextProgressUpdate) {
            fileStats.bitrate = Math.round(
              fileOffset / ((Date.now() - fileStats.startTime) / 1000),
            );
            sendingFileSelections[fileId].sendingFiles[peerId].progress =
              fileStats.progress;
            sendingFileSelections[fileId].sendingFiles[peerId].bitrate =
              fileStats.bitrate;
            fileStats.nextProgressUpdate += PROGRESS_UPDATE_UI_STEP;
            if (fileStats.nextProgressUpdate > 100) {
              fileStats.nextProgressUpdate = 100;
            }
          }
        };

        sendingFilePart.event.on(
          FILE_PART_EVENT[FilePartEvent.EVENT_RECEIVED_FILE_PART_METADATA],
          () => {
            sendNextChunk();
          },
        );

        const metadataPayload = Message.encode({
          id: fileId,
          filePartMetaData: filePartMetaData,
        }).finish();
        channel.send(metadataPayload);
      }
    };

    sendingFile.event.on(FILE_EVENT[FileEvent.EVENT_RECEIVER_ACCEPT], () => {
      sendingFileSelections[fileId].sendingFiles[peerId].status =
        FileStatus.Processing;
      startSendFilePart();
    });
    sendingFile.event.on(FILE_EVENT[FileEvent.EVENT_VALIDATE_ERROR], () => {
      addToastMessage("Receiver validate error", "error");
      sendingFileSelections[fileId].sendingFiles[peerId].error = new Error(
        "Receiver validate error",
      );
      sendingFileSelections[fileId].sendingFiles[peerId].status =
        FileStatus.Pending;
    });

    sendingFile.event.on(FILE_EVENT[FileEvent.EVENT_RECEIVER_REJECT], () => {
      addToastMessage("Receiver reject the file", "error");
      sendingFileSelections[fileId].sendingFiles[peerId].error = new Error(
        "Receiver reject the file",
      );
      sendingFileSelections[fileId].sendingFiles[peerId].status =
        FileStatus.Pending;
    });

    dataChannels[0].send(
      Message.encode({
        id: fileId,
        fileMetadata: fileMetadata,
      }).finish(),
    );

    sendingFileSelections[fileId].sendingFiles[peerId].status =
      FileStatus.WaitingAccept;
  }

  export async function sendAllFiles(peerId: string) {
    for (const fileId of Object.keys(sendingFileSelections)) {
      await onSend(fileId, peerId);
    }
  }

  function onRemove(fileId: string) {
    delete sendingFileSelections[fileId];
  }

  function onFilesPick(files: FileList) {
    Array.from(files).forEach(async (file) => {
      const fileId = crypto.randomUUID();
      sendingFileSelections[fileId] = {
        file: file,
        chunkSize: 32 * 1024,
        isEncrypt: false,
        password: "",
        sendingFiles: {},
      };

      if (isDrop && peers) {
        for (const peerId of Object.keys(peers)) {
          await onSend(fileId, peerId);
        }
      }
    });
  }
</script>

<div class="flex flex-col gap-4">
  <DragAndDrop {onFilesPick} />

  {#if queuedCount > 0}
    <div class="flex items-center justify-between pt-2">
      <div class="flex items-center gap-2">
        <h3 class="text-sm font-semibold text-base-content">
          Queued files
        </h3>
        <span
          class="rounded-full bg-base-300/70 px-2 py-0.5 font-mono text-xs font-medium tabular-nums text-base-content/80"
        >
          {queuedCount}
        </span>
      </div>
      {#if !hideSendButton && queuedCount > 1}
        <SendDropdown {peers} onSend={sendAllFiles}>
          <UpTray />
          <span>Send all</span>
        </SendDropdown>
      {/if}
    </div>

    <SendingFileList
      {peers}
      {onRemove}
      {onSend}
      {hideSendButton}
      bind:sendingFileSelections
    />
  {/if}
</div>
