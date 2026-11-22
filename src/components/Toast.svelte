<script lang="ts">
  import { cubicOut } from "svelte/easing";
  import { fade, fly } from "svelte/transition";
  import { toastAtom, type ToastMessage } from "../stores/toast";

  let toasts: ToastMessage[] = $state([]);

  toastAtom.subscribe((toastMessage) => {
    if (toastMessage) {
      const toast = { ...toastMessage };
      toasts = [toast, ...toasts];

      setTimeout(() => {
        toasts = toasts.filter((t) => t.id !== toast.id);
      }, toastMessage.duration);
    }
  });
</script>

<div
  class="pointer-events-none fixed bottom-4 right-4 z-50 flex max-w-sm flex-col gap-2"
  aria-live="polite"
  aria-atomic="true"
>
  {#each toasts as toast (toast.id)}
    <div
      class="alert pointer-events-auto flex items-center gap-2.5 rounded-xl border border-base-300 px-4 py-3 text-sm font-medium shadow-lg alert-{toast.status}"
      in:fly|global={{ y: 12, duration: 220, easing: cubicOut }}
      out:fade|global={{ duration: 150 }}
    >
      <span>{toast.message}</span>
    </div>
  {/each}
</div>
