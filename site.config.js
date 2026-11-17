// Site-wide settings. Everything that depends on the domain, the X account
// or the season length is read from here.
export const site = {
  name: { zh: "小游戏站", en: "Mini Games" }, // placeholder until a name is chosen
  origin: "https://jinjing186118.github.io/minigames", // where the site is published; empty means "wherever the site is served from"
  xHandle: "jinjing186118",
  gamesPerSeason: 100,
};

// Absolute URL of the site root, with a trailing slash.
export function siteRoot() {
  if (site.origin) return site.origin.replace(/\/+$/, "") + "/";
  return new URL("./", import.meta.url).href;
}
