<script lang="ts">
  import { QRByte, Encoder, ErrorCorrectionLevel } from "@nuintun/qrcode";

  let isModalOpen: boolean = $state(false);
  let qrDataURL: string = $state("");
  let currentUrl: string = $state("");

  export function open(
    newQRData: string,
    correctionLevel: ErrorCorrectionLevel = ErrorCorrectionLevel.L,
  ) {
    currentUrl = newQRData;
    const qrcode: Encoder = new Encoder({
      encodingHint: true,
      errorCorrectionLevel: correctionLevel,
      version: 0,
    })
      .write(
        new QRByte(newQRData, (data: string) => {
          const bytes = data.split("").map((char) => char.charCodeAt(0));

          return {
            bytes: bytes,
            encoding: 27,
          };
        }),
      )
      .make();
    qrDataURL = qrcode.toDataURL();
    isModalOpen = true;
  }

  export function close() {
    isModalOpen = false;
  }
</script>

{#if isModalOpen}
  <div
    class="modal modal-open modal-bottom sm:modal-middle"
    role="dialog"
    aria-modal="true"
    aria-labelledby="qr-modal-title"
  >
    <div
      class="modal-box border border-base-300 bg-base-100 p-6 shadow-xl sm:max-w-sm sm:rounded-2xl"
    >
      <div
        class="flex items-center justify-between border-b border-base-300 pb-4"
      >
        <div>
          <h3
            id="qr-modal-title"
            class="text-lg font-bold tracking-tight text-base-content"
          >
            Scan to join hub
          </h3>
          <span class="mt-1 block text-sm leading-normal text-base-content/75">
            Open on your phone camera to connect directly.
          </span>
        </div>
        <button
          type="button"
          aria-label="Close QR code modal"
          class="btn btn-circle btn-ghost min-h-[44px] min-w-[44px]"
          onclick={close}
        >
          ✕
        </button>
      </div>

      <div class="mt-5 flex flex-col items-center gap-4">
        <div class="rounded-2xl border border-base-300 bg-white p-4 shadow-sm">
          {#if qrDataURL}
            <img
              width="224"
              height="224"
              class="h-56 w-56 object-contain"
              style="image-rendering: pixelated;"
              src={qrDataURL}
              alt="QR code for ZeroHub Share invite link"
            />
          {/if}
        </div>
        {#if currentUrl}
          <span
            class="w-full truncate rounded-lg bg-base-200 px-3 py-2 text-center font-mono text-xs text-base-content/75"
          >
            {currentUrl}
          </span>
        {/if}
      </div>
    </div>
    <div class="modal-backdrop">
      <button type="button" aria-label="Close QR code backdrop" onclick={close}
        >close</button
      >
    </div>
  </div>
{/if}

<svelte:window
  onkeydown={(e) => {
    if (e.key === "Escape" && isModalOpen) {
      isModalOpen = false;
    }
  }}
/>
