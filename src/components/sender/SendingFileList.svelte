<script lang="ts">
  import {
    FileStatus,
    type PeerMetaData,
    type SendingFileSelection,
  } from "../../type";
  import SenderFileCard from "./SenderFileCard.svelte";
  import Trash from "../icons/Trash.svelte";
  import UpTray from "../icons/UpTray.svelte";
  import SendDropdown from "./SendDropdown.svelte";
  import EncryptModal from "./EncryptModal.svelte";

  type Props = {
    peers: {
      [peerId: string]: {
        isOnline: boolean;
        dataChannel: RTCDataChannel;
        metadata: PeerMetaData;
        svgAvatar: string;
      };
    };
    sendingFileSelections: { [key: string]: SendingFileSelection };
    onRemove: (key: string) => void;
    onSend: (key: string, peerId: string) => void;
    onStop: (key: string) => void;
    onContinue: (key: string) => void;
  };

  const {
    peers,
    sendingFileSelections = $bindable(),
    onRemove,
    onSend,
    onStop,
    onContinue,
  }: Props = $props();

  $inspect(sendingFileSelections).with((type, sendingFileSelections) => {
    if (type === "update") {
      console.log("sendingFileSelections", sendingFileSelections);
    }
  });
</script>

<div class="grid gap-4">
  {#each Object.entries(sendingFileSelections) as [key, sendingFileSelection], index (key)}
    <SenderFileCard {sendingFileSelection} {peers}>
      <div class="col-span-4 flex items-center justify-between">
        <button onclick={() => onRemove(key)} class="btn btn-ghost btn-sm pl-0">
          <Trash /><span class="hidden lg:block">Remove</span>
        </button>
        <div class="flex flex-row items-center gap-2">
          <EncryptModal
            bind:sendingFileSelection={sendingFileSelections[key]}
          />
          {#if sendingFileSelections.stop}
            <button onclick={() => onContinue(key)} class="btn btn-secondary">
              Continue
            </button>
          {:else if Object.values(sendingFileSelections.sendingFiles || []).some((s) => s.status === FileStatus.Processing)}
            <button onclick={() => onStop(key)} class="btn btn-secondary">
              Stop
            </button>
          {:else}
            <SendDropdown
              {peers}
              onSend={(peerId: string) => {
                onSend(key, peerId);
              }}
            >
              <UpTray /> Send
            </SendDropdown>
          {/if}
        </div>
      </div>
    </SenderFileCard>
  {/each}
</div>
