<script lang="ts">
  import { FileStatus, type ReceivingFile } from "../../type";
  import { humanFileSize } from "../../utils/humanFIleSize";

  type Props = {
    children: () => any;
    receivingFile: ReceivingFile;
  };

  let { children, receivingFile }: Props = $props();

  let ext = $derived(
    receivingFile.fileMetadata.name.includes(".")
      ? receivingFile.fileMetadata.name.split(".").pop()?.slice(0, 5) ?? "FILE"
      : "FILE",
  );
</script>

<article class="flex flex-col gap-2.5 rounded-xl border border-base-300 bg-base-100 p-3">
  <div class="flex items-center gap-3">
    <div
      class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-base-300 bg-base-200 font-mono text-[11px] font-semibold uppercase text-primary"
    >
      <span class="truncate px-1">{ext}</span>
    </div>

    <div class="min-w-0 flex-1">
      <p class="truncate text-sm font-semibold text-base-content">
        {receivingFile.fileMetadata.name}
      </p>
      <div class="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-base-content/65">
        <span class="font-mono tabular-nums">
          {humanFileSize(receivingFile.fileMetadata.size)}
        </span>
        {#if receivingFile.isEncrypt}
          <span aria-hidden="true">·</span>
          <span class="font-medium text-warning">Encrypted</span>
        {/if}
      </div>
    </div>
  </div>

  <div class="flex flex-col gap-1.5">
    <div class="flex items-center justify-between font-mono text-[11px] tabular-nums">
      {#if receivingFile.status === FileStatus.Processing}
        <span class="text-primary">
          Receiving · {humanFileSize(receivingFile.bitrate)}/s
        </span>
        <span class="text-base-content/60">
          {receivingFile.fileMetadata.channels} ch
        </span>
      {:else if receivingFile.error}
        <span class="font-sans font-medium text-error">
          Error: {receivingFile.error.message}
        </span>
      {:else if receivingFile.status === FileStatus.WaitingAccept}
        <span class="font-sans text-warning">Incoming file request</span>
      {:else if receivingFile.status === FileStatus.Success}
        <span class="text-success">
          Ready · {humanFileSize(receivingFile.bitrate)}/s
        </span>
        <span class="text-base-content/60">100%</span>
      {:else}
        <span class="font-sans text-base-content/60">Pending</span>
      {/if}
    </div>
    <progress
      value={isNaN(receivingFile.progress) ? 100 : receivingFile.progress}
      max="100"
      class="progress progress-primary h-1.5 w-full"
    ></progress>
  </div>

  {@render children?.()}
</article>
