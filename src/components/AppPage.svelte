<script lang="ts">
  import {
    LogLevel,
    Peer,
    PeerStatus,
    ZeroHubClient,
    type Config as ZeroHubConfig,
  } from "@zero-hub/client";
  import { createAvatar } from "@dicebear/core";
  import { thumbs } from "@dicebear/collection";
  import { defaultOptions, waitIceCandidatesTimeout } from "../configs";
  import {
    uniqueNamesGenerator,
    adjectives,
    animals,
  } from "unique-names-generator";
  import QrIcon from "./icons/QrIcon.svelte";
  import QrModal from "./qr/QrModal.svelte";
  import type { HubMetaData, Options, PeerMetaData } from "../type";
  import { generateRsaKeyPair } from "../utils/crypto";
  import PeerCollapse from "./PeerCollapse.svelte";

  const searchParams = new URLSearchParams(window.location.search);
  const joinId = searchParams.get("id");

  const randomName = uniqueNamesGenerator({
    dictionaries: [adjectives, animals],
    separator: " ",
    style: "capital",
  });
  const avatar = createAvatar(thumbs, {
    seed: randomName,
  });
  const svgAvatar = avatar.toDataUri();

  const zerohubConfig: Partial<ZeroHubConfig> = import.meta.env.PROD
    ? {
        tls: true,
        logLevel: LogLevel.Error,
        waitIceCandidatesTimeout: waitIceCandidatesTimeout,
      }
    : {
        tls: false,
        logLevel: LogLevel.Debug,
        waitIceCandidatesTimeout: waitIceCandidatesTimeout,
      };

  const zeroHub = new ZeroHubClient<PeerMetaData, HubMetaData>(
    [import.meta.env.PUBLIC_ZEROHUB_HOST],
    zerohubConfig
  );

  let hubId = $state("");
  let onlinePeers: Peer<PeerMetaData>[] = $state([]);
  let peerDataChannels: { [peerId: string]: RTCDataChannel } = $state({});
  let inviteLink = $state("");
  let qrModal: QrModal;
  let options: Options = $state(defaultOptions);
  let rsa: CryptoKeyPair | undefined = $state(); // private key

  function createInviteLink(hubId: string) {
    var url = new URL(window.location.href);
    url.searchParams.set("id", hubId);
    inviteLink = url.toString();
  }

  zeroHub.onHubInfo = (hubInfo) => {
    hubId = hubInfo.id;
    options = hubInfo.metadata.options;
    createInviteLink(hubInfo.id);
  };

  function handleDataChannel(
    peer: Peer<PeerMetaData>,
    dataChannel: RTCDataChannel
  ) {
    dataChannel.onopen = () => {};
    dataChannel.onerror = () => {};
    dataChannel.onclose = () => {};

    peerDataChannels[peer.id] = dataChannel;
  }

  zeroHub.onZeroHubError = (error) => {
    console.error("ZeroHub error:", error);
  };

  zeroHub.onPeerStatusChange = (peer) => {
    switch (peer.status) {
      case PeerStatus.Connected:
        onlinePeers = [...onlinePeers, peer];
        break;
      case PeerStatus.Pending:
        // create offer if peer id is greater than local peer id
        if (zeroHub.myPeerId && peer.id > zeroHub.myPeerId) {
          // TODO: should this move to the client SDK?
          const dataChannel = peer.rtcConn.createDataChannel("data", {
            ordered: false,
          });
          handleDataChannel(peer, dataChannel);

          // offer should send after create data channel
          zeroHub.sendOffer(peer.id);
        } else {
          peer.rtcConn.ondatachannel = (event) => {
            handleDataChannel(peer, event.channel);
          };
        }
        break;
      case PeerStatus.ZeroHubDisconnected:
        onlinePeers = onlinePeers.filter((p) => p.id !== peer.id);
        peerDataChannels[peer.id]?.close();
        delete peerDataChannels[peer.id];
        break;
    }
  };

  async function createHub(name: string) {
    rsa = await generateRsaKeyPair();
    zeroHub.createHub(
      {
        options: options,
      },
      {
        name: name,
        rsaPub: rsa.publicKey,
      }
    );
  }

  async function joinHub(id: string, name: string) {
    rsa = await generateRsaKeyPair();
    zeroHub.joinHub(id, {
      name: name,
      rsaPub: rsa.publicKey,
    });
  }

  // Join Hub if the id is provided
  if (joinId) {
    joinHub(joinId, randomName);
  } else {
    createHub(randomName);
  }

  function copyLink() {
    navigator.clipboard.writeText(inviteLink);
  }
</script>

{#if hubId}
  <div class="flex flex-col gap-4 w-full">
    <div class="flex flex-col gap-2 w-full">
      <div>Invite more people with this link</div>
      <div class="flex flex-col lg:flex-row gap-1">
        <input
          class="input input-bordered w-full"
          value={inviteLink}
          readonly
        />
        <button class="btn btn-primary" onclick={copyLink}>Copy Link</button>
        <button
          class="btn btn-100 gap-2"
          onclick={() => {
            qrModal.open(inviteLink);
          }}
        >
          <QrIcon />
          QR Code
        </button>
      </div>
    </div>
    <div class="flex flex-col gap-2">
      <div class="collapse bg-base-200">
        <div class="collapse-title text-xl font-medium">
          <div class="flex flex-row justify-between items-center">
            <div class="flex flex-row gap-4 items-center">
              <img src={svgAvatar} class="w-8 h-8" alt="avatar" />
              <span>{randomName} (You)</span>
            </div>
          </div>
        </div>
      </div>
      {#each onlinePeers as peer}
        {#if peerDataChannels[peer.id]}
          <PeerCollapse
            {rsa}
            {options}
            dataChannel={peerDataChannels[peer.id]}
            peerMetaData={peer.metadata}
            svgAvatar={createAvatar(thumbs, {
              seed: peer.metadata.name,
            }).toDataUri()}
          />
        {/if}
      {/each}
    </div>
  </div>
{:else}
  <div class="flex flex-col h-full w-full items-center justify-center gap-2">
    <span class="loading loading-spinner loading-lg"></span>
    <div>Loading</div>
  </div>
{/if}
<QrModal bind:this={qrModal} />
