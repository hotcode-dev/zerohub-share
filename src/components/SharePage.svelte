<script lang="ts">
  import {
    LogLevel,
    Peer,
    PeerStatus,
    ZeroHubClient,
    type Config as ZeroHubConfig,
  } from "@zero-hub/client";
  import { createAvatar } from "@dicebear/core";
  import { openPeeps as avatarStyle } from "@dicebear/collection";
  import {
    isProduction,
    waitIceCandidatesTimeout,
    zeroHubHosts,
  } from "../configs";
  import QrIcon from "./icons/QrIcon.svelte";
  import QrModal from "./qr/QrModal.svelte";
  import type { HubMetaData, PeerMetaData } from "../type";
  import { Message } from "../proto/message";
  import Sender from "./sender/Sender.svelte";
  import Receiver from "./receiver/Receiver.svelte";
  import { settingAtom } from "../stores/setting";
  import ClipboardIcon from "./icons/Clipboard.svelte";
  import { addToastMessage } from "../stores/toast";
  import Toast from "./Toast.svelte";
  import { MAX_DATA_CHANNELS } from "../constants";

  const searchParams = new URLSearchParams(window.location.search);
  const joinId = searchParams.get("id");

  const avatar = createAvatar(avatarStyle, {
    seed: $settingAtom.name,
  });
  const svgAvatar = avatar.toDataUri();

  let hubId = $state("");
  let copied = $state(false);
  let peers: {
    [peerId: string]: {
      isOnline: boolean;
      dataChannels: Record<string, RTCDataChannel>;
      receiver: Receiver | undefined;
      metadata: PeerMetaData;
      svgAvatar: string;
    };
  } = $state({});
  let inviteLink = $state("");
  let qrModal: QrModal;
  let sender: Sender | undefined = $state(undefined);

  let onlinePeers = $derived(
    Object.values(peers).filter(
      (p) => p.isOnline && p.dataChannels && Object.keys(p.dataChannels).length > 0,
    ),
  );

  function ensurePeerEntry(peer: Peer<PeerMetaData>) {
    const peerId = peer.id.toString();
    if (!peers[peerId]) {
      peers[peerId] = {
        isOnline: false,
        dataChannels: {},
        receiver: undefined,
        metadata: peer.metadata,
        svgAvatar: createAvatar(avatarStyle, {
          seed: peer.metadata.name,
        }).toDataUri(),
      };
    } else {
      peers[peerId].metadata = peer.metadata;
      peers[peerId].svgAvatar = createAvatar(avatarStyle, {
        seed: peer.metadata.name,
      }).toDataUri();
    }

    peers = peers;
    return peers[peerId];
  }

  function handleDataChannel(
    peer: Peer<PeerMetaData>,
    dataChannel: RTCDataChannel,
  ) {
    const peerId = peer.id.toString();
    const peerEntry = ensurePeerEntry(peer);

    peerEntry.isOnline = true;
    peerEntry.dataChannels[dataChannel.label] = dataChannel;

    dataChannel.onmessage = async (event: MessageEvent<Uint8Array>) => {
      let payload: Uint8Array = new Uint8Array(event.data);

      const message = Message.decode(payload);

      if (message.chunk !== undefined) {
        peers[peerId].receiver?.onChunkData(
          message.id,
          dataChannel.label,
          message.chunk,
        );
      } else if (message.filePartMetaData !== undefined) {
        peers[peerId].receiver?.onFilePartMetaData(
          message.id,
          dataChannel.label,
          message.filePartMetaData,
        );
      } else if (message.filePartEvent !== undefined) {
        sender?.onFilePartEvent(
          message.id,
          peerId,
          dataChannel.label,
          message.filePartEvent,
        );
      } else if (message.fileMetadata !== undefined) {
        peers[peerId].receiver?.onFileMetaData(
          message.id,
          message.fileMetadata,
        );
      } else if (message.fileEvent !== undefined) {
        sender?.onFileEvent(message.id, peerId, message.fileEvent);
      }
    };

    dataChannel.onopen = () => {
      peerEntry.isOnline = true;
      peers = peers;
    };

    dataChannel.onclose = () => {
      delete peerEntry.dataChannels[dataChannel.label];

      if (Object.keys(peerEntry.dataChannels).length === 0) {
        peerEntry.isOnline = false;
      }

      peers = peers;
    };

    peers = peers;
  }

  const zerohubConfig: Partial<ZeroHubConfig<PeerMetaData>> = {
    tls: isProduction,
    logLevel: isProduction ? LogLevel.Error : LogLevel.Debug,
    waitIceCandidatesTimeout: waitIceCandidatesTimeout,
    rtcConfig: {
      iceServers: [
        {
          urls: $settingAtom.iceServer,
        },
      ],
    },
    dataChannelConfig: {
      numberOfChannels: MAX_DATA_CHANNELS,
      rtcDataChannelInit: {
        ordered: true,
      },
      onDataChannel: handleDataChannel,
    },
  };

  const zeroHub = new ZeroHubClient<PeerMetaData, HubMetaData>(
    zeroHubHosts,
    zerohubConfig,
  );

  function createInviteLink(hubId: string) {
    const url = new URL(window.location.href);
    url.searchParams.set("id", hubId);
    inviteLink = url.toString();
  }

  zeroHub.onHubInfo = (hubInfo) => {
    hubId = hubInfo.id;
    createInviteLink(hubInfo.id);
  };

  zeroHub.onZeroHubError = (error) => {
    console.error("ZeroHub error:", error);
    addToastMessage("ZeroHub Error: " + error.message, "error");
  };

  zeroHub.onPeerStatusChange = (peer) => {
    const peerEntry = ensurePeerEntry(peer);

    switch (peer.status) {
      case PeerStatus.Connected:
        if (zeroHub.myPeerId && peer.id > zeroHub.myPeerId) {
          peerEntry.isOnline = true;
        }
        break;
      case PeerStatus.ZeroHubDisconnected:
        Object.values(peerEntry.dataChannels).forEach((channel) => {
          try {
            channel.close();
          } catch (error) {
            console.error("Failed to close data channel", error);
          }
        });
        peerEntry.dataChannels = {};
        peerEntry.isOnline = false;
        break;
    }

    peers = peers;
  };

  async function joinOrCreateHub(id: string | null, name: string) {
    if (!id) {
      zeroHub.joinOrCreateIPHub(
        {
          name: name,
        },
        {},
      );
      return;
    }
    zeroHub.joinIPHub(id, {
      name: name,
    });
  }

  joinOrCreateHub(joinId, $settingAtom.name);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(inviteLink);
      copied = true;
      addToastMessage("Invite link copied to clipboard", "success", 3000);
      setTimeout(() => {
        copied = false;
      }, 2000);
    } catch {
      addToastMessage("Could not copy invite link", "error");
    }
  }
