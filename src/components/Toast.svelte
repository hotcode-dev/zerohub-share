<script lang="ts">
  import { fade } from "svelte/transition";
  import { toastAtom, type ToastMessage } from "../stores/toast";

  interface Toast extends ToastMessage {
    visible: boolean;
  }

  let toasts: Toast[] = $state([]);

  toastAtom.subscribe((toastMessage) => {
    if (toastMessage) {
      const toast = { ...toastMessage, visible: true };
      toasts = [toast, ...toasts];

      setTimeout(() => {
        toast.visible = false;
        toasts = toasts.filter((t) => t.visible === false);
      }, toastMessage.duration);
    }
  });
</script>

<div class="fixed bottom-4 right-4 space-y-2">
  {#each toasts as toast}
    <div
      class="alert alert-{toast.status}"
      in:fade|global={{ duration: 300 }}
      out:fade|global={{ duration: 300 }}
      style={toast.visible ? "" : "display: none;"}
    >
      <div>
        <span>{toast.message}</span>
      </div>
    </div>
  {/each}
</div>
