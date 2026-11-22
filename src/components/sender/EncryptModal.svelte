<script lang="ts">
  import type { SendingFileSelection } from "../../type";

  type Props = {
    sendingFileSelection: SendingFileSelection;
  };

  const { sendingFileSelection = $bindable() }: Props = $props();

  let isModalOpen: boolean = $state(false);
  let password: string = $state("");

  function toggleEncrypt() {
    if (sendingFileSelection.isEncrypt) {
      sendingFileSelection.isEncrypt = false;
      sendingFileSelection.password = "";
      return;
    }
    password = "";
    isModalOpen = true;
  }

  function unsaveClose() {
    sendingFileSelection.isEncrypt = false;
    sendingFileSelection.password = "";
    isModalOpen = false;
  }

  function submit(e: Event) {
    e.preventDefault();
    if (!password) {
      unsaveClose();
      return;
    }
    sendingFileSelection.isEncrypt = true;
    sendingFileSelection.password = password;
    isModalOpen = false;
  }
</script>

<button
  type="button"
  onclick={toggleEncrypt}
  aria-pressed={sendingFileSelection.isEncrypt}
  class="btn min-h-[44px] gap-1.5 rounded-xl border text-xs font-semibold {sendingFileSelection.isEncrypt
    ? 'border-warning/40 bg-warning/10 text-warning hover:bg-warning/20'
    : 'border-base-300 bg-base-100 text-base-content/80 hover:bg-base-200 hover:text-base-content'}"
>
  {#if sendingFileSelection.isEncrypt}
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      class="h-4 w-4"
      aria-hidden="true"
    >
      <path
        fill-rule="evenodd"
        d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z"
        clip-rule="evenodd"
      />
    </svg>
    <span>Encrypted</span>
  {:else}
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      class="h-4 w-4"
      aria-hidden="true"
    >
      <path
        fill-rule="evenodd"
        d="M14.5 1A4.5 4.5 0 0 0 10 5.5V9H3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-1.5V5.5a3 3 0 1 1 6 0v2.75a.75.75 0 0 0 1.5 0V5.5A4.5 4.5 0 0 0 14.5 1Z"
        clip-rule="evenodd"
      />
    </svg>
    <span>Encrypt</span>
  {/if}
</button>

{#if isModalOpen}
  <div class="modal modal-open modal-bottom sm:modal-middle" role="dialog" aria-modal="true" aria-labelledby="encrypt-modal-title">
    <div
      class="modal-box border border-base-300 bg-base-100 p-6 shadow-xl sm:max-w-sm sm:rounded-2xl"
    >
      <div class="flex items-center justify-between pb-4">
        <h3 id="encrypt-modal-title" class="text-lg font-bold tracking-tight text-base-content">
          Encrypt file
        </h3>
        <button
          type="button"
          aria-label="Close encryption modal"
          class="btn btn-ghost btn-circle min-h-[44px] min-w-[44px]"
          onclick={unsaveClose}
        >
          ✕
        </button>
      </div>

      <form onsubmit={submit} class="flex flex-col gap-4">
        <div class="flex flex-col gap-2">
          <label
            for="encrypt-password-input"
            class="text-sm font-medium text-base-content"
          >
            Transfer password
          </label>
          <input
            id="encrypt-password-input"
            type="password"
            class="input input-bordered min-h-[44px] w-full rounded-xl bg-base-100 text-base leading-normal focus:border-primary"
            placeholder="Enter a shared password"
            bind:value={password}
            required
          />
          <span class="text-sm leading-normal text-base-content/70">
            The receiver will need this password to unlock and decrypt the file.
          </span>
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
            Set password
          </button>
        </div>
      </form>
    </div>
    <div class="modal-backdrop">
      <button type="button" aria-label="Close encryption backdrop" onclick={unsaveClose}>close</button>
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
