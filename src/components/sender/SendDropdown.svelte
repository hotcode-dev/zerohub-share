<script lang="ts">
  import type { PeerMetaData } from "../../type";

  type Props = {
    children: () => any;
    peers: {
      [peerId: string]: {
        isOnline: boolean;
        dataChannel: RTCDataChannel;
        metadata: PeerMetaData;
        svgAvatar: string;
      };
    };
    onSend: (peerId: string) => void;
  };

  const { children, peers, onSend }: Props = $props();
</script>

<div class="dropdown dropdown-end dropdown-top">
  <button
    tabindex="0"
    class="btn btn-primary"
    disabled={Object.values(peers).filter((p) => p.isOnline).length == 0}
  >
    {@render children?.()}
  </button>
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <ul
    tabindex="0"
    class="menu dropdown-content z-[1] w-52 rounded-box bg-base-200 p-2 shadow"
  >
    {#each Object.entries(peers) as [peerId, peer]}
      {#if peer.isOnline}
        <li>
          <button
            onclick={() => onSend(peerId)}
            class="flex flex-row items-center gap-4"
          >
            <img src={peer.svgAvatar} class="h-8 w-8" alt="avatar" />
            <span>{peer.metadata.name}</span>
          </button>
        </li>
      {/if}
    {/each}
  </ul>
</div>
