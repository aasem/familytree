import { avatarHTML, displayName, esc, isLiving, isPet, metaHTML, speciesLabel } from "./format.js";

const handlers = { onSelect() {}, onLivingOnly() {} };

export function renderDirectory(host, opts) {
  handlers.onSelect = opts.onSelect;
  handlers.onLivingOnly = opts.onLivingOnly;

  if (host.dataset.ready !== "1") {
    host.innerHTML = `
      <div class="dir-tools">
        <label class="check"><input id="living-only" type="checkbox"> Living only</label>
      </div>
      <div class="alpha"></div>
      <div class="dir-list"></div>
    `;
    host.dataset.ready = "1";
    host.querySelector("#living-only").addEventListener("change", (event) => {
      handlers.onLivingOnly(event.target.checked);
    });
    host.addEventListener("click", (event) => {
      const letter = event.target.closest("[data-letter]");
      if (letter) {
        host.querySelector(`#${letter.dataset.letter}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      const entry = event.target.closest("[data-id]");
      if (entry) handlers.onSelect(entry.dataset.id);
    });
  }

  host.querySelector("#living-only").checked = opts.livingOnly;
  const filtered = opts.people
    .filter((person) => (opts.livingOnly ? isLiving(person) : true))
    .filter((person) => {
      const needle = opts.query.trim().toLowerCase();
      if (!needle) return true;
      return [person.name, person.place, person.bio, person.birth, person.death, person.species, isPet(person) ? "pet" : ""]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    })
    .sort((a, b) => displayName(a).localeCompare(displayName(b), undefined, { sensitivity: "base" }));

  const groups = new Map();
  for (const person of filtered) {
    const glyph = [...displayName(person)][0] || "#";
    const key = /\p{L}|\p{N}/u.test(glyph) ? glyph.toLocaleUpperCase() : "#";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(person);
  }

  const letters = [...groups.keys()];
  host.querySelector(".alpha").innerHTML = letters.map((letter, index) => (
    `<button type="button" data-letter="letter-${index}">${esc(letter)}</button>`
  )).join("");

  const list = host.querySelector(".dir-list");
  if (!filtered.length) {
    list.innerHTML = `<p class="empty">No one matches.</p>`;
    return;
  }
  list.innerHTML = letters.map((letter, index) => `
    <section class="letter" id="letter-${index}">
      <h2>${esc(letter)}</h2>
      <div class="dir-grid">
        ${groups.get(letter).map((person) => entry(person, opts.currentId)).join("")}
      </div>
    </section>
  `).join("");
}

function entry(person, currentId) {
  const living = isLiving(person);
  const extras = [
    isPet(person) ? speciesLabel(person) : "",
    person.place,
  ].filter(Boolean);
  return `<button type="button" class="entry${person.id === currentId ? " is-current" : ""}" data-id="${esc(person.id)}" data-kind="${isPet(person) ? "pet" : "person"}" data-living="${living ? "true" : "false"}">
    ${avatarHTML(person, "sm")}
    <span class="card-text">
      <span class="name" dir="auto">${esc(displayName(person))}</span>
      <span class="meta">${metaHTML(person, extras)}</span>
    </span>
  </button>`;
}
