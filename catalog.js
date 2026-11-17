// Published games, oldest first. Season and number are derived from the position.
import { site } from "./site.config.js";

const published = [
  {
    slug: "fill",
    released: "2026-11-16",
    name: { zh: "倒满", en: "Fill It to the Brim" },
    pitch: {
      zh: "把水倒到离杯口尽可能近，但不能溢出来。",
      en: "Pour water as close to the brim as you can without spilling.",
    },
  },
  {
    slug: "mine",
    released: "2026-11-16",
    name: { zh: "挖金矿", en: "Dig for Gold" },
    pitch: {
      zh: "30 秒，一把镐。挖得越深，金子越值钱。",
      en: "Thirty seconds, one pick. The deeper you dig, the richer the gold.",
    },
  },
];

export const catalog = published.map((game, index) => ({
  ...game,
  number: index + 1,
  season: Math.floor(index / site.gamesPerSeason) + 1,
  numberInSeason: (index % site.gamesPerSeason) + 1,
  path: `g/${game.slug}/`,
  cover: `g/${game.slug}/cover.webp`,
}));

export function findGame(slug) {
  return catalog.find((game) => game.slug === slug) ?? null;
}
