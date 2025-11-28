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
  import { ChunkChannelMessage, ControlChannelMessage } from "../proto/message";
  import Sender from "./sender/Sender.svelte";
  import Receiver from "./receiver/Receiver.svelte";
  import { settingAtom } from "../stores/setting";
  import ClipboardIcon from "./icons/Clipboard.svelte";
  import { addToastMessage } from "../stores/toast";
  import Toast from "./Toast.svelte";
  import { MAX_CHUNK_CHANNELS } from "../constants";

  const searchParams = new URLSearchParams(window.location.search);
  const joinId = searchParams.get("id");

  const avatar = createAvatar(avatarStyle, {
    seed: $settingAtom.name,
  });
  const svgAvatar = avatar.toDataUri();

  let hubId = $state("");
  let peers: {
    [peerId: string]: {
      isOnline: boolean;
      dataChannels: Record<string, RTCDataChannel>;
      controlChannel: RTCDataChannel | undefined;
      chunkChannels: RTCDataChannel[];
      receiver: Receiver | undefined;
      metadata: PeerMetaData;
      svgAvatar: string;
    };
  } = $state({});
  let inviteLink = $state("");
  let qrModal: QrModal;
  let sender: Sender | undefined = $state(undefined);

  function ensurePeerEntry(peer: Peer<PeerMetaData>) {
    const peerId = peer.id.toString();
    if (!peers[peerId]) {
      peers[peerId] = {
        isOnline: false,
        dataChannels: {},
        controlChannel: undefined,
        chunkChannels: [],
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

    // check if control channel
    if (dataChannel.label === "0" || !peerEntry.controlChannel) {
      peerEntry.controlChannel = dataChannel;
      // handle control channel messages
      dataChannel.onmessage = async (event: MessageEvent<Uint8Array>) => {
        let payload: Uint8Array = new Uint8Array(event.data);

        const message = ControlChannelMessage.decode(payload);

        if (message.metaData !== undefined) {
          peers[peerId].receiver?.onMetaData(message.id, message.metaData);
        } else if (message.receiveEvent !== undefined) {
          sender?.onReceiveEvent(message.id, peerId, message.receiveEvent);
        }
      };
    } else {
      // chunk channel
      const labelNumber = parseInt(dataChannel.label || "", 10);
      if (!Number.isNaN(labelNumber) && labelNumber > 0) {
        peerEntry.chunkChannels = peerEntry.chunkChannels
          .filter((channel) => channel.label !== dataChannel.label)
          .concat(dataChannel)
          .sort((a, b) => {
            const aIndex = parseInt(a.label, 10);
            const bIndex = parseInt(b.label, 10);
            return aIndex - bIndex;
          })
          .slice(0, MAX_CHUNK_CHANNELS);
      }

      // handle chunk channel messages
      dataChannel.onmessage = async (event: MessageEvent<Uint8Array>) => {
        let payload: Uint8Array = new Uint8Array(event.data);

        const message = ChunkChannelMessage.decode(payload);
        if (message.chunk !== undefined) {
          peers[peerId].receiver?.onChunkData(message.id, message.chunk);
        }
      };
    }

    dataChannel.onopen = () => {
      peerEntry.isOnline = true;
      peers = peers;
    };

    dataChannel.onclose = () => {
      delete peerEntry.dataChannels[dataChannel.label];

      // if the closed channel is control channel, reassign it
      if (peerEntry.controlChannel === dataChannel) {
        peerEntry.controlChannel = peerEntry.dataChannels["0"];
        if (!peerEntry.controlChannel) {
          const firstChannel = Object.values(peerEntry.dataChannels)[0];
          peerEntry.controlChannel = firstChannel;
        }
      }

      // remove from chunk channels
      peerEntry.chunkChannels = peerEntry.chunkChannels.filter(
        (channel) => channel !== dataChannel,
      );

      // if no chunk channels, try to assign from data channels
      if (peerEntry.chunkChannels.length === 0) {
        const fallbackChunkChannels = Object.values(peerEntry.dataChannels)
          .filter((channel) => channel !== peerEntry.controlChannel)
          .sort((a, b) => {
            const aIndex = parseInt(a.label, 10);
            const bIndex = parseInt(b.label, 10);
            return aIndex - bIndex;
          })
          .slice(0, MAX_CHUNK_CHANNELS);
        peerEntry.chunkChannels = fallbackChunkChannels;
      }

      // if no data channels left, set peer to offline
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
      // TODO: configurable number of data channels for chunk transfer
      numberOfChannels: MAX_CHUNK_CHANNELS + 1,
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
    var url = new URL(window.location.href);
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
        // update status to online if peer is offerer
        if (zeroHub.myPeerId && peer.id > zeroHub.myPeerId) {
          peerEntry.isOnline = true;
        }
        break;
      case PeerStatus.ZeroHubDisconnected:
        // close data channel
        Object.values(peerEntry.dataChannels).forEach((channel) => {
          try {
            channel.close();
          } catch (error) {
            console.error("Failed to close data channel", error);
          }
        });
        peerEntry.dataChannels = {};
        peerEntry.controlChannel = undefined;
        peerEntry.chunkChannels = [];
        // set peer to offline
        peerEntry.isOnline = false;
        break;
    }

    peers = peers;
  };

  async function joinOrCreateHub(id: string | null, name: string) {
    if (!id) {
      // if id is not provided, create or join a hub with the client ip
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

  // Join or create Hub if the id is provided
  joinOrCreateHub(joinId, $settingAtom.name);

  function copyLink() {
    navigator.clipboard.writeText(inviteLink);
  }
</script>

{#if hubId}
  <div class="flex w-full flex-col gap-4">
    <div class="flex flex-col gap-2">
      <div class="collapse-close bg-base-200 collapse">
        <div
          class="collapse-title flex flex-row items-center justify-between p-0 text-xl font-medium"
        >
          <div class="flex flex-row items-center justify-between">
            <div class="flex flex-row items-center gap-4">
              <img src={svgAvatar} class="h-8 w-8" alt="avatar" />
              <span>{$settingAtom.name} (You)</span>
            </div>
          </div>
        </div>
      </div>
      {#each Object.values(peers) as peer}
        {#if peer.isOnline && peer.controlChannel}
          <Receiver
            bind:this={peer.receiver}
            controlChannel={peer.controlChannel}
            peerMetaData={peer.metadata}
            svgAvatar={peer.svgAvatar}
          />
        {/if}
      {/each}
    </div>
    <div class="mx-auto flex w-full max-w-screen-md flex-col gap-2">
      <div class="text-error text-center text-sm">
        It will see other peers with the same public IP
      </div>
      <div class="text-center text-sm">Invite more people with this link</div>
      <div class="flex flex-col lg:flex-row">
        <input
          class="input input-sm input-bordered w-full text-sm"
          value={inviteLink}
          readonly
        />
        <button class="btn btn-primary btn-sm" onclick={copyLink}
          ><ClipboardIcon />Copy Link</button
        >
        <button
          class="btn btn-sm bg-base-300 gap-2"
          onclick={() => {
            qrModal.open(inviteLink);
          }}
        >
          <QrIcon />
          QR Code
        </button>
      </div>
    </div>
    <div class="divider m-0"></div>
    <Sender bind:this={sender} {peers} />
  </div>
{:else}
  <div class="flex h-full w-full flex-col items-center justify-center gap-2">
    <span class="loading loading-spinner loading-lg"></span>
    <div>Loading</div>
  </div>
{/if}

<QrModal bind:this={qrModal} />
<Toast />
