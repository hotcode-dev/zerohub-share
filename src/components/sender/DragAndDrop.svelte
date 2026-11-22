<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { addToastMessage } from "../../stores/toast";

  type Props = {
    onFilesPick: (files: FileList) => void;
  };

  const { onFilesPick }: Props = $props();

  let dropArea: HTMLElement;
  let fileInput: HTMLInputElement;
  let isDragging = $state(false);

  function preventDefaults(e: Event) {
    e.preventDefault();
    e.stopPropagation();
  }

  function highlight() {
    isDragging = true;
  }

  function unhighlight() {
    isDragging = false;
  }

  function handleDrop(e: DragEvent) {
    unhighlight();
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      onFilesPick(files);
    }
  }

  function handleFileInputChange() {
    if (fileInput.files && fileInput.files.length > 0) {
      onFilesPick(fileInput.files);
      fileInput.value = "";
    }
  }

  function handleTextClipboard(text: string) {
    const textBlob = new Blob([text], { type: "text/plain" });
    const textFile = new File([textBlob], "clipboard.txt", {
      type: "text/plain",
    });

    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(textFile);
    onFilesPick(dataTransfer.files);
  }

  function handleFileClipboard(file: File) {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    onFilesPick(dataTransfer.files);
  }

  async function handlePasteFromClipboardButton() {
    const clipboardData = navigator.clipboard;
    if (!clipboardData) {
      addToastMessage("Clipboard API is not available", "error");
      return;
    }

    try {
      let added = false;
      const text = await clipboardData.readText();
      if (text) {
        handleTextClipboard(text);
        added = true;
      }

      if (clipboardData.read) {
        const items = await clipboardData.read();
        for (const item of items) {
          for (const type of item.types) {
            if (!type.startsWith("image/")) continue;
            const blob = await item.getType(type);
            const imageFile = new File(
              [blob],
              `image.${type.replace("image/", "")}`,
              { type },
            );
            handleFileClipboard(imageFile);
            added = true;
          }
        }
      }

      if (!added) {
        addToastMessage("No text or image found on clipboard", "info");
      }
    } catch {
      addToastMessage("No data on clipboard", "info");
    }
  }

  function handlePasteEvent(event: ClipboardEvent): void {
    const target = event.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable)
    ) {
      return;
    }

    const clipboardData = event.clipboardData;
    if (!clipboardData) return;

    const text = clipboardData.getData("Text");
    if (text) {
      handleTextClipboard(text);
    }

    const items = clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      const file = items[i].getAsFile();
      if (file) {
        handleFileClipboard(file);
      }
    }
  }

  onMount(() => {
    ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
      dropArea.addEventListener(eventName, preventDefaults, false);
    });
    ["dragenter", "dragover"].forEach((eventName) => {
      dropArea.addEventListener(eventName, highlight, false);
    });
    ["dragleave", "drop"].forEach((eventName) => {
      dropArea.addEventListener(eventName, unhighlight, false);
    });
    dropArea.addEventListener("drop", handleDrop, false);
    document.addEventListener("paste", handlePasteEvent);
  });

  onDestroy(() => {
    document.removeEventListener("paste", handlePasteEvent);
  });
</script>

<div class="flex flex-col gap-3">
  <label
    bind:this={dropArea}
    data-dragging={isDragging}
    class="zh-dropzone group relative flex min-h-[216px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 {isDragging
      ? 'border-primary bg-primary/10'
      : 'border-base-300 bg-base-100 hover:border-primary/60 hover:bg-base-100/80'}"
  >
    <input
      accept="*"
      type="file"
      multiple
      aria-label="Choose files to send"
      class="sr-only"
      bind:this={fileInput}
      onchange={handleFileInputChange}
    />

    <div
      class="zh-dropzone-icon mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-base-300 bg-base-200 text-primary"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke-width="1.75"
        stroke="currentColor"
        class="h-6 w-6"
        aria-hidden="true"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
        />
      </svg>
    </div>

    <p class="text-base font-semibold text-base-content">
      {isDragging ? "Release to add files" : "Drop files here or click to browse"}
    </p>
    <p class="mt-1 text-sm leading-relaxed text-base-content/70">
      Any file type · Direct WebRTC transfer<span class="hidden sm:inline"
        > · Paste anywhere with
        <kbd
          class="ml-1 rounded border border-base-300 bg-base-200 px-1.5 py-0.5 font-mono text-xs font-medium text-base-content"
        >
          Ctrl+V
        </kbd></span
      >
    </p>
  </label>

  <button
    type="button"
    class="btn min-h-[44px] w-full rounded-xl border border-base-300 bg-base-100 text-sm font-medium text-base-content hover:bg-base-200"
    onclick={handlePasteFromClipboardButton}
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke-width="1.75"
      stroke="currentColor"
      class="h-4 w-4"
      aria-hidden="true"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184"
      />
    </svg>
    Paste text or image from clipboard
  </button>
</div>
