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
    encryptAesWithPassword,
    generateAesKey,
  } from "../../utils/crypto";
  import {
    Message,
    MetaData,
    ReceiveEvent,
    receiveEventToJSON,
  } from "../../proto/message";
  import { addToastMessage } from "../../stores/toast";
  import SendDropdown from "./SendDropdown.svelte";
  import UpTray from "../icons/UpTray.svelte";

  type Props = {
    peers: {
      [peerId: string]: {
        isOnline: boolean;
        dataChannel: RTCDataChannel;
        metadata: PeerMetaData;
        svgAvatar: string;
      };
    };
    isDrop?: boolean;
    hideSendButton?: boolean;
  };

  const { peers, isDrop, hideSendButton }: Props = $props();

  let sendingFileSelections: { [key: string]: SendingFileSelection } = $state(
    {},
  );

  export function onReceiveEvent(
    fileId: string,
    peerId: string,
    receiveEvent: ReceiveEvent,
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

    // initial aes key
    let aesKey;
    let aesEncrypted: Uint8Array | undefined;
    if (sendingFileSelection.isEncrypt) {
      aesKey = await generateAesKey();
      aesEncrypted = await encryptAesWithPassword(
        aesKey,
        sendingFileSelection.password,
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

    const sendingFile: SendingFile = {
      metaData: fileMetaData,
      progress: 0,
      bitrate: 0,
      startTime: 0,
      status: FileStatus.Pending,
      aesKey: aesKey,
      event: new EventEmitter(),
    };
    sendingFileSelection.sendingFiles[peerId] = sendingFile;

    // send file offset
    let offset = 0;

    sendingFile.event.on(
      receiveEventToJSON(ReceiveEvent.EVENT_RECEIVER_ACCEPT),
      () => {
        sendingFileSelections[fileId].sendingFiles[peerId].status =
          FileStatus.Processing;
        sendingFileSelections[fileId].sendingFiles[peerId].startTime =
          Date.now();
        sendNextChunk();
      },
    );

    sendingFile.event.on(
      receiveEventToJSON(ReceiveEvent.EVENT_RECEIVED_CHUNK),
      async () => {
        // if there is error, stop sending
        if (sendingFile.error) {
          console.log("error", sendingFile.error);
          sendingFileSelections[fileId].sendingFiles[peerId].progress = 0;
          sendingFileSelections[fileId].sendingFiles[peerId].status =
            FileStatus.Pending;
          return;
        }

        if (offset < sendingFile.metaData.size) {
          sendingFile.status = FileStatus.Processing;
          await sendNextChunk();
          return;
        }

        sendingFileSelections[fileId].sendingFiles[peerId].status =
          FileStatus.Success;
        addToastMessage(
          `File ${sendingFile.metaData.name} sent successfully`,
          "success",
        );
      },
    );

    sendingFile.event.on(
      receiveEventToJSON(ReceiveEvent.EVENT_VALIDATE_ERROR),
      () => {
        addToastMessage("Receiver validate error", "error");
        sendingFileSelections[fileId].sendingFiles[peerId].error = new Error(
          "Receiver validate error",
        );
        sendingFileSelections[fileId].sendingFiles[peerId].status =
          FileStatus.Pending;
      },
    );

    sendingFile.event.on(
      receiveEventToJSON(ReceiveEvent.EVENT_RECEIVER_REJECT),
      () => {
        addToastMessage("Receiver reject the file", "error");
        sendingFileSelections[fileId].sendingFiles[peerId].error = new Error(
          "Receiver reject the file",
        );
        sendingFileSelections[fileId].sendingFiles[peerId].status =
          FileStatus.Pending;
      },
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
            }).finish(),
          );
          return;
        }
      }

      peers[peerId].dataChannel.send(
        Message.encode({
          id: sendingFile.metaData.name,
          chunk: new Uint8Array(buffer),
        }).finish(),
      );
    }

    async function sendNextChunk() {
      const slice = sendingFileSelection.file.slice(
        offset,
        offset + sendingFileSelection.chunkSize,
      );
      const buffer = await slice.arrayBuffer();

      await sendBuffer(buffer);

      offset += buffer.byteLength;

      // calculate progress
      sendingFileSelections[fileId].sendingFiles[peerId].progress = Math.round(
        (offset / sendingFile.metaData.size) * 100,
      );

      // calculate bitrate
      sendingFileSelections[fileId].sendingFiles[peerId].bitrate = Math.round(
        offset /
          ((Date.now() -
            sendingFileSelections[fileId].sendingFiles[peerId].startTime) /
            1000),
      );
    }

    // send meta data
    peers[peerId].dataChannel.send(
      Message.encode({
        id: sendingFile.metaData.name,
        metaData: sendingFile.metaData,
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
      sendingFileSelections[file.name] = {
        file: file,
        chunkSize: 16 * 1024, // 16MB
        isEncrypt: false,
        password: "",
        sendingFiles: {},
      };

      // if it's drop mode send file to all peers after pick
      if (isDrop && peers) {
        for (const peerId of Object.keys(peers)) {
          await onSend(file.name, peerId);
        }
      }
    });
  }
</script>

<div class="flex flex-col gap-4">
  <DragAndDrop {onFilesPick} />
  {#if Object.keys(sendingFileSelections).length > 0}
    <SendingFileList
      {peers}
      {onRemove}
      {onSend}
      {hideSendButton}
      bind:sendingFileSelections
    />
    {#if !hideSendButton}
      <div class="self-end">
        <SendDropdown {peers} onSend={sendAllFiles}>
          <UpTray /> Send all files
        </SendDropdown>
      </div>
    {/if}
  {/if}
</div>
