import { describe, expect, it } from "vitest";
import { stunServers, waitIceCandidatesTimeout } from "../configs";
import {
  buildIceServers,
  createInitialPeerConnectionState,
  isPeerOfferer,
  registerDataChannel,
  handleDataChannelOpen,
  handleDataChannelClose,
  handlePeerConnectionStateChange,
  type PeerChannelState,
} from "./webrtc";

function createMockChannel(
  label: string,
  readyState: RTCDataChannelState = "connecting",
): RTCDataChannel {
  return {
    label,
    readyState,
    close: () => {},
  } as unknown as RTCDataChannel;
}

describe("WebRTC configuration", () => {
  it("has valid stun: scheme on all configured stunServers", () => {
    for (const url of stunServers) {
      expect(url.startsWith("stun:")).toBe(true);
    }
  });

  it("allows enough time for mobile/cellular ICE gathering", () => {
    expect(waitIceCandidatesTimeout).toBeGreaterThanOrEqual(3000);
  });

  it("includes fallback STUN servers when using the default STUN server", () => {
    const servers = buildIceServers({
      iceServer: "stun:stun.l.google.com:19302",
    });

    const urls = servers.flatMap((s) =>
      Array.isArray(s.urls) ? s.urls : [s.urls],
    );
    expect(urls).toContain("stun:stun.l.google.com:19302");
    expect(urls.length).toBeGreaterThanOrEqual(2);
  });

  it("attaches username and credential to TURN servers from user settings", () => {
    const servers = buildIceServers({
      iceServer: "turn:turn.example.com:3478, turns:turn.example.com:5349",
      iceUsername: "alice",
      iceCredential: "secret",
    });

    const turnEntries = servers.filter((s) => {
      const first = Array.isArray(s.urls) ? s.urls[0] : s.urls;
      return first.startsWith("turn:") || first.startsWith("turns:");
    });

    expect(turnEntries).toHaveLength(1);
    expect(turnEntries[0]).toEqual({
      urls: ["turn:turn.example.com:3478", "turns:turn.example.com:5349"],
      username: "alice",
      credential: "secret",
    });
  });

  it("keeps STUN servers without credentials when mixed with TURN servers", () => {
    const servers = buildIceServers({
      iceServer: "stun:stun.l.google.com:19302, turn:turn.example.com:3478",
      iceUsername: "alice",
      iceCredential: "secret",
    });

    const stunEntry = servers.find((s) => {
      const first = Array.isArray(s.urls) ? s.urls[0] : s.urls;
      return first.startsWith("stun:");
    });
    expect(stunEntry).toBeDefined();
    expect(stunEntry?.username).toBeUndefined();
    expect(stunEntry?.credential).toBeUndefined();
  });

  it("includes env TURN server config when provided", () => {
    const servers = buildIceServers(
      { iceServer: "stun:stun.l.google.com:19302" },
      {
        urls: "turn:relay.zerohub.dev:3478",
        username: "u1",
        credential: "p1",
      },
    );

    expect(servers).toContainEqual({
      urls: ["turn:relay.zerohub.dev:3478"],
      username: "u1",
      credential: "p1",
    });
  });
});

describe("Peer connection and data channel state tracking", () => {
  it("compares peer IDs numerically for offerer election", () => {
    expect(isPeerOfferer("10", "2")).toBe(true);
    expect(isPeerOfferer("2", "10")).toBe(false);
    expect(isPeerOfferer("5", "5")).toBe(false);
  });

  it("does NOT mark peer online or count connecting channels as ready before onopen", () => {
    const state: PeerChannelState = createInitialPeerConnectionState();

    for (let i = 0; i < 16; i++) {
      registerDataChannel(state, createMockChannel(String(i), "connecting"));
    }

    expect(state.isOnline).toBe(false);
    expect(Object.keys(state.dataChannels)).toHaveLength(0);
    expect(state.connectionState).toBe("connecting");
  });

  it("marks peer online and exposes channels once onopen fires", () => {
    const state = createInitialPeerConnectionState();
    const ch0 = createMockChannel("0", "connecting");
    registerDataChannel(state, ch0);

    expect(state.isOnline).toBe(false);

    handleDataChannelOpen(state, ch0);
    expect(state.isOnline).toBe(true);
    expect(state.connectionState).toBe("connected");
    expect(Object.keys(state.dataChannels)).toEqual(["0"]);
  });

  it("immediately marks peer online if incoming channel is already open", () => {
    const state = createInitialPeerConnectionState();
    const ch0 = createMockChannel("0", "open");
    registerDataChannel(state, ch0);

    expect(state.isOnline).toBe(true);
    expect(state.connectionState).toBe("connected");
    expect(Object.keys(state.dataChannels)).toEqual(["0"]);
  });

  it("marks peer failed when ICE or connection state fails", () => {
    const state = createInitialPeerConnectionState();
    registerDataChannel(state, createMockChannel("0", "connecting"));

    handlePeerConnectionStateChange(state, "failed", "failed");
    expect(state.isOnline).toBe(false);
    expect(state.connectionState).toBe("failed");
  });

  it("marks peer offline when last open channel closes", () => {
    const state = createInitialPeerConnectionState();
    const ch0 = createMockChannel("0", "open");
    registerDataChannel(state, ch0);
    expect(state.isOnline).toBe(true);

    handleDataChannelClose(state, "0");
    expect(state.isOnline).toBe(false);
    expect(Object.keys(state.dataChannels)).toHaveLength(0);
  });
});
