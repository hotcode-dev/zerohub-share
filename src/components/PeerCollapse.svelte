<script lang="ts">
  import type { PeerMetaData } from "../type";

  type Props = {
    children: () => any;
    peerMetaData: PeerMetaData;
    svgAvatar: string;
  };

  let { children, peerMetaData, svgAvatar }: Props = $props();

  let collapseCheckbox: HTMLInputElement;

  export async function setCollapse(isCollapse: boolean) {
    collapseCheckbox.checked = isCollapse;
  }
</script>

<div class="collapse collapse-arrow bg-base-200">
  <input
    type="checkbox"
    checked={false}
    bind:this={collapseCheckbox}
  />
  <div class="collapse-title text-xl font-medium flex flex-row justify-between items-center">
    <div class="flex flex-row gap-4 items-center">
      <img src={svgAvatar} class="w-8 h-8" alt="avatar" />
      <span>{peerMetaData.name}</span>
    </div>
  </div>
  <div class="collapse-content">
    {@render children?.()}
  </div>
</div>
