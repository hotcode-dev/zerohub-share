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

  function submit() {
    eventEmitter.emit("close", password);
  }
</script>

<input type="checkbox" class="modal-toggle" bind:checked={isModalOpen} />
<dialog id="decryptmodal" class="modal modal-bottom sm:modal-middle">
  <div class="modal-box">
    <form method="dialog">
      <button
        class="btn btn-circle btn-sm absolute right-2 top-2"
        onclick={unsaveClose}
      >
        ✕
      </button>
    </form>
    <div class="flex flex-col gap-4">
      <div class="text-xl font-bold">Enter Password</div>
      <div class="flex flex-col gap-2">
        <input
          type="password"
          class="input input-bordered"
          placeholder="Password"
          bind:value={password}
        />
        <button class="btn btn-primary" onclick={submit}>Unlock</button>
      </div>
    </div>
  </div>
  <!-- Modal backdrop, close when click outside -->
  <form method="dialog" class="modal-backdrop">
    <button onclick={unsaveClose}>close</button>
  </form>
</dialog>

<svelte:window
  on:keydown={(e) => {
    if (e.key === "Escape") {
      isModalOpen = false;
    }
  }}
/>
