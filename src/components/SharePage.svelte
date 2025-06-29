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

  const searchParams = new URLSearchParams(window.location.search);
  const joinId = searchParams.get("id");

  const avatar = createAvatar(avatarStyle, {
    seed: $settingAtom.name,
  });
  const svgAvatar = avatar.toDataUri();

  const zerohubConfig: Partial<ZeroHubConfig> = isProduction
    ? {
        tls: true,
        logLevel: LogLevel.Error,
        waitIceCandidatesTimeout: waitIceCandidatesTimeout,
        rtcConfig: {
          iceServers: [
            {
              urls: $settingAtom.iceServer,
            },
          ],
        },
      }
    : {
        tls: false,
        logLevel: LogLevel.Debug,
        waitIceCandidatesTimeout: waitIceCandidatesTimeout,
        rtcConfig: {
          iceServers: [
            {
              urls: $settingAtom.iceServer,
            },
          ],
        },
      };

  const zeroHub = new ZeroHubClient<PeerMetaData, HubMetaData>(
    zeroHubHosts,
    zerohubConfig,
  );

  let hubId = $state("");
  let peers: {
    [peerId: string]: {
      isOnline: boolean;
      dataChannel: RTCDataChannel;
      receiver: Receiver | undefined;
      metadata: PeerMetaData;
      svgAvatar: string;
    };
  } = $state({});
  let inviteLink = $state("");
  let qrModal: QrModal;

  let sender: Sender | undefined = $state(undefined);

  function createInviteLink(hubId: string) {
    var url = new URL(window.location.href);
    url.searchParams.set("id", hubId);
    inviteLink = url.toString();
  }

  zeroHub.onHubInfo = (hubInfo) => {
    hubId = hubInfo.id;
    createInviteLink(hubInfo.id);
  };

  function handleDataChannel(
    peer: Peer<PeerMetaData>,
    dataChannel: RTCDataChannel,
    isOnline: boolean,
  ) {
    let receiver: Receiver | undefined;

    dataChannel.onopen = () => {};
    dataChannel.onerror = () => {};
    dataChannel.onclose = () => {};
    dataChannel.onmessage = (event) => {
      const message = Message.decode(new Uint8Array(event.data));

      if (message.metaData !== undefined) {
        peers[peer.id.toString()].receiver?.onMetaData(
          message.id,
          message.metaData,
        );
      } else if (message.chunk !== undefined) {
        peers[peer.id.toString()].receiver?.onChunkData(
          message.id,
          message.chunk,
        );
      } else if (message.receiveEvent !== undefined) {
        sender?.onReceiveEvent(
          message.id,
          peer.id.toString(),
          message.receiveEvent,
        );
      }
    };

    peers[peer.id.toString()] = {
      isOnline,
      dataChannel: dataChannel,
      receiver: receiver,
      metadata: peer.metadata,
      svgAvatar: createAvatar(avatarStyle, {
        seed: peer.metadata.name,
      }).toDataUri(),
    };
  }

  zeroHub.onZeroHubError = (error) => {
    console.error("ZeroHub error:", error);
    addToastMessage("ZeroHub Error: " + error.message, "error");
  };

  zeroHub.onPeerStatusChange = (peer) => {
    switch (peer.status) {
      case PeerStatus.Connected:
        // update status to online if peer is offerer
        if (zeroHub.myPeerId && peer.id > zeroHub.myPeerId) {
          peers[peer.id.toString()].isOnline = true;
        }
        break;
      case PeerStatus.Pending:
        if (zeroHub.myPeerId && peer.id > zeroHub.myPeerId) {
          // create offer if peer id is greater than local peer id
          const dataChannel = peer.rtcConn.createDataChannel("data", {
            ordered: false,
          });
          handleDataChannel(peer, dataChannel, false);

          // offer should send after create data channel
          zeroHub.sendOffer(peer.id);
        } else {
          peer.rtcConn.ondatachannel = (event) => {
            handleDataChannel(peer, event.channel, true);
          };
        }
        break;
      case PeerStatus.ZeroHubDisconnected:
        // close data channel
        peers[peer.id.toString()]?.dataChannel?.close();
        // set peer to offline
        peers[peer.id.toString()].isOnline = false;
        break;
    }
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
        {#if peer.isOnline && peer.dataChannel}
          <Receiver
            bind:this={peer.receiver}
            dataChannel={peer.dataChannel}
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
