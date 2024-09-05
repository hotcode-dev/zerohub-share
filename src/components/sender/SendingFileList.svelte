<script lang="ts">
  import {
    FileStatus,
    type PeerMetaData,
    type SendingFileSelection,
  } from "../../type";
  import SenderFileCard from "./SenderFileCard.svelte";
  import Lock from "../icons/Lock.svelte";
  import Trash from "../icons/Trash.svelte";
  import UpTray from "../icons/UpTray.svelte";
  import SendDropdown from "./SendDropdown.svelte";

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

  let {
    peers,
    sendingFileSelections,
    onRemove,
    onSend,
    onStop,
    onContinue,
  }: Props = $props();
</script>

<div class="grid gap-4">
  {#each Object.entries(sendingFileSelections) as [key, sendingFileSelection], index (key)}
    <SenderFileCard {sendingFileSelection} {peers}>
      <div class="col-span-4 flex justify-between items-center">
        <button onclick={() => onRemove(key)} class="btn btn-ghost btn-sm">
          <Trash /><span class="hidden lg:block">Remove</span>
        </button>
        <div class="flex flex-row gap-2 items-center">
          <div class="tooltip" data-tip={sendingFileSelection.isEncrypt ? "Encrypt" : "Not Encrypt"}>
            <Lock
              onChange={(show: boolean) => {
                sendingFileSelection.isEncrypt = show;
              }}
            />
          </div>
          {#if sendingFileSelections.stop}
            <button onclick={() => onContinue(key)} class="btn btn-secondary">
              Continue
            </button>
          {:else if Object.values(sendingFileSelections.sendingFiles || []).some((s) => s.status === FileStatus.Processing)}
            <button onclick={() => onStop(key)} class="btn btn-secondary">
              Stop
            </button>
          {:else}
            <SendDropdown {peers} onSend={(peerId: string) => {onSend(key, peerId)}}>
              <UpTray /> Send
            </SendDropdown>
          {/if}
        </div>
      </div>
    </SenderFileCard>
  {/each}
</div>
