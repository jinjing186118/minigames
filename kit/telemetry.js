// One place for analytics events. Runs on a developer machine are never reported.
const LOCAL_HOSTS = ["", "localhost", "127.0.0.1", "[::1]"];

export const isLocal = LOCAL_HOSTS.includes(location.hostname);
export const recorded = [];

export function record(name, detail = {}) {
  recorded.push({ name, ...detail });
  if (!isLocal && typeof window.gtag === "function") window.gtag("event", name, detail);
}
