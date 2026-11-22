import { defaultFallbackStunServers } from "../configs";
import type { Setting } from "../type";

export interface TurnEnvConfig {
  urls?: string;
  username?: string;
  credential?: string;
}

export type IceServerSetting = Pick<
  Setting,
  "iceServer" | "iceUsername" | "iceCredential"
>;

export type PeerConnectionState =
  | "connecting"
  | "connected"
  | "failed"
  | "disconnected";

export interface PeerChannelState {
  isOnline: boolean;
  connectionState: PeerConnectionState;
  dataChannels: Record<string, RTCDataChannel>;
  allChannels: Record<string, RTCDataChannel>;
}

export function parseIceServerUrls(raw?: string): string[] {
  if (!raw) return [];
  return raw
    .split(/[\n,]+/)
    .map((u) => u.trim())
    .filter((u) => u.length > 0);
}

function isTurnUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return lower.startsWith("turn:") || lower.startsWith("turns:");
}

function isStunUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return lower.startsWith("stun:") || lower.startsWith("stuns:");
}

export function buildIceServers(
  setting: IceServerSetting,
  envTurnConfig?: TurnEnvConfig,
): RTCIceServer[] {
  const configuredUrls = parseIceServerUrls(setting.iceServer);
  const stunUrls: string[] = [];
  const turnUrls: string[] = [];

  for (const url of configuredUrls) {
    if (isTurnUrl(url)) {
      turnUrls.push(url);
    } else if (isStunUrl(url)) {
      stunUrls.push(url);
    }
  }

  // Ensure resilient STUN fallbacks when using the default single Google STUN or when none provided
  const isDefaultSingleStun =
    stunUrls.length === 0 ||
    (stunUrls.length === 1 && stunUrls[0] === defaultFallbackStunServers[0]);

  if (isDefaultSingleStun) {
    for (const fallback of defaultFallbackStunServers) {
      if (!stunUrls.includes(fallback)) {
        stunUrls.push(fallback);
      }
    }
  }

  const iceServers: RTCIceServer[] = [];

  if (stunUrls.length > 0) {
    iceServers.push({ urls: stunUrls });
  }

  if (turnUrls.length > 0) {
    const turnEntry: RTCIceServer = { urls: turnUrls };
    if (setting.iceUsername?.trim()) {
      turnEntry.username = setting.iceUsername.trim();
    }
    if (setting.iceCredential?.trim()) {
      turnEntry.credential = setting.iceCredential.trim();
    }
    iceServers.push(turnEntry);
  }

  const envTurnUrls = parseIceServerUrls(envTurnConfig?.urls).filter(isTurnUrl);
  if (envTurnUrls.length > 0) {
    const envEntry: RTCIceServer = { urls: envTurnUrls };
    if (envTurnConfig?.username?.trim()) {
      envEntry.username = envTurnConfig.username.trim();
    }
    if (envTurnConfig?.credential?.trim()) {
      envEntry.credential = envTurnConfig.credential.trim();
    }
    iceServers.push(envEntry);
  }

  return iceServers;
}

export function isPeerOfferer(peerId: string, myPeerId: string): boolean {
  return Number.parseInt(peerId, 10) > Number.parseInt(myPeerId, 10);
}

export function createInitialPeerConnectionState(): PeerChannelState {
  return {
    isOnline: false,
    connectionState: "connecting",
    dataChannels: {},
    allChannels: {},
  };
}

export function registerDataChannel(
  state: PeerChannelState,
  channel: RTCDataChannel,
): void {
  state.allChannels[channel.label] = channel;

  if (channel.readyState === "open") {
    state.dataChannels[channel.label] = channel;
    state.isOnline = true;
    state.connectionState = "connected";
  }
}

export function handleDataChannelOpen(
  state: PeerChannelState,
  channel: RTCDataChannel,
): void {
  state.allChannels[channel.label] = channel;
  state.dataChannels[channel.label] = channel;
  state.isOnline = true;
  state.connectionState = "connected";
}

export function handleDataChannelClose(
  state: PeerChannelState,
  label: string,
): void {
  delete state.dataChannels[label];
  delete state.allChannels[label];

  if (Object.keys(state.dataChannels).length === 0) {
    state.isOnline = false;
    if (state.connectionState === "connected") {
      state.connectionState = "disconnected";
    }
  }
}

export function handlePeerConnectionStateChange(
  state: PeerChannelState,
  iceConnectionState: RTCIceConnectionState,
  connectionState: RTCPeerConnectionState,
): void {
  if (iceConnectionState === "failed" || connectionState === "failed") {
    state.isOnline = false;
    state.connectionState = "failed";
    return;
  }

  if (connectionState === "closed" || iceConnectionState === "closed") {
    state.isOnline = false;
    state.connectionState = "disconnected";
    return;
  }

  if (
    connectionState === "disconnected" ||
    iceConnectionState === "disconnected"
  ) {
    if (Object.keys(state.dataChannels).length === 0) {
      state.isOnline = false;
      state.connectionState = "disconnected";
    }
    return;
  }

  if (
    (connectionState === "connected" ||
      iceConnectionState === "connected" ||
      iceConnectionState === "completed") &&
    Object.keys(state.dataChannels).length > 0
  ) {
    state.isOnline = true;
    state.connectionState = "connected";
  }
}

export function closeAllPeerChannels(state: PeerChannelState): void {
  const seen = new Set<RTCDataChannel>();
  for (const channel of [
    ...Object.values(state.allChannels),
    ...Object.values(state.dataChannels),
  ]) {
    if (seen.has(channel)) continue;
    seen.add(channel);
    try {
      channel.close();
    } catch {
      // ignore close errors on already-closed channels
    }
  }
  state.allChannels = {};
  state.dataChannels = {};
  state.isOnline = false;
  state.connectionState = "disconnected";
}
