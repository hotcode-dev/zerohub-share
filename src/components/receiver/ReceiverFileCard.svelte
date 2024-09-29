<script lang="ts">
  import { FileStatus, type FileDetail } from "../../type";
  import { humanFileSize } from "../../utils/humanFIleSize";

  type Props = {
    children: () => any;
    fileDetail: FileDetail;
  };

  let { children, fileDetail }: Props = $props();
</script>

<div class="card bg-base-100 shadow-lg shadow-base-300">
  <div class="card-body p-2 lg:p-4">
    <div class="flex flex-col gap-2">
      <div class="flex flex-row">
        <div class="flex items-center justify-center h-24 w-24 min-w-24 bg-base-300 rounded">
          <span class="text-lg font-bold">
            {fileDetail.metaData.name.split('.').pop()?.toUpperCase()}
          </span>
        </div>
        <div class="flex flex-col gap-2 px-4 py-2">
          <p class="text-sm font-bold">{fileDetail.metaData.name}</p>
          <p class="text-xs">
            <strong>Size:</strong>
            {humanFileSize(fileDetail.metaData.size)}
          </p>
          {#if fileDetail.metaData.type}
            <p class="text-xs"><strong>Type:</strong> {fileDetail.metaData.type}</p>
          {/if}
        </div>
      </div>
      <div class="flex flex-col gap-1">
        <div class="text-center text-xs xl:text-sm">
          {#if fileDetail.status === FileStatus.Processing}
            Receiving: {humanFileSize(fileDetail.bitrate)}/sec
          {:else if fileDetail.error}
            <div class="text-error">
              Error: {fileDetail.error.message}
            </div>
          {:else if fileDetail.status === FileStatus.WaitingAccept}
            Waiting Accept
          {:else if fileDetail.status === FileStatus.Success}
            Success
          {:else}
            Pending
          {/if}
        </div>
        <progress
          value={isNaN(fileDetail.progress) ? 100 : fileDetail.progress}
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
