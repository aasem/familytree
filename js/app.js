import { loadFamily } from "./model.js";
import { avatarHTML, displayName, esc, isLiving, metaHTML, yearsHTML } from "./format.js";
import { redrawTree, renderTree, treeCaption } from "./tree.js";
import { renderLineage } from "./lineage.js";
import { renderDirectory } from "./directory.js";
import { renderPanel } from "./panel.js";
import { initTheme } from "./theme.js";

initTheme();

const state = {
  index: null,
  id: "",
  view: "tree",
  branchId: "",
  livingOnly: false,
  detailOpen: false,
};

const suggest = document.querySelector("#suggest");
const input = document.querySelector("#q");
let highlighted = -1;

document.addEventListener("error", (event) => {
  const image = event.target;
  if (!(image instanceof HTMLImageElement)) return;
  const frame = image.closest(".avatar");
  if (!frame) return;
  image.remove();
  if (!frame.textContent.trim()) frame.textContent = frame.dataset.initials || "";
}, true);

async function main() {
  let index;
  try {
    index = await loadFamily("./data/family.json");
  } catch (error) {
    showFatal(error);
    return;
  }
  state.index = index;
  if (index.lang) document.documentElement.lang = index.lang;
  document.documentElement.dir = index.dir || "ltr";
  document.querySelector("#title").textContent = index.title;
  const lede = document.querySelector("#lede");
  if (index.subtitle) {
    lede.textContent = index.subtitle;
    lede.hidden = false;
  }
  const humanCount = index.humans.length;
  const peopleWord = humanCount === 1 ? "person" : "people";
  const genWord = index.generationCount === 1 ? "generation" : "generations";
  const petBit = index.petCount
    ? ` · ${index.petCount} ${index.petCount === 1 ? "pet" : "pets"}`
    : "";
  document.querySelector("#stats").textContent = humanCount
    ? `${humanCount} ${peopleWord} · ${index.livingCount} living · ${index.generationCount} ${genWord}${petBit}`
    : (index.petCount ? `${index.petCount} ${index.petCount === 1 ? "pet" : "pets"}` : "No people yet");
  renderBanner(index);
  renderIssues(index);
  bind();
  const fromHash = readHash();
  const initial = index.byId.has(fromHash) ? fromHash : index.focusId;
  state.branchId = index.canonicalBranch(index.topAncestor(initial));
  setFocus(initial || "", "replace");
  registerInstall();
  registerWorker();
  syncHeaderHeight();
}

function bind() {
  document.querySelector(".switch").addEventListener("click", (event) => {
    const button = event.target.closest("[data-view]");
    if (!button) return;
    state.view = button.dataset.view;
    render();
  });

  document.querySelector("#view-tree").addEventListener("click", (event) => {
    const button = event.target.closest("[data-id]");
    if (!button) return;
    choose(button.dataset.id, { profile: button.dataset.id === state.id });
  });

  document.querySelector("#detail").addEventListener("click", (event) => {
    if (event.target.closest("[data-close]")) {
      closeDetail();
      return;
    }
    const button = event.target.closest("[data-id]");
    if (button) choose(button.dataset.id);
  });

  document.querySelector("#scrim").addEventListener("click", closeDetail);
  document.querySelector("#now").addEventListener("click", (event) => {
    if (event.target.closest("button")) openDetail();
  });

  input.addEventListener("input", onSearch);
  input.addEventListener("keydown", onSearchKey);
  suggest.addEventListener("mousedown", (event) => event.preventDefault());
  suggest.addEventListener("click", (event) => {
    const button = event.target.closest("[data-id]");
    if (button) choose(button.dataset.id, { clearSearch: true });
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".search")) suggest.hidden = true;
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "/" && document.activeElement !== input) {
      event.preventDefault();
      input.focus();
    }
    if (event.key === "Escape") {
      suggest.hidden = true;
      closeDetail();
    }
  });
  window.addEventListener("popstate", () => {
    const id = readHash();
    if (state.index.byId.has(id)) {
      state.id = id;
      render();
    }
  });
  window.addEventListener("resize", () => {
    syncHeaderHeight();
    if (state.view === "tree") redrawTree(document.querySelector("#view-tree"));
  });
}

function choose(id, opts = {}) {
  if (!state.index.byId.has(id)) return;
  if (opts.clearSearch) {
    input.value = "";
    suggest.hidden = true;
  }
  if (opts.profile && window.matchMedia("(max-width: 860px)").matches) openDetail();
  setFocus(id, "push");
}

function setFocus(id, mode) {
  if (id && !state.index.byId.has(id)) return;
  const changed = state.id !== id;
  state.id = id;
  const hash = id ? `#${encodeURIComponent(id)}` : location.pathname;
  if (mode === "push" && changed && id) history.pushState({ id }, "", hash);
  if (mode === "replace") history.replaceState({ id }, "", hash);
  render();
}