</script>

<div class="flex w-full flex-col gap-6">
  <!-- Top Workspace Header -->
  <section
    aria-labelledby="workspace-heading"
    class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
  >
    <div class="space-y-1">
      <h1
        id="workspace-heading"
        class="text-2xl font-bold tracking-tight text-base-content sm:text-3xl"
      >
        Direct peer-to-peer file sharing
      </h1>
      <p class="max-w-2xl text-base leading-relaxed text-base-content/75">
        Transfer files straight between devices over WebRTC with optional
        AES-256 encryption.
      </p>
    </div>

    <div
      class="inline-flex w-fit items-center gap-2 rounded-full border border-base-300 bg-base-100 px-3.5 py-1.5 text-xs font-medium text-base-content"
      role="status"
      aria-live="polite"
    >
      {#if hubId}
        <span class="relative flex h-2 w-2" aria-hidden="true">
          <span class="relative inline-flex h-2 w-2 rounded-full bg-success"></span>
        </span>
        <span>
          Hub active ·
          <span class="font-mono tabular-nums">
            {onlinePeers.length} {onlinePeers.length === 1 ? "peer" : "peers"}
          </span>
        </span>
      {:else}
        <span
          class="loading loading-spinner loading-xs text-primary"
          aria-hidden="true"
        ></span>
        <span>Connecting to hub…</span>
      {/if}
    </div>
  </section>

  {#if hubId}
    <div class="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
      <!-- Primary Column: Send Files -->
      <section aria-labelledby="send-heading" class="flex flex-col gap-4 lg:col-span-7">
        <div class="flex items-center justify-between">
          <h2
            id="send-heading"
            class="text-sm font-semibold uppercase tracking-wider text-base-content/70"
          >
            Send files
          </h2>
          <span class="font-mono text-xs text-base-content/60">
            Up to {MAX_DATA_CHANNELS} channels
          </span>
        </div>
        <Sender bind:this={sender} {peers} />
      </section>

      <!-- Secondary Column: Hub Invite & Connected Peers -->
      <aside aria-label="Hub and peers" class="flex flex-col gap-6 lg:col-span-5">
        <!-- Hub & Invite Card -->
        <section
          aria-labelledby="hub-heading"
          class="rounded-2xl border border-base-300 bg-base-100 p-5 shadow-sm"
        >
          <div class="flex items-center justify-between gap-3 border-b border-base-300 pb-4">
            <div class="flex min-w-0 items-center gap-3">
              <div
                class="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-base-300 bg-base-200"
              >
                <img
                  src={svgAvatar}
                  width="40"
                  height="40"
                  class="h-10 w-10"
                  alt=""
                  aria-hidden="true"
                />
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <h2
                    id="hub-heading"
                    class="truncate text-base font-semibold text-base-content"
                  >
                    {$settingAtom.name}
                  </h2>
                  <span
                    class="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary"
                  >
                    You
                  </span>
                </div>
                <p class="font-mono text-xs text-base-content/60">
                  Hub {hubId.slice(0, 8)}
                </p>
              </div>
            </div>
          </div>

          <div class="mt-4 flex flex-col gap-3">
            <div class="flex flex-col gap-1.5">
              <label
                for="invite-link-input"
                class="text-xs font-semibold uppercase tracking-wider text-base-content/70"
              >
                Invite link
              </label>
              <input
                id="invite-link-input"
                type="text"
                class="input input-bordered min-h-[44px] w-full rounded-xl bg-base-200/70 px-3.5 font-mono text-base leading-normal tracking-tight text-base-content focus:border-primary"
                value={inviteLink}
                readonly
                onclick={(e) => (e.currentTarget as HTMLInputElement).select()}
              />
            </div>

            <div class="grid grid-cols-2 gap-2">
              <button
                type="button"
                class="btn btn-primary min-h-[44px] rounded-xl text-sm font-semibold"
                onclick={copyLink}
              >
                <ClipboardIcon />
                {copied ? "Copied" : "Copy link"}
              </button>
              <button
                type="button"
                class="btn min-h-[44px] rounded-xl border border-base-300 bg-base-100 text-sm font-semibold text-base-content hover:bg-base-200"
                onclick={() => {
                  qrModal.open(inviteLink);
                }}
              >
                <QrIcon />
                Show QR
              </button>
            </div>

            <div
              class="flex items-start gap-2.5 rounded-xl border border-base-300 bg-base-200/60 px-3.5 py-2.5 text-xs text-base-content/75"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                class="mt-0.5 h-4 w-4 shrink-0 text-primary"
                aria-hidden="true"
              >
                <path
                  fill-rule="evenodd"
                  d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z"
                  clip-rule="evenodd"
                />
              </svg>
              <span>
                Devices on the same network join this hub automatically. Share
                the link or QR code to connect remotely.
              </span>
            </div>
          </div>
        </section>

        <!-- Connected Peers & Incoming Transfers -->
        <section
          aria-labelledby="peers-heading"
          class="flex flex-col gap-3 rounded-2xl border border-base-300 bg-base-100 p-5 shadow-sm"
        >
          <div class="flex items-center justify-between">
            <h2
              id="peers-heading"
              class="text-sm font-semibold uppercase tracking-wider text-base-content/70"
            >
              Connected peers
            </h2>
            <span
              class="rounded-full bg-base-200 px-2.5 py-0.5 font-mono text-xs font-medium tabular-nums text-base-content/75"
            >
              {onlinePeers.length}
            </span>
          </div>

          {#if onlinePeers.length > 0}
            <div class="flex flex-col gap-3">
              {#each Object.values(peers) as peer}
                {#if peer.isOnline && peer.dataChannels && Object.keys(peer.dataChannels).length > 0}
                  <Receiver
                    bind:this={peer.receiver}
                    peerMetaData={peer.metadata}
                    svgAvatar={peer.svgAvatar}
                    dataChannels={peer.dataChannels}
                  />
                {/if}
              {/each}
            </div>
          {:else}
            <div
              class="flex flex-col items-center justify-center rounded-xl border border-dashed border-base-300 bg-base-200/40 px-4 py-8 text-center"
            >
              <div
                class="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-base-200 text-base-content/60"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="1.5"
                  stroke="currentColor"
                  class="h-5 w-5"
                  aria-hidden="true"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M8.288 15.038a5.25 5.25 0 0 1 7.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 0 1 1.06 0Z"
                  />
                </svg>
              </div>
              <p class="text-sm font-semibold text-base-content">
                Waiting for peers to join
              </p>
              <p class="mt-1 max-w-xs text-xs text-base-content/65">
                Open ZeroHub Share on another device on your network, or share
                the invite link above.
              </p>
            </div>
          {/if}
        </section>
      </aside>
    </div>
  {:else}
    <!-- Connecting State -->
    <section
      aria-label="Connecting to hub"
      class="flex flex-1 flex-col items-center justify-center rounded-2xl border border-base-300 bg-base-100 px-6 py-16 text-center shadow-sm"
    >
      <div
        class="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"
      >
        <span class="loading loading-spinner loading-md" aria-hidden="true"></span>
      </div>
      <h2 class="text-lg font-semibold text-base-content">
        Establishing peer-to-peer hub
      </h2>
      <p class="mt-2 max-w-sm text-base leading-relaxed text-base-content/75">
        Connecting to the signaling server to create your private WebRTC
        session.
      </p>
    </section>
  {/if}
</div>

<QrModal bind:this={qrModal} />
<Toast />
