<script lang="ts">
  type Props = {
    children: () => any;
    title: string;
    isOpen: boolean;
  };

  let { children, title, isOpen = false }: Props = $props();
</script>

<div
  tabindex="-1"
  class="collapse border border-base-200 {isOpen
    ? 'collapse-open bg-base-100'
    : 'collapse-close'}"
>
  <div
    class="collapse-title text-xl {isOpen
      ? 'font-bold'
      : 'bg-base-300 font-light'}"
  >
    {title}
  </div>
  <div class="collapse-content">
    {#if isOpen}
      {@render children?.()}
    {/if}
  </div>
</div>
