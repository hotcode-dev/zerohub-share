<script lang="ts">
  import { addToastMessage } from "../../stores/toast";
  import {
    FileEvent,
    FileMetadata,
    Message,
    FilePartMetaData,
    FilePartEvent,
  } from "../../proto/message";
  import ReceivingFileList from "./ReceivingFileList.svelte";
  import {
    FileStatus,
    type PeerMetaData,
    type ReceivingFile,
    type ReceivingFilePartChunks,
    type ReceivingFileStats,
  } from "../../type";
  import { decryptAesGcm, decryptAesWithPassword } from "../../utils/crypto";
  import DecryptModal from "./DecryptModal.svelte";
  import { PROGRESS_UPDATE_UI_STEP } from "../../constants";

  type Props = {
    peerMetaData: PeerMetaData;
    svgAvatar: string;
    dataChannels: Record<string, RTCDataChannel>;
  };

  let { peerMetaData, svgAvatar, dataChannels }: Props = $props();

  let receivingFiles: { [key: string]: ReceivingFile } = $state({});
  let isExpanded = $state(false);
  let decryptModal: DecryptModal;

  $effect(() => {
    if (peerMetaData.isHost) {
      isExpanded = true;
    }
  });

  let incomingCount = $derived(Object.keys(receivingFiles).length);
  let channelCount = $derived(Object.keys(dataChannels).length);

  const receivingFilePartChunkMap: {
    [fileId: string]: { [channelLabel: string]: ReceivingFilePartChunks };
  } = {};
  const receivingFileStatsMap: {
    [fileId: string]: ReceivingFileStats;
  } = {};

  export async function onFileMetaData(
    fileId: string,
    fileMetadata: FileMetadata,
  ) {
    receivingFiles[fileId] = {
      fileMetadata: fileMetadata,
      status: FileStatus.WaitingAccept,
      isEncrypt: fileMetadata.isEncrypt,
      encryptedAesKey: fileMetadata.key,
      progress: 0,
      bitrate: 0,
      fileParts: {},
    };

    receivingFileStatsMap[fileId] = {
      receivedSize: 0,
      progress: 0,
      bitrate: 0,
      startTime: Date.now(),
      nextProgressUpdate: 0,
    };

    isExpanded = true;
  }

  export async function onFilePartMetaData(
    fileId: string,
    channelLabel: string,
    filePartMetaData: FilePartMetaData,
  ) {
    if (!receivingFiles[fileId]) {
      console.error(
        `Receiving file id ${fileId} not found for file part metadata`,
      );
      return;
    }

    if (!receivingFilePartChunkMap[fileId]) {
      receivingFilePartChunkMap[fileId] = {};
    }
    receivingFilePartChunkMap[fileId][channelLabel] = {
      receivedChunks: [],
    };

    receivingFiles[fileId].fileParts[channelLabel] = {
      filePartMetaData,
      channelLabel,
    };

    sendFilePartEvent(
      fileId,
      FilePartEvent.EVENT_RECEIVED_FILE_PART_METADATA,
      channelLabel,
    );
  }

  export async function onChunkData(
    fileId: string,
    channelLabel: string,
    chunk: Uint8Array,
  ) {
    let arrayBuffer = chunk;

    sendFilePartEvent(fileId, FilePartEvent.EVENT_RECEIVED_CHUNK, channelLabel);

    const receivingFile = receivingFiles[fileId];

    if (receivingFile.isEncrypt && receivingFile.aesKey) {
      arrayBuffer = await decryptAesGcm(receivingFile.aesKey, arrayBuffer);
    }
    const receivingSize = arrayBuffer.byteLength;

    receivingFilePartChunkMap[fileId][channelLabel].receivedChunks.push(
      arrayBuffer,
    );
    receivingFileStatsMap[fileId].receivedSize += receivingSize;

    receivingFileStatsMap[fileId].progress = Math.round(
      (receivingFileStatsMap[fileId].receivedSize /
        receivingFile.fileMetadata.size) *
        100,
    );
    if (
      receivingFileStatsMap[fileId].progress >=
      receivingFileStatsMap[fileId].nextProgressUpdate
    ) {
      receivingFileStatsMap[fileId].bitrate = Math.round(
        receivingFileStatsMap[fileId].receivedSize /
          ((Date.now() - receivingFileStatsMap[fileId].startTime) / 1000),
      );

      receivingFiles[fileId].progress = receivingFileStatsMap[fileId].progress;
      receivingFiles[fileId].bitrate = receivingFileStatsMap[fileId].bitrate;
      receivingFileStatsMap[fileId].nextProgressUpdate +=
        PROGRESS_UPDATE_UI_STEP;
      if (receivingFileStatsMap[fileId].nextProgressUpdate > 100) {
        receivingFileStatsMap[fileId].nextProgressUpdate = 100;
      }
    }

    if (
      receivingFileStatsMap[fileId].receivedSize >=
      receivingFile.fileMetadata.size
    ) {
      receivingFiles[fileId].status = FileStatus.Success;
      addToastMessage(
        `Received ${receivingFiles[fileId].fileMetadata.name}`,
        "success",
      );
    }
  }

  function onRemove(fileId: string) {
    if (receivingFiles[fileId].status != FileStatus.Success) {
      sendFileEvent(fileId, FileEvent.EVENT_RECEIVER_REJECT);
    }
    delete receivingFiles[fileId];
    receivingFiles = receivingFiles;
  }

  async function onDownload(fileId: string) {
    const receivedFile = receivingFiles[fileId];

    const combinedParts = Object.values(receivedFile.fileParts)
      .sort((a, b) => {
        return a.filePartMetaData.partNumber - b.filePartMetaData.partNumber;
      })
      .map((part) => {
        return receivingFilePartChunkMap[fileId][part.channelLabel]
          .receivedChunks;
      })
      .flat();

    const blobFile = new Blob(combinedParts as BlobPart[], {
      type: receivedFile.fileMetadata.type,
    });
    const url = URL.createObjectURL(blobFile);
    const link = document.createElement("a");
    link.href = url;
    link.download = receivedFile.fileMetadata.name;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function onAccept(fileId: string) {
    const receivedFile = receivingFiles[fileId];

    if (!receivedFile) {
      console.error(`file key ${fileId} not found`);
      return;
    }

    if (!receivedFile.isEncrypt) {
      receivingFiles[fileId].status = FileStatus.Processing;
      sendFileEvent(fileId, FileEvent.EVENT_RECEIVER_ACCEPT);
      return;
    }

    if (!receivedFile.encryptedAesKey) {
      console.error(`file key ${fileId} missing encryptedAesKey`);
      return;
    }

    const password = await decryptModal.openUnlock();
    if (password === null) {
      return;
    }

    try {
      const aesKey = await decryptAesWithPassword(
        receivedFile.encryptedAesKey,
        password,
      );

      receivingFiles[fileId].aesKey = aesKey;
      receivingFiles[fileId].status = FileStatus.Processing;

      sendFileEvent(fileId, FileEvent.EVENT_RECEIVER_ACCEPT);
    } catch (error) {
      console.error("decrypt aes key error", error);
      addToastMessage("Unlock error: wrong password", "error");
    }
  }

  function onDeny(fileId: string) {
    sendFileEvent(fileId, FileEvent.EVENT_RECEIVER_REJECT);
    delete receivingFiles[fileId];
    receivingFiles = receivingFiles;
  }

  async function downloadAllFiles() {
    for (const fileId of Object.keys(receivingFiles)) {
      if (
        receivingFiles[fileId].status != FileStatus.Success ||
        receivingFiles[fileId].error
      ) {
        continue;
      }
      onDownload(fileId);
    }
  }

  function sendFileEvent(
    fileId: string,
    fileEvent: FileEvent,
    channelLabel?: string,
  ) {
    if (!channelLabel) {
      channelLabel = Object.keys(dataChannels)[0];
    }
    dataChannels[channelLabel].send(
      Message.encode({
        id: fileId,
        fileEvent,
      }).finish(),
    );
  }

  function sendFilePartEvent(
    fileId: string,
    filePartEvent: FilePartEvent,
    channelLabel: string,
  ) {
    dataChannels[channelLabel].send(
      Message.encode({
        id: fileId,
        filePartEvent,
      }).finish(),
    );
  }
</script>

<div class="overflow-hidden rounded-xl border border-base-300 bg-base-200/40">
  <button
    type="button"
    aria-expanded={isExpanded}
    disabled={peerMetaData.isHost}
    onclick={() => {
      if (!peerMetaData.isHost) isExpanded = !isExpanded;
    }}
    class="flex min-h-[56px] w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left hover:bg-base-200/80 disabled:cursor-default disabled:hover:bg-transparent"
  >
    <div class="flex min-w-0 items-center gap-3">
      <div class="relative shrink-0">
        <img
          src={svgAvatar}
          width="36"
          height="36"
          class="h-9 w-9 rounded-full border border-base-300 bg-base-100"
          alt=""
          aria-hidden="true"
        />
        <span
          class="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-base-100 bg-success"
          aria-hidden="true"
        ></span>
      </div>
      <div class="min-w-0">
        <p class="truncate text-sm font-semibold text-base-content">
          {peerMetaData.name}{#if peerMetaData.isHost}
            <span class="ml-1.5 text-xs font-normal text-base-content/60">
              (Uploader)
            </span>
          {/if}
        </p>
        <p class="font-mono text-[11px] tabular-nums text-base-content/60">
          {channelCount}
          {channelCount === 1 ? "channel" : "channels"} ready
        </p>
      </div>
    </div>

    <div class="flex shrink-0 items-center gap-2">
      {#if incomingCount > 0}
        <span
          class="rounded-full bg-primary px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-primary-content"
        >
          {incomingCount}
        </span>
      {/if}
      {#if !peerMetaData.isHost}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          class="zh-chevron h-4 w-4 text-base-content/60 {isExpanded
            ? 'rotate-180'
            : ''}"
          aria-hidden="true"
        >
          <path
            fill-rule="evenodd"
            d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
            clip-rule="evenodd"
          />
        </svg>
      {/if}
    </div>
  </button>

  {#if isExpanded}
    <div class="border-t border-base-300 bg-base-100/70 p-3">
      {#if incomingCount > 0}
        <div class="flex flex-col gap-3">
          <ReceivingFileList
            {receivingFiles}
            {onRemove}
            {onDownload}
            {onAccept}
            {onDeny}
          />
          {#if incomingCount > 1}
            <button
              type="button"
              class="btn btn-primary min-h-[44px] w-full rounded-xl text-sm font-semibold"
              onclick={downloadAllFiles}
            >
              Download all files
            </button>
          {/if}
        </div>
      {:else}
        <p class="py-2 text-center text-xs text-base-content/65">
          Connected — waiting for incoming files…
        </p>
      {/if}
    </div>
  {/if}
</div>

<DecryptModal bind:this={decryptModal} />
