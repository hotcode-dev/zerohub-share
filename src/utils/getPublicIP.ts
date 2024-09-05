export async function getPublicIP() {
  const response = await fetch("https://api.ipify.org/?format=text");
  const ip = await response.text();
  return ip as string;
}
