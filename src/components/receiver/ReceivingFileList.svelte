<script lang="ts">
  import { FileStatus, type ReceivingFile } from "../../type";
  import Trash from "../icons/Trash.svelte";
  import DownTray from "../icons/DownTray.svelte";
  import ReceiverFileCard from "./ReceiverFileCard.svelte";

  type Props = {
    receivingFiles: { [key: string]: ReceivingFile };
    onRemove: (key: string) => void;
    onDownload: (key: string) => void;
    onAccept: (key: string) => void;
    onDeny: (key: string) => void;
  };

  let { receivingFiles, onRemove, onDownload, onAccept, onDeny }: Props =
    $props();
</script>

<div class="flex flex-col gap-2.5">
  {#each Object.entries(receivingFiles) as [key, receivedFile] (key)}
    <ReceiverFileCard receivingFile={receivedFile}>
      <div
        class="flex w-full items-center justify-between gap-2 border-t border-base-300 pt-2.5"
      >
        {#if receivedFile.status === FileStatus.WaitingAccept && !receivedFile.error}
          <div class="ml-auto flex items-center gap-2">
            <button
              type="button"
              onclick={() => onDeny(key)}
              class="btn btn-ghost min-h-[44px] rounded-xl px-3 text-xs font-semibold text-base-content/75 hover:bg-error/10 hover:text-error"
            >
              Deny
            </button>
            <button
              type="button"
              onclick={() => onAccept(key)}
              class="btn btn-primary min-h-[44px] rounded-xl px-4 text-xs font-semibold"
            >
              {receivedFile.isEncrypt ? "Unlock & accept" : "Accept"}
            </button>
          </div>
        {:else}
          <button
            type="button"
            onclick={() => onRemove(key)}
            aria-label={`Remove ${receivedFile.fileMetadata.name}`}
            class="btn btn-ghost min-h-[44px] gap-1.5 rounded-xl px-3 text-xs font-medium text-base-content/70 hover:bg-error/10 hover:text-error"
          >
            <Trash />
            <span>Remove</span>
          </button>
          {#if receivedFile.status === FileStatus.Success}
            <button
              type="button"
              onclick={() => onDownload(key)}
              class="btn btn-primary min-h-[44px] gap-1.5 rounded-xl px-4 text-xs font-semibold"
            >
              <DownTray />
              <span>Download</span>
            </button>
          {/if}
        {/if}
      </div>
    </ReceiverFileCard>
  {/each}
</div>
