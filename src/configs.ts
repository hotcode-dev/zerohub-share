export const isProduction = import.meta.env.PROD;

export const zeroHubHosts: string[] = [import.meta.env.PUBLIC_ZEROHUB_HOST];

export const stunServers: string[] = [
  "stun:stun.l.google.com:19302",
  "stun:stun.l.google.com:19305",
  "stun:stun4.l.google.com:19302",
  "stun:stun4.l.google.com:19305",
  "stun:stun.sipgate.net:3478",
  "stun:stun.sipgate.net:10000",
  "stun.nextcloud.com:3478",
  "stun.nextcloud.com:443",
  "stun:stun.myvoipapp.com:3478",
  "stun:stun.voipstunt.com:3478",
];

export const pageTitle = "ZeroHub Share";

export const pageTitleDrop = "ZeroHub Drop";

export const pageDescription = "Secure P2P file sharing using WebRTC";

export const githubLink = "https://github.com/hotcode-dev/zerohub-share";

export const waitIceCandidatesTimeout = 1000; // 1 seconds
