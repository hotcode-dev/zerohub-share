<script lang="ts">
  import { addToastMessage } from "../../stores/toast";
  import { Message, MetaData, ReceiveEvent } from "../../proto/message";
  import ReceivingFileList from "./ReceivingFileList.svelte";
  import * as zip from "@zip.js/zip.js";
  import {
    FileStatus,
    type PeerMetaData,
    type ReceivingFile,
  } from "../../type";
  import {
    decryptAesGcm,
    decryptAesKeyWithRsaPrivateKey,
  } from "../../utils/crypto";

  type Props = {
    peerMetaData: PeerMetaData;
    dataChannel: RTCDataChannel;
    svgAvatar: string;
    rsa: CryptoKeyPair | undefined;
  };

  let { peerMetaData, dataChannel, svgAvatar, rsa }: Props = $props();

  let receivingFiles: { [key: string]: ReceivingFile } = $state({});
  let collapseCheckbox: HTMLInputElement;

  export async function onMetaData(id: string, metaData: MetaData) {
    let aesKey: CryptoKey | undefined;
    if (metaData.isEncrypt) {
      if (!rsa) {
        addToastMessage("RSA private key is not available");
        return;
      }
      aesKey = await decryptAesKeyWithRsaPrivateKey(
        rsa.privateKey,
        metaData.key
      );
    }

    receivingFiles[id] = {
      metaData: metaData,
      progress: 0,
      bitrate: 0,
      receivedSize: 0,
      receivedChunks: [],
      startTime: 0,
      status: FileStatus.WaitingAccept,
      aesKey: aesKey,
      isEncrypt: metaData.isEncrypt,
    };

    collapseCheckbox.checked = true;
  }

  export async function onChunkData(id: string, chunk: Uint8Array) {
    let arrayBuffer = chunk;

    dataChannel.send(
      Message.encode({
        id: id,
        receiveEvent: ReceiveEvent.EVENT_RECEIVED_CHUNK,
      }).finish()
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
      (receivingFiles[id].receivedSize / receivingFile.metaData.size) * 100
    );

    // calculate bitrate
    receivingFiles[id].bitrate = Math.round(
      receivingFiles[id].receivedSize /
        ((Date.now() - receivingFiles[id].startTime) / 1000)
    );

    if (receivingFiles[id].receivedSize >= receivingFile.metaData.size) {
      receivingFiles[id].status = FileStatus.Success;
      addToastMessage(
        `Received ${receivingFiles[id].metaData.name}`,
        "success"
      );
    }
  }

  function onRemove(key: string) {
    if (receivingFiles[key].status != FileStatus.Success) {
      dataChannel.send(
        Message.encode({
          id: key,
          receiveEvent: ReceiveEvent.EVENT_RECEIVER_REJECT,
        }).finish()
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

  function onAccept(key: string) {
    dataChannel.send(
      Message.encode({
        id: key,
        receiveEvent: ReceiveEvent.EVENT_RECEIVER_ACCEPT,
      }).finish()
    );

    receivingFiles[key].status = FileStatus.Processing;
    receivingFiles[key].startTime = Date.now();
  }

  function onDeny(key: string) {
    dataChannel.send(
      Message.encode({
        id: key,
        receiveEvent: ReceiveEvent.EVENT_RECEIVER_REJECT,
      }).finish()
    );
    delete receivingFiles[key];
    receivingFiles = receivingFiles; // do this to trigger update the map
  }

  async function downloadAllFiles() {
    const zipFileWriter = new zip.BlobWriter();
    const zipWriter = new zip.ZipWriter(zipFileWriter);

    let found = false;

    for (const key of Object.keys(receivingFiles)) {
      if (
        receivingFiles[key].status != FileStatus.Success ||
        receivingFiles[key].error
      ) {
        continue;
      }

      const receivedFile = receivingFiles[key];
      const blobFile = new Blob(receivedFile.receivedChunks, {
        type: receivedFile.metaData.type,
      });
      const name = receivedFile.metaData.name;

      const blobReader = new zip.BlobReader(blobFile);

      await zipWriter.add(name, blobReader);

      found = true;
    }

    await zipWriter.close();

    if (found) {
      const zipFileBlob = await zipFileWriter.getData();

      const url = URL.createObjectURL(zipFileBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "zero-share.zip";
      link.click();
      URL.revokeObjectURL(url);
      return;
    }

    addToastMessage("Not found files to download", "error");
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
    class="collapse-title text-xl font-medium flex flex-row justify-between items-center p-0"
  >
    <div class="flex flex-row gap-4 items-center">
      <img src={svgAvatar} class="w-8 h-8" alt="avatar" />
      <span
        >{peerMetaData.name}{#if peerMetaData.isHost}{" (Sender)"}{/if}</span
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
