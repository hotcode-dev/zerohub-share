<script lang="ts">
  import { QRByte, Encoder, ErrorCorrectionLevel } from "@nuintun/qrcode";

  let isModalOpen: boolean = $state(false);
  let qrDataURL: string = $state("");

  export function open(
    newQRData: string,
    correctionLevel: ErrorCorrectionLevel = ErrorCorrectionLevel.L
  ) {
    const qrcode: Encoder = new Encoder({
      encodingHint: true,
      errorCorrectionLevel: correctionLevel,
      version: 0, // 0 for automatic version
    })
      .write(
        new QRByte(newQRData, (data: string) => {
          // The encoding value must a valid ECI value
          // Custom ECI only support QRByte mode
          // https://github.com/zxing/zxing/blob/master/core/src/main/java/com/google/zxing/common/CharacterSetECI.java
          const bytes = data.split("").map((char) => char.charCodeAt(0));

          return {
            bytes: bytes,
            encoding: 27, // 27 is US-ASCII
          };
        })
      )
      .make();
    qrDataURL = qrcode.toDataURL();
    isModalOpen = true;
  }

  export function close() {
    isModalOpen = false;
  }
</script>

<input type="checkbox" class="modal-toggle" bind:checked={isModalOpen} />
<div class="modal" role="dialog">
  <div class="modal-box rounded-none">
    <form method="dialog">
      <button
        class="btn btn-sm btn-circle absolute right-2 top-2"
        onclick={close}
      >
        ✕
      </button>
    </form>
    <div class="flex flex-col gap-4">
      <div class="font-bold text-xl lg:text-4xl">Scan QR Code</div>
      <img class="w-screen" src={qrDataURL} alt="qr" />
    </div>
  </div>
  <!-- This use for close when click outside the modal -->
  <form method="dialog" class="modal-backdrop">
    <button onclick={close}>close</button>
  </form>
</div>

<svelte:window
  on:keydown={(e) => {
    if (e.key === "Escape") {
      isModalOpen = false;
    }
  }}
/>
