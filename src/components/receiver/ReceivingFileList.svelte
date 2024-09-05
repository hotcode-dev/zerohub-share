<script lang="ts">
  import { FileStatus, type ReceivingFile } from "../../type";
  import Trash from "../icons/Trash.svelte";
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

<div class="grid gap-2">
  {#each Object.entries(receivingFiles) as [key, receivedFile], index (key)}
    <ReceiverFileCard fileDetail={receivedFile}>
      <div class="flex flex-row justify-between items-center w-full">
        {#if receivedFile.status === FileStatus.WaitingAccept && !receivedFile.error}
          <div class="ml-auto">
            <button onclick={() => onDeny(key)} class="btn btn-ghost"
              >Deny</button
            >
            <button onclick={() => onAccept(key)} class="btn btn-primary"
              >Accept</button
            >
          </div>
        {:else}
          <button onclick={() => onRemove(key)} class="btn btn-ghost btn-sm">
            <Trash /><span class="hidden lg:block">Remove</span>
          </button>
          {#if receivedFile.status === FileStatus.Success}
            <button onclick={() => onDownload(key)} class="btn btn-primary">
              Download
            </button>
          {/if}
        {/if}
      </div>
    </ReceiverFileCard>
  {/each}
</div>
