<script lang="ts">
  import { addToastMessage } from "../../stores/toast";
  import { Message, MetaData, ReceiveEvent } from "../../proto/message";
  import ReceivingFileList from "./ReceivingFileList.svelte";
  import {
    FileStatus,
    type PeerMetaData,
    type ReceivingFile,
  } from "../../type";
  import { decryptAesGcm, decryptAesWithPassword } from "../../utils/crypto";
  import DecryptModal from "./DecryptModal.svelte";

  type Props = {
    peerMetaData: PeerMetaData;
    dataChannel: RTCDataChannel;
    svgAvatar: string;
  };

  let { peerMetaData, dataChannel, svgAvatar }: Props = $props();

  let receivingFiles: { [key: string]: ReceivingFile } = $state({});
  let collapseCheckbox: HTMLInputElement;
  let decryptModal: DecryptModal;

  export async function onMetaData(id: string, metaData: MetaData) {
    receivingFiles[id] = {
      metaData: metaData,
      progress: 0,
      bitrate: 0,
      receivedSize: 0,
      receivedChunks: [],
      startTime: 0,
      status: FileStatus.WaitingAccept,
      isEncrypt: metaData.isEncrypt,
      encryptedAesKey: metaData.key,
    };

    collapseCheckbox.checked = true;
  }

  export async function onChunkData(id: string, chunk: Uint8Array) {
    let arrayBuffer = chunk;

    dataChannel.send(
      Message.encode({
        id: id,
        receiveEvent: ReceiveEvent.EVENT_RECEIVED_CHUNK,
      }).finish(),
    );

    const receivingFile = receivingFiles[id];

    if (receivingFile.isEncrypt && receivingFile.aesKey) {
      arrayBuffer = await decryptAesGcm(receivingFile.aesKey, arrayBuffer);
    }
    const receivingSize = arrayBuffer.byteLength;

    receivingFiles[id].receivedChunks.push(arrayBuffer);
    receivingFiles[id].receivedSize += receivingSize;

    // calculate progress
    receivingFiles[id].progress = Math.round(
      (receivingFiles[id].receivedSize / receivingFile.metaData.size) * 100,
    );

    // calculate bitrate
    receivingFiles[id].bitrate = Math.round(
      receivingFiles[id].receivedSize /
        ((Date.now() - receivingFiles[id].startTime) / 1000),
    );

    if (receivingFiles[id].receivedSize >= receivingFile.metaData.size) {
      receivingFiles[id].status = FileStatus.Success;
      addToastMessage(
        `Received ${receivingFiles[id].metaData.name}`,
        "success",
      );
    }
  }

  function onRemove(key: string) {
    if (receivingFiles[key].status != FileStatus.Success) {
      dataChannel.send(
        Message.encode({
          id: key,
          receiveEvent: ReceiveEvent.EVENT_RECEIVER_REJECT,
        }).finish(),
      );
    }
    delete receivingFiles[key];
    receivingFiles = receivingFiles; // do this to trigger update the map
  }

  async function onDownload(key: string) {
    const receivedFile = receivingFiles[key];
    const blobFile = new Blob(receivedFile.receivedChunks, {
      type: receivedFile.metaData.type,
    });
    const url = URL.createObjectURL(blobFile);
    const link = document.createElement("a");
    link.href = url;
    link.download = receivedFile.metaData.name;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function onAccept(key: string) {
    const receivedFile = receivingFiles[key];

    if (!receivedFile) {
      console.error(`file key ${key} not found`);
      return;
    }

    // if not encrypted, accept directly
    if (!receivedFile.isEncrypt) {
      receivingFiles[key].status = FileStatus.Processing;
      receivingFiles[key].startTime = Date.now();

      dataChannel.send(
        Message.encode({
          id: key,
          receiveEvent: ReceiveEvent.EVENT_RECEIVER_ACCEPT,
        }).finish(),
      );
      return;
    }

    if (!receivedFile.encryptedAesKey) {
      console.error(`file key ${key} missing encryptedAesKey`);
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

      receivingFiles[key].aesKey = aesKey;
      receivingFiles[key].status = FileStatus.Processing;
      receivingFiles[key].startTime = Date.now();

      dataChannel.send(
        Message.encode({
          id: key,
          receiveEvent: ReceiveEvent.EVENT_RECEIVER_ACCEPT,
        }).finish(),
      );
    } catch (error) {
      console.error("decrypt aes key error", error);
      addToastMessage("Unlock error: wrong password", "error");
    }
  }

  function onDeny(key: string) {
    dataChannel.send(
      Message.encode({
        id: key,
        receiveEvent: ReceiveEvent.EVENT_RECEIVER_REJECT,
      }).finish(),
    );
    delete receivingFiles[key];
    receivingFiles = receivingFiles; // do this to trigger update the map
  }

  async function downloadAllFiles() {
    for (const key of Object.keys(receivingFiles)) {
      if (
        receivingFiles[key].status != FileStatus.Success ||
        receivingFiles[key].error
      ) {
        continue;
      }
      onDownload(key);
    }
  }
</script>

<div class="collapse collapse-arrow bg-base-200">
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
