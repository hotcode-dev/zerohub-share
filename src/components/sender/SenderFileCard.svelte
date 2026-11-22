<script lang="ts">
  import {
    FileStatus,
    type PeerMetaData,
    type SendingFileSelection,
  } from "../../type";
  import { humanFileSize } from "../../utils/humanFIleSize";

  type Props = {
    children: () => any;
    sendingFileSelection: SendingFileSelection;
    peers: {
      [peerId: string]: {
        isOnline: boolean;
        dataChannels: Record<string, RTCDataChannel>;
        metadata: PeerMetaData;
        svgAvatar: string;
      };
    };
  };

  const { children, sendingFileSelection, peers }: Props = $props();

  let ext = $derived(
    sendingFileSelection.file.name.includes(".")
      ? (sendingFileSelection.file.name.split(".").pop()?.slice(0, 5) ?? "FILE")
      : "FILE",
  );
</script>

<article
  class="zh-card flex flex-col gap-3 rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm"
>
  <div class="flex items-center gap-3.5">
    <div
      class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-base-300 bg-base-200 font-mono text-xs font-semibold uppercase text-primary"
    >
      <span class="truncate px-1">{ext}</span>
    </div>

    <div class="min-w-0 flex-1">
      <p class="truncate text-sm font-semibold text-base-content">
        {sendingFileSelection.file.name}
      </p>
      <div
        class="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-base-content/65"
      >
        <span class="font-mono tabular-nums">
          {humanFileSize(sendingFileSelection.file.size)}
        </span>
        {#if sendingFileSelection.file.type}
          <span aria-hidden="true">·</span>
          <span class="truncate">{sendingFileSelection.file.type}</span>
        {/if}
        {#if sendingFileSelection.isEncrypt}
          <span aria-hidden="true">·</span>
          <span class="font-medium text-warning">Encrypted</span>
        {/if}
      </div>
    </div>
  </div>

  {#if Object.keys(sendingFileSelection.sendingFiles).length > 0}
    <div class="flex flex-col gap-2.5">
      {#each Object.entries(sendingFileSelection.sendingFiles) as [peerId, sendingFile]}
        {#if peers[peerId] && peers[peerId].isOnline}
          <div
            class="flex flex-col gap-1.5 rounded-xl border border-base-300 bg-base-200/50 p-3"
          >
            <div
              class="flex flex-wrap items-center justify-between gap-2 text-xs"
            >
              <div class="flex min-w-0 items-center gap-2">
                <img
                  src={peers[peerId].svgAvatar}
                  width="24"
                  height="24"
                  class="h-6 w-6 rounded-full border border-base-300 bg-base-100"
                  alt=""
                  aria-hidden="true"
                />
                <span class="truncate font-medium text-base-content">
                  {peers[peerId].metadata.name}
                </span>
              </div>

              <div class="font-mono text-[11px] tabular-nums">
                {#if sendingFile.status === FileStatus.Processing}
                  <span class="text-primary">
                    {humanFileSize(sendingFile.bitrate)}/s · {sendingFile
                      .fileMetadata.channels} ch
                  </span>
                {:else if sendingFile.error}
                  <span class="font-sans font-medium text-error">
                    Error: {sendingFile.error.message}
                  </span>
                {:else if sendingFile.status === FileStatus.WaitingAccept}
                  <span class="font-sans text-warning">Waiting for accept…</span
                  >
                {:else if sendingFile.status === FileStatus.Success}
                  <span class="text-success">
                    Sent · {humanFileSize(sendingFile.bitrate)}/s
                  </span>
                {:else}
                  <span class="font-sans text-base-content/60">Pending</span>
                {/if}
              </div>
            </div>

            <progress
              value={isNaN(sendingFile.progress) ? 100 : sendingFile.progress}
              max="100"
              class="progress progress-primary h-1.5 w-full"
            ></progress>
          </div>
        {/if}
      {/each}
    </div>
  {/if}

  {@render children?.()}
</article>
