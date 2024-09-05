<script lang="ts">
  import DragAndDrop from "./DragAndDrop.svelte";
  import EventEmitter from "eventemitter3";
  import {
    FileStatus,
    type PeerMetaData,
    type SendingFile,
    type SendingFileSelection,
  } from "../../type";
  import SendingFileList from "./SendingFileList.svelte";
  import {
    encryptAesGcm,
    encryptAesKeyWithRsaPublicKey,
    generateAesKey,
  } from "../../utils/crypto";
  import { validateFileMetadata } from "../../utils/validator";
  import {
    Message,
    MetaData,
    ReceiveEvent,
    receiveEventToJSON,
  } from "../../proto/message";
  import { addToastMessage } from "../../stores/toast";

  type Props = {
    peers: {
      [peerId: string]: {
        isOnline: boolean;
        dataChannel: RTCDataChannel;
        metadata: PeerMetaData;
        svgAvatar: string;
      };
    };
  };

  let { peers }: Props = $props();

  let sendingFileSelections: { [key: string]: SendingFileSelection } = $state(
    {}
  );

  export function onReceiveEvent(
    fileId: string,
    peerId: string,
    receiveEvent: ReceiveEvent
  ) {
    const sendingFile = sendingFileSelections[fileId].sendingFiles[peerId];
    if (sendingFile && sendingFile.event) {
      sendingFile.event.emit(receiveEventToJSON(receiveEvent));

      // trigger update
      sendingFileSelections[fileId].sendingFiles[peerId] = sendingFile;
      sendingFileSelections[fileId] = sendingFileSelections[fileId];
      sendingFileSelections = sendingFileSelections;
    }
  }

  async function onSend(fileId: string, peerId: string) {
    const sendingFileSelection = sendingFileSelections[fileId];
    const file = sendingFileSelection.file;
    const peer = peers[peerId];

    // initial aes key
    let aesKey;
    let aesEncrypted = new Uint8Array();
    if (sendingFileSelection.isEncrypt) {
      aesKey = await generateAesKey();
      if (!peer.metadata.rsaPub) {
        addToastMessage("rsa public key is not available");
        return;
      }
      aesEncrypted = await encryptAesKeyWithRsaPublicKey(
        peer.metadata.rsaPub,
        aesKey
      );
    }

    // initial file meta data
    const fileMetaData: MetaData = {
      name: file.name,
      size: file.size,
      type: file.type,
      isEncrypt: sendingFileSelection.isEncrypt,
      key: aesEncrypted,
    };
    const validateErr = validateFileMetadata(fileMetaData);
    if (validateErr) {
      addToastMessage(`${file.name} ${validateErr.message}`, "error");
    }

    const sendingFile: SendingFile = {
      metaData: fileMetaData,
      progress: 0,
      bitrate: 0,
      error: validateErr,
      startTime: 0,
      status: FileStatus.Pending,
      aesKey: aesKey,
      event: new EventEmitter(),
    };
    sendingFileSelection.sendingFiles[peerId] = sendingFile;

    // send file offset
    let offset = 0;

    // reset value
    sendingFileSelection.stop = false;

    sendingFile.event.on(
      receiveEventToJSON(ReceiveEvent.EVENT_RECEIVER_ACCEPT),
      async () => {
        sendingFileSelections[fileId].sendingFiles[peerId].status =
          FileStatus.Processing;
        sendingFileSelections[fileId].sendingFiles[peerId].startTime =
          Date.now();
        await sendNextChunk();
      }
    );

    sendingFile.event.on(
      receiveEventToJSON(ReceiveEvent.EVENT_RECEIVED_CHUNK),
      async () => {
        if (sendingFileSelection.stop) {
          return;
        }
        if (sendingFile.error || sendingFile.status != FileStatus.Processing) {
          sendingFileSelections[fileId].sendingFiles[peerId].progress = 0;
          sendingFileSelections[fileId].sendingFiles[peerId].status =
            FileStatus.Pending;
          sendingFileSelections[fileId].stop = false;
          return;
        }

        if (offset < sendingFile.metaData.size) {
          await sendNextChunk();
          return;
        }

        sendingFileSelections[fileId].sendingFiles[peerId].status =
          FileStatus.Success;
        addToastMessage(
          `File ${sendingFile.metaData.name} sent successfully`,
          "success"
        );
      }
    );

    sendingFile.event.on(
      receiveEventToJSON(ReceiveEvent.EVENT_VALIDATE_ERROR),
      () => {
        addToastMessage("Receiver validate error", "error");
        sendingFileSelections[fileId].sendingFiles[peerId].error = new Error(
          "Receiver validate error"
        );
        sendingFileSelections[fileId].sendingFiles[peerId].status =
          FileStatus.Pending;
      }
    );

    sendingFile.event.on(
      receiveEventToJSON(ReceiveEvent.EVENT_RECEIVER_REJECT),
      () => {
        addToastMessage("Receiver reject the file", "error");
        sendingFileSelections[fileId].sendingFiles[peerId].error = new Error(
          "Receiver reject the file"
        );
        sendingFileSelections[fileId].sendingFiles[peerId].status =
          FileStatus.Pending;
      }
    );

    async function sendBuffer(buffer: ArrayBuffer) {
      if (sendingFileSelection.isEncrypt) {
        const aesKey = sendingFile.aesKey;
        if (aesKey) {
          const encrypted = await encryptAesGcm(aesKey, buffer);
          peers[peerId].dataChannel.send(
            Message.encode({
              id: sendingFile.metaData.name,
              chunk: encrypted,
            }).finish()
          );
          return;
        }
      }

      peers[peerId].dataChannel.send(
        Message.encode({
          id: sendingFile.metaData.name,
          chunk: new Uint8Array(buffer),
        }).finish()
      );
    }

    async function sendNextChunk() {
      const slice = sendingFileSelection.file.slice(
        offset,
        offset + sendingFileSelection.chunkSize
      );
      const buffer = await slice.arrayBuffer();

      await sendBuffer(buffer);

      offset += buffer.byteLength;

      // calculate progress
      sendingFileSelections[fileId].sendingFiles[peerId].progress = Math.round(
        (offset / sendingFile.metaData.size) * 100
      );

      // calculate bitrate
      sendingFileSelections[fileId].sendingFiles[peerId].bitrate = Math.round(
        offset / ((Date.now() - sendingFile.startTime) / 1000)
      );
    }

    // send meta data
    peers[peerId].dataChannel.send(
      Message.encode({
        id: sendingFile.metaData.name,
        metaData: sendingFile.metaData,
      }).finish()
    );

    sendingFile.status = FileStatus.WaitingAccept;
  }

  async function sendAllFiles(peerId: string) {
    for (const fileId of Object.keys(sendingFileSelections)) {
      await onSend(fileId, peerId);
    }
  }

  async function onStop(fileId: string) {
    sendingFileSelections[fileId].stop = true;
  }

  async function onContinue(fileId: string) {
    sendingFileSelections[fileId].stop = false;
    for (const sendingFile of Object.values(
      sendingFileSelections[fileId].sendingFiles
    )) {
      sendingFile.event?.emit(
        receiveEventToJSON(ReceiveEvent.EVENT_RECEIVED_CHUNK)
      );
    }
  }

  function onRemove(fileId: string) {
    sendingFileSelections[fileId].stop = true;
    delete sendingFileSelections[fileId];
  }

  function onFilesPick(files: FileList) {
    Array.from(files).forEach(async (file) => {
      sendingFileSelections[file.name] = {
        file: file,
        stop: false,
        chunkSize: 16 * 1024, // 16MB
        isEncrypt: false,
        sendingFiles: {},
      };
    });
  }
</script>

<div class="flex flex-col gap-4">
  <DragAndDrop {onFilesPick} />
  {#if Object.keys(sendingFileSelections).length > 0}
    <SendingFileList
      {peers}
      {sendingFileSelections}
      {onRemove}
      {onSend}
      {onStop}
      {onContinue}
    />
    {#if Object.keys(sendingFileSelections).length > 1}
      <div class="dropdown dropdown-top dropdown-end self-end">
        <button tabindex="0" class="btn btn-primary">Send all files</button>
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <ul
          tabindex="0"
          class="dropdown-content menu bg-base-100 rounded-box z-[1] w-52 p-2 shadow"
        >
          {#each Object.entries(peers) as [peerId, peer]}
            {#if peer.isOnline}
              <li>
                <button onclick={() => sendAllFiles(peerId)}
                  >{peer.metadata.name}</button
                >
              </li>
            {/if}
          {/each}
        </ul>
      </div>
    {/if}
  {/if}
</div>
