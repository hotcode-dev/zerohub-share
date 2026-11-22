<script lang="ts">
  import { type PeerMetaData, type SendingFileSelection } from "../../type";
  import SenderFileCard from "./SenderFileCard.svelte";
  import Trash from "../icons/Trash.svelte";
  import UpTray from "../icons/UpTray.svelte";
  import SendDropdown from "./SendDropdown.svelte";
  import EncryptModal from "./EncryptModal.svelte";

  type Props = {
    peers: {
      [peerId: string]: {
        isOnline: boolean;
        dataChannels: Record<string, RTCDataChannel>;
        metadata: PeerMetaData;
        svgAvatar: string;
      };
    };
    sendingFileSelections: { [key: string]: SendingFileSelection };
    onRemove: (key: string) => void;
    onSend: (key: string, peerId: string) => void;
    hideSendButton?: boolean;
  };

  const {
    peers,
    sendingFileSelections = $bindable(),
    onRemove,
    onSend,
    hideSendButton,
  }: Props = $props();
</script>

<div class="flex flex-col gap-3">
  {#each Object.entries(sendingFileSelections) as [key, sendingFileSelection] (key)}
    <SenderFileCard {sendingFileSelection} {peers}>
      <div
        class="flex flex-wrap items-center justify-between gap-2 border-t border-base-300 pt-3"
      >
        <button
          type="button"
          onclick={() => onRemove(key)}
          aria-label={`Remove ${sendingFileSelection.file.name}`}
          class="btn btn-ghost min-h-[44px] gap-1.5 rounded-xl px-3 text-xs font-medium text-base-content/70 hover:bg-error/10 hover:text-error"
        >
          <Trash />
          <span>Remove</span>
        </button>

        <div class="flex items-center gap-2">
          <EncryptModal
            bind:sendingFileSelection={sendingFileSelections[key]}
          />
          {#if !hideSendButton}
            <SendDropdown
              {peers}
              onSend={(peerId: string) => {
                onSend(key, peerId);
              }}
            >
              <UpTray />
              <span>Send</span>
            </SendDropdown>
          {/if}
        </div>
      </div>
    </SenderFileCard>
  {/each}
</div>