function render() {
  const { index, id } = state;
  const person = index.byId.get(id);
  document.title = person ? `${displayName(person)} · ${index.title}` : index.title;
  for (const button of document.querySelectorAll(".switch button")) {
    button.setAttribute("aria-pressed", button.dataset.view === state.view ? "true" : "false");
  }
  const tree = document.querySelector("#view-tree");
  const lineage = document.querySelector("#view-lineage");
  const directory = document.querySelector("#view-directory");
  const caption = document.querySelector("#caption");
  tree.hidden = state.view !== "tree";
  lineage.hidden = state.view !== "lineage";
  directory.hidden = state.view !== "directory";
  caption.hidden = state.view !== "tree" || !id;
  caption.textContent = id ? treeCaption(index, id) : "";

  if (state.view === "tree") renderTree(tree, index, id);
  if (state.view === "lineage") {
    renderLineage(lineage, {
      index,
      branchId: state.branchId,
      currentId: id,
      onSelect: (next) => choose(next),
      onBranch: (branchId) => {
        state.branchId = branchId;
        render();
      },
      lineOf: (personId) => index.canonicalBranch(index.topAncestor(personId)),
    });
  }
  if (state.view === "directory") {
    renderDirectory(directory, {
      people: index.people,
      currentId: id,
      livingOnly: state.livingOnly,
      query: input.value,
      onSelect: (next) => choose(next),
      onLivingOnly: (value) => {
        state.livingOnly = value;
        render();
      },
    });
  }

  renderPanel(document.querySelector("#detail"), index, id);
  renderNow(index, id);
  document.querySelector("#detail").classList.toggle("is-open", state.detailOpen);
  document.querySelector("#scrim").hidden = !state.detailOpen;
  document.body.classList.toggle("sheet-open", state.detailOpen);
  syncHeaderHeight();
}

function renderNow(index, id) {
  const person = index.byId.get(id);
  const bar = document.querySelector("#now");
  if (!person) {
    bar.innerHTML = "";
    return;
  }
  bar.innerHTML = `
    ${avatarHTML(person, "sm")}
    <span class="card-text">
      <span class="name" dir="auto">${esc(displayName(person))}</span>
      <span class="meta">${esc(isLiving(person) ? "Living" : "Deceased")}${yearsHTML(person) ? ` · ${yearsHTML(person)}` : ""}</span>
    </span>
    <button type="button" class="ghost">Profile</button>
  `;
}

function renderBanner(index) {
  const banner = document.querySelector("#banner");
  if (!index.sample || sessionStorage.getItem("ft-sample-dismissed") === "1") return;
  banner.hidden = false;
  banner.innerHTML = `
    <p>These people are a sample, so the tree is not empty. Edit <code>data/family.json</code>, then remove <code>"sample": true</code>.</p>
    <button type="button" class="ghost" id="dismiss">Dismiss</button>
  `;
  banner.querySelector("#dismiss").addEventListener("click", () => {
    sessionStorage.setItem("ft-sample-dismissed", "1");
    banner.hidden = true;
  });
}

function renderIssues(index) {
  const box = document.querySelector("#issues");
  if (!index.issues.length) return;
  const shown = index.issues.slice(0, 12);
  const more = index.issues.length - shown.length;
  box.hidden = false;
  box.innerHTML = `
    <p><strong>Check the register.</strong> ${index.issues.length} ${index.issues.length === 1 ? "problem" : "problems"} in data/family.json.</p>
    <ul>${shown.map((issue) => `<li>${esc(issue)}</li>`).join("")}</ul>
    ${more > 0 ? `<p>${more} more.</p>` : ""}
  `;
}

function onSearch() {
  const query = input.value.trim();
  highlighted = -1;
  if (state.view === "directory") render();
  if (!query) {
    suggest.hidden = true;
    suggest.innerHTML = "";
    return;
  }
  const matches = state.index.search(query).slice(0, 8);
  if (!matches.length) {
    suggest.hidden = false;
    suggest.innerHTML = `<p class="empty slim">No one by that name.</p>`;
    return;
  }
  suggest.hidden = false;
  suggest.innerHTML = matches.map((person) => `
    <button type="button" data-id="${esc(person.id)}">
      <span dir="auto">${esc(displayName(person))}</span>
      <span class="meta">${metaHTML(person, person.place ? [person.place] : [])}</span>
    </button>
  `).join("");
}

function onSearchKey(event) {
  const buttons = [...suggest.querySelectorAll("button")];
  if (event.key === "ArrowDown" && buttons.length) {
    event.preventDefault();
    highlighted = Math.min(buttons.length - 1, highlighted + 1);
  } else if (event.key === "ArrowUp" && buttons.length) {
    event.preventDefault();
    highlighted = Math.max(0, highlighted - 1);
  } else if (event.key === "Enter") {
    event.preventDefault();
    const pick = buttons[highlighted] || buttons[0];
    if (pick) choose(pick.dataset.id, { clearSearch: true });
    return;
  } else if (event.key === "Escape") {
    suggest.hidden = true;
    return;
  } else {
    return;
  }
  buttons.forEach((button, index) => button.classList.toggle("is-hi", index === highlighted));
  buttons[highlighted]?.scrollIntoView({ block: "nearest" });
}

function openDetail() {
  state.detailOpen = true;
  document.querySelector("#detail").classList.add("is-open");
  document.querySelector("#scrim").hidden = false;
  document.body.classList.add("sheet-open");
}

function closeDetail() {
  state.detailOpen = false;
  document.querySelector("#detail").classList.remove("is-open");
  document.querySelector("#scrim").hidden = true;
  document.body.classList.remove("sheet-open");
}

function readHash() {
  const raw = location.hash.replace(/^#/, "");
  if (!raw) return "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function syncHeaderHeight() {
  const header = document.querySelector(".top");
  if (header) document.documentElement.style.setProperty("--top-h", `${header.offsetHeight}px`);
}

function showFatal(error) {
  document.body.innerHTML = `<main class="fatal"><h1>The register could not be read</h1><p>${esc(error.message)}</p></main>`;
}

function registerInstall() {
  const button = document.querySelector("#install");
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    button.hidden = false;
    button.addEventListener("click", async () => {
      button.hidden = true;
      await event.prompt();
    }, { once: true });
  });
}

function registerWorker() {
  const host = location.hostname;
  if (host === "localhost" || host === "127.0.0.1") return;
  if (!("serviceWorker" in navigator)) return;
  const register = () => navigator.serviceWorker.register("./sw.js").catch(() => {});
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register);
}

main();
