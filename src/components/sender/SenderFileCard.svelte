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
        dataChannel: RTCDataChannel;
        metadata: PeerMetaData;
        svgAvatar: string;
      };
    };
  };

  const { children, sendingFileSelection, peers }: Props = $props();
</script>

<div class="card bg-base-100 shadow-lg shadow-base-300">
  <div class="card-body p-2 lg:p-4">
    <div class="flex flex-col gap-2">
      <div class="flex flex-row">
        <div
          class="flex h-24 w-24 min-w-24 items-center justify-center rounded bg-base-300"
        >
          <span class="text-lg font-bold">
            {sendingFileSelection.file.name.split(".").pop()?.toUpperCase()}
          </span>
        </div>
        <div class="flex flex-col gap-2 px-4 py-2">
          <p class="text-sm font-bold">{sendingFileSelection.file.name}</p>
          <p class="text-xs">
            <strong>Size:</strong>
            {humanFileSize(sendingFileSelection.file.size)}
          </p>
          {#if sendingFileSelection.file.type}
            <p class="text-xs">
              <strong>Type:</strong>
              {sendingFileSelection.file.type}
            </p>
          {/if}
        </div>
      </div>
      <div class="flex flex-col gap-2">
        {#each Object.entries(sendingFileSelection.sendingFiles) as [peerId, sendingFile]}
          {#if peers[peerId] && peers[peerId].isOnline}
            <div class="flex flex-col">
              <div class="flex flex-row items-center text-xs xl:text-sm">
                <div class="flex flex-grow flex-row items-center gap-4">
                  <img
                    src={peers[peerId].svgAvatar}
                    class="h-8 w-8"
                    alt="avatar"
                  />
                  <span>Sending to {peers[peerId].metadata.name}</span>
                </div>
                <div class="flex-end">
                  <div class="text-center">
                    {#if sendingFile.status === FileStatus.Processing}
                      Sending:
                      {humanFileSize(sendingFile.bitrate)}/sec
                    {:else if sendingFile.error}
                      <div class="text-error">
                        Error: {sendingFile.error.message}
                      </div>
                    {:else if sendingFile.status === FileStatus.WaitingAccept}
                      Waiting for Accept
                    {:else if sendingFile.status === FileStatus.Success}
                      Success
                    {:else}
                      Pending
                    {/if}
                  </div>
                </div>
              </div>
              <progress
                value={isNaN(sendingFile.progress) ? 100 : sendingFile.progress}
                max="100"
                class="progress progress-accent"
              ></progress>
            </div>
          {/if}
        {/each}
      </div>
      {@render children?.()}
    </div>
  </div>
</div>
