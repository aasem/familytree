const KEY = "ft-theme";
const COLORS = { light: "#e7dccb", dark: "#161310" };

export function initTheme() {
  apply(resolve());
  const button = document.querySelector("#theme");
  if (button) {
    syncButton(button);
    button.addEventListener("click", () => {
      const next = current() === "dark" ? "light" : "dark";
      localStorage.setItem(KEY, next);
      apply(next);
      syncButton(button);
    });
  }
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (event) => {
    if (localStorage.getItem(KEY) === "light" || localStorage.getItem(KEY) === "dark") return;
    apply(event.matches ? "dark" : "light");
    if (button) syncButton(button);
  });
}

function resolve() {
  const stored = localStorage.getItem(KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function current() {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function apply(theme) {
  document.documentElement.dataset.theme = theme;
  const meta = document.querySelector('meta[name="theme-color"]:not([media])')
    || document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", COLORS[theme]);
}

function syncButton(button) {
  const dark = current() === "dark";
  button.setAttribute("aria-pressed", dark ? "true" : "false");
  button.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
  button.title = dark ? "Light theme" : "Dark theme";
  button.textContent = dark ? "Light" : "Dark";
}
