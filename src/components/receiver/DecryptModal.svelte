<script lang="ts">
  import EventEmitter from "eventemitter3";

  type Props = {};

  const {}: Props = $props();

  let isModalOpen: boolean = $state(false);
  let password: string = $state("");
  const eventEmitter = new EventEmitter<{
    close: (submitPassword: string | null) => void;
  }>();

  export async function openUnlock(): Promise<string | null> {
    password = "";
    isModalOpen = true;
    return new Promise((resolve) => {
      eventEmitter.once("close", (submitPassword: string | null) => {
        resolve(submitPassword);
        isModalOpen = false;
      });
    });
  }

  function unsaveClose() {
    eventEmitter.emit("close", null);
  }

  function submit(e: Event) {
    e.preventDefault();
    eventEmitter.emit("close", password);
  }
</script>

{#if isModalOpen}
  <div class="modal modal-open modal-bottom sm:modal-middle" role="dialog" aria-modal="true" aria-labelledby="decrypt-modal-title">
    <div
      class="modal-box border border-base-300 bg-base-100 p-6 shadow-xl sm:max-w-sm sm:rounded-2xl"
    >
      <div class="flex items-center justify-between pb-4">
        <h3 id="decrypt-modal-title" class="text-lg font-bold tracking-tight text-base-content">
          Unlock encrypted file
        </h3>
        <button
          type="button"
          aria-label="Close unlock modal"
          class="btn btn-ghost btn-circle min-h-[44px] min-w-[44px]"
          onclick={unsaveClose}
        >
          ✕
        </button>
      </div>

      <form onsubmit={submit} class="flex flex-col gap-4">
        <div class="flex flex-col gap-2">
          <label
            for="decrypt-password-input"
            class="text-sm font-medium text-base-content"
          >
            Transfer password
          </label>
          <input
            id="decrypt-password-input"
            type="password"
            class="input input-bordered min-h-[44px] w-full rounded-xl bg-base-100 text-base leading-normal focus:border-primary"
            placeholder="Enter password from sender"
            bind:value={password}
            required
          />
        </div>

        <div class="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            class="btn btn-ghost min-h-[44px] rounded-xl"
            onclick={unsaveClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            class="btn btn-primary min-h-[44px] rounded-xl px-5"
          >
            Unlock
          </button>
        </div>
      </form>
    </div>
    <div class="modal-backdrop">
      <button type="button" aria-label="Close unlock backdrop" onclick={unsaveClose}>close</button>
    </div>
  </div>
{/if}

<svelte:window
  onkeydown={(e) => {
    if (e.key === "Escape" && isModalOpen) {
      unsaveClose();
    }
  }}
/>
