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
  let collapseCheckbox: HTMLInputElement;
  let decryptModal: DecryptModal;
  // non state map to track receiving file part chunks
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

    collapseCheckbox.checked = true;
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
    }

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

    // calculate progress
    receivingFileStatsMap[fileId].progress = Math.round(
      (receivingFileStatsMap[fileId].receivedSize / receivingFile.fileMetadata.size) *
        100,
    );
    if (receivingFileStatsMap[fileId].progress >= receivingFileStatsMap[fileId].nextProgressUpdate) {
      // calculate bitrate
      receivingFileStatsMap[fileId].bitrate = Math.round(
        receivingFileStatsMap[fileId].receivedSize /
          ((Date.now() - receivingFileStatsMap[fileId].startTime) / 1000),
      );

      receivingFiles[fileId].progress = receivingFileStatsMap[fileId].progress;
      receivingFiles[fileId].bitrate = receivingFileStatsMap[fileId].bitrate;
      receivingFileStatsMap[fileId].nextProgressUpdate += PROGRESS_UPDATE_UI_STEP;
      if (receivingFileStatsMap[fileId].nextProgressUpdate > 100) {
        receivingFileStatsMap[fileId].nextProgressUpdate = 100;
      }
    }

    // check if file received completely
    if (
      receivingFileStatsMap[fileId].receivedSize >= receivingFile.fileMetadata.size
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
    receivingFiles = receivingFiles; // do this to trigger update the map
  }

  async function onDownload(fileId: string) {
    const receivedFile = receivingFiles[fileId];

    const combinedParts = Object.values(receivedFile.fileParts)
      .sort((a, b) => {
        return a.filePartMetaData.partNumber - b.filePartMetaData.partNumber;
      })
      .map((part) => {
        return receivingFilePartChunkMap[fileId][
          part.channelLabel
        ].receivedChunks;
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

    // if not encrypted, accept directly
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
    receivingFiles = receivingFiles; // do this to trigger update the map
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
      // send on the first data channel
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

<div class="collapse-arrow bg-base-200 collapse">
  <input
    type="checkbox"
    checked={peerMetaData.isHost}
    bind:this={collapseCheckbox}
    disabled={peerMetaData.isHost}
  />
  <div
    class="collapse-title flex flex-row items-center justify-between p-0 text-xl font-medium"
  >
    <div class="flex flex-row items-center gap-4">
      <img src={svgAvatar} class="h-8 w-8" alt="avatar" />
      <span
        >{peerMetaData.name}{#if peerMetaData.isHost}{" (Uploader)"}{/if}</span
      >
    </div>
  </div>
  <div class="collapse-content p-1">
    <div class="flex flex-col gap-4">
      {#if Object.keys(receivingFiles).length > 0}
        <ReceivingFileList
          {receivingFiles}
          {onRemove}
          {onDownload}
          {onAccept}
          {onDeny}
        />
        {#if Object.keys(receivingFiles).length > 1}
          <button class="btn btn-primary mt-2" onclick={downloadAllFiles}
            >Download all files (zip)</button
          >
        {/if}
      {:else}
        <p class="mt-4">Connected, Waiting for files...</p>
      {/if}
    </div>
  </div>
</div>

<DecryptModal bind:this={decryptModal} />
