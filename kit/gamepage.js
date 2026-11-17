// The frame every game page shares: title card, result card, way back to the list.
// A game supplies its own view and rules and calls showResult() when a round ends.
import { site } from "../site.config.js";
import { findGame } from "../catalog.js";
import { say, langSwitch } from "./l10n.js";
import { postLink, followLink } from "./share.js";
import { record } from "./telemetry.js";
import { enableSound } from "./sound.js";

const SETTLE_MS = 500;

function el(tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content != null) node.append(content);
  return node;
}

// On the published site a game refuses to run inside someone else's page.
// Previews and local copies are served from another address and may be framed.
function embeddedElsewhere() {
  if (!site.origin || window.top === window.self) return false;
  if (location.origin !== new URL(site.origin).origin) return false;
  try {
    return window.top.location.origin !== location.origin;
  } catch {
    return true;
  }
}

export function openGamePage(slug, { onPlay, onRetry }) {
  const game = findGame(slug);
  const root = document.getElementById("game");
  document.title = `${say(game.name)} | ${say(site.name)}`;

  if (embeddedElsewhere()) {
    const out = el("a", "game__elsewhere", say(game.name));
    out.href = location.href;
    out.target = "_blank";
    out.rel = "noopener";
    root.append(out);
    return null;
  }

  const view = el("div", "game__view");
  const hud = el("div", "game__hud");

  const home = el("a", "game__home", `‹ ${say(site.name)}`);
  home.href = "../../";

  // Title card
  const title = el("section", "game__title");
  const play = el("button", "game__play", say({ zh: "开始", en: "Play" }));
  play.type = "button";
  title.append(
    langSwitch(),
    el(
      "p",
      "game__number",
      say({
        zh: `第 ${game.season} 季 · 第 ${game.numberInSeason} 款`,
        en: `Season ${game.season} · No. ${game.numberInSeason}`,
      }),
    ),
    el("h1", "game__name", say(game.name)),
    el("p", "game__pitch", say(game.pitch)),
    play,
  );
  title.addEventListener("click", (event) => {
    if (event.target.closest(".lang-switch")) return;
    title.hidden = true;
    enableSound();
    onPlay();
  });

  // Result card
  const result = el("section", "game__result");
  result.hidden = true;
  const headline = el("p", "game__headline");
  const caption = el("p", "game__caption");
  const retry = el("button", "game__button", say({ zh: "再来一次", en: "Try again" }));
  retry.type = "button";
  const share = el("a", "game__button game__button--main", say({ zh: "分享到 X", en: "Share on X" }));
  const follow = el("a", "game__follow", say({ zh: `关注作者 @${site.xHandle}`, en: `Follow @${site.xHandle}` }));
  for (const link of [share, follow]) {
    link.target = "_blank";
    link.rel = "noopener";
  }
  follow.href = followLink();
  const actions = el("div", "game__actions");
  actions.append(retry, share);
  const card = el("div", "game__card");
  card.append(actions, follow);
  result.append(headline, caption, card);

  retry.addEventListener("click", () => {
    result.hidden = true;
    onRetry();
  });
  share.addEventListener("click", () => record("share", { game: slug }));
  follow.addEventListener("click", () => record("follow", { game: slug }));

  root.addEventListener("contextmenu", (event) => event.preventDefault());
  root.append(view, hud, home, title, result);
  play.focus({ preventScroll: true });

  return {
    root,
    view,
    hud,
    get resultOpen() {
      return !result.hidden;
    },
    showResult({ headline: big, caption: small, shareText }) {
      headline.textContent = big;
      caption.textContent = small;
      share.href = postLink(slug, shareText);
      result.hidden = false;
      // A tap that was meant for the game must not land on a button that has just appeared.
      card.classList.add("game__card--settling");
      setTimeout(() => card.classList.remove("game__card--settling"), SETTLE_MS);
    },
    retry() {
      retry.click();
    },
  };
}
