<script lang="ts">
  import type { PeerMetaData } from "../../type";

  type Props = {
    children: () => any;
    peers: {
      [peerId: string]: {
        isOnline: boolean;
        dataChannels: Record<string, RTCDataChannel>;
        metadata: PeerMetaData;
        svgAvatar: string;
      };
    };
    onSend: (peerId: string) => void;
  };

  const { children, peers, onSend }: Props = $props();

  let onlineEntries = $derived(
    Object.entries(peers).filter(([, p]) => p.isOnline),
  );
</script>

<div class="dropdown dropdown-end dropdown-top">
  <button
    type="button"
    tabindex="0"
    class="btn btn-primary min-h-[44px] gap-2 rounded-xl px-4 text-sm font-semibold"
    disabled={onlineEntries.length === 0}
    title={onlineEntries.length === 0
      ? "Connect a peer to send files"
      : "Choose a peer to send to"}
  >
    {@render children?.()}
  </button>
  {#if onlineEntries.length > 0}
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <ul
      tabindex="0"
      class="menu dropdown-content z-20 mb-2 w-56 rounded-xl border border-base-300 bg-base-100 p-1.5 shadow-lg"
    >
      <li class="menu-title px-2.5 py-1 text-[11px] uppercase tracking-wider">
        Send to peer
      </li>
      {#each onlineEntries as [peerId, peer]}
        <li>
          <button
            type="button"
            onclick={() => onSend(peerId)}
            class="flex min-h-[44px] flex-row items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium text-base-content hover:bg-base-200"
          >
            <img
              src={peer.svgAvatar}
              width="28"
              height="28"
              class="h-7 w-7 rounded-full border border-base-300 bg-base-200"
              alt=""
              aria-hidden="true"
            />
            <span class="truncate">{peer.metadata.name}</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>
