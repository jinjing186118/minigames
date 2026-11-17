// Links for posting a result to X and for following the author.
import { site, siteRoot } from "../site.config.js";
import { lang } from "./l10n.js";

// The address that goes into a post: the game's own page, in the sharer's language.
export function gameLink(slug) {
  const url = new URL(`g/${slug}/`, siteRoot());
  url.searchParams.set("lang", lang);
  url.searchParams.set("from", "x");
  return url.href;
}

export function postLink(slug, text) {
  const query = new URLSearchParams({ text, url: gameLink(slug) });
  return `https://x.com/intent/post?${query}`;
}

export function followLink() {
  const query = new URLSearchParams({ screen_name: site.xHandle });
  return `https://x.com/intent/follow?${query}`;
}

export function profileLink() {
  return `https://x.com/${encodeURIComponent(site.xHandle)}`;
}
