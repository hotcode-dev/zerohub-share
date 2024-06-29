<script lang="ts">
  import type { Options, PeerMetaData } from "../type";
  import { Message } from "../proto/message";
  import Receiver from "./receiver/Receiver.svelte";
  import Sender from "./sender/Sender.svelte";

  export let options: Options;
  export let dataChannel: RTCDataChannel;
  export let peerMetaData: PeerMetaData;
  export let rsa: CryptoKeyPair | undefined;
  export let svgAvatar: string;

  let receiver: Receiver;
  let sender: Sender;
  let sendMode = true;
  let showNewFile = false;
  let collapseCheckbox: HTMLInputElement;

  dataChannel.onmessage = (event) => {
    const message = Message.decode(new Uint8Array(event.data));

    if (message.metaData !== undefined) {
      receiver.onMetaData(message.id, message.metaData);
      // check if collapse open no need to set show new file
      if (!collapseCheckbox.checked) {
        showNewFile = true;
      }
      // set to receive tab
      sendMode = false;
    } else if (message.chunk !== undefined) {
      receiver.onChunkData(message.id, message.chunk);
    } else if (message.receiveEvent !== undefined) {
      sender.onReceiveEvent(message.id, message.receiveEvent);
    }
  };

  $: if (showNewFile) sendMode = false;
</script>

<div class="collapse collapse-arrow bg-base-200">
  <input
    type="checkbox"
    checked={false}
    bind:this={collapseCheckbox}
    on:click={() => {
      showNewFile = false;
    }}
  />
  <div class="collapse-title text-xl font-medium indicator">
    <span
      class="indicator-item badge badge-accent animate-bounce block"
      class:hidden={!showNewFile}>New files</span
    >
    <div class="flex flex-row justify-between items-center">
      <div class="flex flex-row gap-4 items-center">
        <img src={svgAvatar} class="w-8 h-8" alt="avatar" />
        <span>{peerMetaData.name}</span>
      </div>
    </div>
  </div>
  <div class="collapse-content">
    <div class="flex w-full mb-4 mt-2">
      <button
        class="btn {sendMode
          ? 'btn-primary'
          : 'btn-ghost'} flex-grow border-black border-dotted"
        on:click={() => {
          sendMode = true;
        }}
      >
        <span class="btm-nav-label">Send</span>
      </button>
      <div class="flex-grow">
        <button
          class="btn {sendMode
            ? 'btn-ghost'
            : 'btn-primary'} w-full border-black border-dotted"
          on:click={() => {
            sendMode = false;
          }}
        >
          <span class="btm-nav-label">Receive</span>
        </button>
      </div>
    </div>
    <div hidden={!sendMode}>
      <Sender
        bind:this={sender}
        {dataChannel}
        rsaPub={peerMetaData.rsaPub}
        isEncrypt={options.isEncrypt}
        chunkSize={options.chunkSize}
      />
    </div>
    <div hidden={sendMode}>
      <Receiver
        bind:this={receiver}
        {dataChannel}
        isEncrypt={options.isEncrypt}
        {rsa}
      />
    </div>
  </div>
</div>
