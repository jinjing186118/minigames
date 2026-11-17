// The list of games, newest first, with the progress of the current season.
import { site } from "./site.config.js";
import { catalog } from "./catalog.js";
import { say, langSwitch } from "./kit/l10n.js";
import { profileLink } from "./kit/share.js";

document.title = say(site.name);
document.querySelector(".top__name").textContent = say(site.name);
document.querySelector(".top__tools").append(langSwitch());

const newest = catalog[catalog.length - 1];
if (newest) {
  document.querySelector(".season__label").textContent = say({
    zh: `第 ${newest.season} 季　${newest.numberInSeason} / ${site.gamesPerSeason}`,
    en: `Season ${newest.season} · ${newest.numberInSeason} / ${site.gamesPerSeason}`,
  });
  document.querySelector(".season__done").style.width = `${(newest.numberInSeason / site.gamesPerSeason) * 100}%`;
}

const shelf = document.querySelector(".shelf");
for (const game of [...catalog].reverse()) {
  const item = document.createElement("li");
  const link = document.createElement("a");
  link.className = "game-card";
  link.href = game.path;

  const cover = document.createElement("img");
  cover.src = game.cover;
  cover.alt = "";
  cover.loading = "lazy";
  cover.width = cover.height = 600;

  const number = document.createElement("span");
  number.className = "game-card__number";
  number.textContent = `#${String(game.number).padStart(3, "0")}`;

  const name = document.createElement("strong");
  name.textContent = say(game.name);

  const pitch = document.createElement("span");
  pitch.className = "game-card__pitch";
  pitch.textContent = say(game.pitch);

  link.append(cover, number, name, pitch);
  item.append(link);
  shelf.append(item);
}

const x = document.querySelector(".foot__x");
x.href = profileLink();
x.textContent = `X @${site.xHandle}`;
