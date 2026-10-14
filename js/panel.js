import {
  avatarHTML,
  displayName,
  esc,
  isLiving,
  isPet,
  lifeDetailHTML,
  metaHTML,
  shareLabel,
  speciesLabel,
} from "./format.js";

export function renderPanel(host, index, id) {
  const person = index.byId.get(id);
  if (!person) {
    host.innerHTML = "";
    return;
  }
  const living = isLiving(person);
  const status = living ? "Living" : "Deceased";
  const dates = lifeDetailHTML(person);
  const kindNote = isPet(person) ? speciesLabel(person) : "";
  const notes = [kindNote, person.place].filter(Boolean);
  host.innerHTML = `
    <button type="button" class="close" data-close aria-label="Close profile">Close</button>
    <header class="person" data-living="${living ? "true" : "false"}" data-kind="${isPet(person) ? "pet" : "person"}">
      ${avatarHTML(person, "lg")}
      <h2 dir="auto">${esc(displayName(person))}</h2>
      <p class="meta">${esc(status)}${dates ? ` · ${dates}` : ""}${notes.map((note) => ` · ${esc(note)}`).join("")}</p>
    </header>
    ${person.bio ? `<p class="bio" dir="auto">${esc(person.bio)}</p>` : `<p class="bio muted">No biography yet.</p>`}
    ${isPet(person) ? petSections(index, id) : personSections(index, id, person)}
  `;
}

function personSections(index, id, person) {
  return `
    ${section("Parents", index.parentsOf(id))}
    ${section("Spouses", index.spousesOf(id))}
    ${section("Siblings", index.siblingsOf(id), person)}
    ${section("Children", index.childrenOf(id))}
    ${section("Pets", index.petsOf(id))}
  `;
}

function petSections(index, id) {
  return `${section("Owners", index.ownersOf(id))}`;
}

function section(title, people, focus) {
  if (!people.length) return "";
  return `<section class="rels">
    <h3>${title}</h3>
    <div class="rel-list">
      ${people.map((person) => {
        const note = focus ? shareLabel(focus, person) : "";
        const extras = [
          isPet(person) ? speciesLabel(person) : "",
          note,
        ].filter(Boolean);
        return `<button type="button" class="rel" data-id="${esc(person.id)}" data-kind="${isPet(person) ? "pet" : "person"}">
          ${avatarHTML(person, "sm")}
          <span class="card-text">
            <span class="name" dir="auto">${esc(displayName(person))}</span>
            <span class="meta">${metaHTML(person, extras)}</span>
          </span>
        </button>`;
      }).join("")}
    </div>
  </section>`;
}
