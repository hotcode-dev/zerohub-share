<script lang="ts">
  import type { SendingFileSelection } from "../../type";
  import Lock from "../icons/Lock.svelte";

  type Props = {
    sendingFileSelection: SendingFileSelection;
  };

  const { sendingFileSelection = $bindable() }: Props = $props();

  let isModalOpen: boolean = $state(false);
  let password: string = $state("");

  function open() {
    password = "";
    isModalOpen = true;
  }

  function unsaveClose() {
    sendingFileSelection.isEncrypt = false;
    isModalOpen = false;
  }

  function submit() {
    sendingFileSelection.password = password;
    isModalOpen = false;
  }

  $inspect(sendingFileSelection.isEncrypt).with((type, isEncrypt) => {
    if (type === "update") {
      if (isEncrypt) {
        open();
      }
    }
  });
</script>

<div
  class="tooltip"
  data-tip={sendingFileSelection.isEncrypt ? "Encrypt" : "Not Encrypt"}
>
  <Lock bind:show={sendingFileSelection.isEncrypt} />
</div>
<input type="checkbox" class="modal-toggle" bind:checked={isModalOpen} />
<dialog id="encryptmodal" class="modal modal-bottom sm:modal-middle">
  <div class="modal-box rounded-none">
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
        <button class="btn btn-primary" onclick={submit}>Submit</button>
      </div>
    </div>
  </div>
  <!-- Modal backdrop, close when click outside -->
  <form method="dialog" class="modal-backdrop">
    <button onclick={unsaveClose}>close</button>
  </form>
</dialog>
