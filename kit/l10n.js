// Two languages: Chinese for Chinese browsers, English for everyone else.
// An explicit ?lang= in the address wins for that visit; the switch on the page is remembered.
const SUPPORTED = ["zh", "en"];
const STORAGE_KEY = "site.lang";

function supported(value) {
  return SUPPORTED.includes(value) ? value : null;
}

function remembered() {
  try {
    return supported(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

function browserDefault() {
  const preferred = navigator.languages?.[0] ?? navigator.language ?? "en";
  return preferred.toLowerCase().startsWith("zh") ? "zh" : "en";
}

export const lang =
  supported(new URLSearchParams(location.search).get("lang")) ?? remembered() ?? browserDefault();

document.documentElement.lang = lang === "zh" ? "zh-Hans" : "en";

// say({ zh: "...", en: "..." }) returns the text for the current language.
export function say(texts) {
  return texts[lang] ?? texts.en;
}

export function switchLang(next) {
  if (!supported(next) || next === lang) return;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Private mode: fall through and carry the choice in the address instead.
  }
  const url = new URL(location.href);
  if (remembered() === next) url.searchParams.delete("lang");
  else url.searchParams.set("lang", next);
  location.replace(url);
}

// A two-button language switch.
export function langSwitch() {
  const box = document.createElement("div");
  box.className = "lang-switch";
  box.setAttribute("role", "group");
  box.setAttribute("aria-label", "Language");
  for (const [code, label] of [["zh", "中文"], ["en", "EN"]]) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.setAttribute("aria-pressed", String(code === lang));
    button.addEventListener("click", () => switchLang(code));
    box.append(button);
  }
  return box;
}
