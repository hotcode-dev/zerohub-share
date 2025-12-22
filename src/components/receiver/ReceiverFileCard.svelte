<script lang="ts">
  import { FileStatus, type ReceivingFile } from "../../type";
  import { humanFileSize } from "../../utils/humanFIleSize";

  type Props = {
    children: () => any;
    receivingFile: ReceivingFile;
  };

  let { children, receivingFile }: Props = $props();
</script>

<div class="card bg-base-100 shadow-base-300 shadow-lg">
  <div class="card-body p-2 lg:p-4">
    <div class="flex flex-col gap-2">
      <div class="flex flex-row">
        <div
          class="bg-base-300 flex h-24 w-24 min-w-24 items-center justify-center rounded"
        >
          <span class="max-w-full overflow-hidden truncate px-1 text-lg font-bold uppercase">
            {receivingFile.fileMetadata.name.split(".").pop()}
          </span>
        </div>
        <div class="flex flex-col gap-2 px-4 py-2">
          <p class="text-sm font-bold">{receivingFile.fileMetadata.name}</p>
          <p class="text-xs">
            <strong>Size:</strong>
            {humanFileSize(receivingFile.fileMetadata.size)}
          </p>
          {#if receivingFile.fileMetadata.type}
            <p class="text-xs">
              <strong>Type:</strong>
              {receivingFile.fileMetadata.type}
            </p>
          {/if}
        </div>
      </div>
      <div class="flex flex-col gap-1">
        <div class="text-center text-xs xl:text-sm">
          {#if receivingFile.status === FileStatus.Processing}
            Receiving: {humanFileSize(receivingFile.bitrate)}/sec, Channels: {receivingFile
              .fileMetadata.channels}
          {:else if receivingFile.error}
            <div class="text-error">
              Error: {receivingFile.error.message}
            </div>
          {:else if receivingFile.status === FileStatus.WaitingAccept}
            Waiting Accept
          {:else if receivingFile.status === FileStatus.Success}
            Success {humanFileSize(receivingFile.bitrate)}/sec, Channels: {receivingFile
              .fileMetadata.channels}
          {:else}
            Pending
          {/if}
        </div>
        <progress
          value={isNaN(receivingFile.progress) ? 100 : receivingFile.progress}
          max="100"
          class="progress progress-accent"
        ></progress>
      </div>
      <div>
        {@render children?.()}
      </div>
    </div>
  </div>
</div>
