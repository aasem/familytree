import {
  avatarHTML,
  childWord,
  comparePeople,
  displayName,
  esc,
  isLiving,
  isPet,
  lifeLine,
  metaHTML,
  shareLabel,
  shortName,
  speciesLabel,
} from "./format.js";

const SVG_NS = "http://www.w3.org/2000/svg";

export function treeCaption(index, id) {
  const person = index.byId.get(id);
  if (!person) return "";
  const who = displayName(person);
  if (isPet(person)) {
    const owners = index.ownersOf(id);
    const word = speciesLabel(person) || "pet";
    if (owners.length === 2) {
      return `${who}, ${word} of ${displayName(owners[0])} and ${displayName(owners[1])}`;
    }
    if (owners.length === 1) return `${who}, ${word} of ${displayName(owners[0])}`;
    if (owners.length > 2) {
      return `${who}, ${word} of ${owners.map((owner) => displayName(owner)).join(", ")}`;
    }
    return `${who} (${word})`;
  }
  const parents = index.parentsOf(id);
  const word = childWord(person);
  if (parents.length === 2) {
    return `${who}, ${word} of ${displayName(parents[0])} and ${displayName(parents[1])}`;
  }
  if (parents.length === 1) return `${who}, ${word} of ${displayName(parents[0])}`;
  return who;
}

export function renderTree(host, index, id) {
  const person = index.byId.get(id);
  if (!index.people.length) {
    host.innerHTML = `<p class="empty">Add people to data/family.json and this tree will fill in.</p>`;
    return;
  }
  if (!person) {
    host.innerHTML = `<p class="empty">This person is not in the register.</p>`;
    return;
  }

  if (isPet(person)) {
    host.innerHTML = `
      <div class="board">
        <svg class="wires" aria-hidden="true"></svg>
        ${petTreeHTML(index, person)}
      </div>
    `;
    requestAnimationFrame(() => {
      const board = host.querySelector(".board");
      if (board) {
        drawWires(board);
        centerFocus(host);
      }
    });
    return;
  }

  const half = index.halfSiblings(id);
  const halfHTML = half.length
    ? `<div class="half">${half.map((sibling) => chip(sibling, shareLabel(person, sibling))).join("")}</div>`
    : "";

  host.innerHTML = `
    ${halfHTML}
    <div class="board">
      <svg class="wires" aria-hidden="true"></svg>
      ${ancestorHTML(index, person)}
      ${selfHTML(index, person)}
      ${childrenHTML(index, person)}
      ${petsHTML(index, person)}
    </div>
  `;
  requestAnimationFrame(() => {
    const board = host.querySelector(".board");
    if (board) {
      drawWires(board);
      centerFocus(host);
    }
  });
}

export function redrawTree(host) {
  const board = host.querySelector(".board");
  if (board && host.offsetParent !== null && !host.hidden) drawWires(board);
}

function ancestorHTML(index, person) {
  const father = person.father ? index.byId.get(person.father) : null;
  const mother = person.mother ? index.byId.get(person.mother) : null;
  const columns = [
    parentColumn(index, father, "father", "paternal"),
    parentColumn(index, mother, "mother", "maternal"),
  ].filter(Boolean);
  if (!columns.length) return "";
  return `<div class="ancestor">${columns.join("")}</div>`;
}

function parentColumn(index, parent, role, coupleName) {
  if (!parent) return "";
  const grandparents = index.parentsOf(parent.id);
  const elders = grandparents.length
    ? `<div class="couple" data-couple="${coupleName}">${grandparents.map((elder) => card(elder, "elder")).join("")}</div>`
    : "";
  return `<div class="ancestor-col">${elders}${card(parent, role)}</div>`;
}

function selfHTML(index, person) {
  const siblings = index.fullSiblings(person.id);
  const older = siblings.filter((sibling) => comparePeople(sibling, person) < 0);
  const younger = siblings.filter((sibling) => comparePeople(sibling, person) >= 0);
  const spouses = index.spousesOf(person.id);
  const union = `
    <div class="union" data-union="focus">
      ${card(person, "focus")}
      ${spouses.length ? `<div class="spouse-col">${spouses.map((spouse) => card(spouse, "spouse")).join("")}</div>` : ""}
    </div>
  `;
  return `
    <div class="gen-row self-row">
      ${older.map((sibling) => card(sibling, "full-sibling")).join("")}
      ${union}
      ${younger.map((sibling) => card(sibling, "full-sibling")).join("")}
    </div>
  `;
}

function childrenHTML(index, person) {
  const groups = index.childGroups(person.id);
  if (!groups.length) return "";
  const several = groups.length > 1;
  const cards = groups.flatMap((group) => group.children.map((child) => {
    const notes = several && group.other ? [shortName(group.other)] : [];
    return card(child, "child", metaHTML(child, notes));
  }));
  return `<div class="gen-row descendants" data-groups="${groups.length}">${cards.join("")}</div>`;
}

function petsHTML(index, person) {
  const pets = index.petsOf(person.id);
  if (!pets.length) return "";
  return `<div class="gen-row pets-row" data-pets="${pets.length}">${pets.map((pet) => card(pet, "pet", metaHTML(pet, [speciesLabel(pet)]))).join("")}</div>`;
}

function petTreeHTML(index, pet) {
  const owners = index.ownersOf(pet.id);
  const ownerRow = owners.length
    ? `<div class="gen-row owner-row">${owners.map((owner) => card(owner, "owner")).join("")}</div>`
    : "";
  return `
    ${ownerRow}
    <div class="gen-row self-row">
      <div class="union" data-union="focus">${card(pet, "focus", metaHTML(pet, [speciesLabel(pet)]))}</div>
    </div>
  `;
}

function card(person, role, meta) {
  const living = isLiving(person);
  const current = role === "focus" ? ` aria-current="true"` : "";
  const years = lifeLine(person);
  const kind = isPet(person) ? "pet" : "person";
  const notes = meta || metaHTML(person, isPet(person) ? [speciesLabel(person)] : []);
  return `<button type="button" class="card${role === "focus" ? " is-focus" : ""}" data-id="${esc(person.id)}" data-role="${role}" data-kind="${kind}" data-living="${living ? "true" : "false"}"${current} title="${esc(displayName(person))}${years ? ` — ${esc(years)}` : ""}">
    ${avatarHTML(person)}
    <span class="card-text">
      <span class="name" dir="auto">${esc(displayName(person))}</span>
      <span class="meta">${notes}</span>
    </span>
  </button>`;
}

function chip(person, note) {
  return `<button type="button" class="chip" data-id="${esc(person.id)}">
    <span dir="auto">${esc(displayName(person))}</span>
    ${note ? `<span class="chip-note">${esc(note)}</span>` : ""}
  </button>`;
}

function centerFocus(host) {
  const cardEl = host.querySelector('[data-role="focus"]');
  if (!cardEl) return;
  const stageBox = host.getBoundingClientRect();
  const cardBox = cardEl.getBoundingClientRect();
  const delta = cardBox.left + cardBox.width / 2 - (stageBox.left + stageBox.width / 2);
  if (Math.abs(delta) > 8) host.scrollLeft += delta;

  const bar = document.querySelector("#now");
  const barSpace = bar && getComputedStyle(bar).display !== "none" ? bar.offsetHeight + 28 : 16;
  const headerBottom = document.querySelector(".top")?.getBoundingClientRect().bottom ?? 0;
  const box = cardEl.getBoundingClientRect();
  const topLimit = headerBottom + 12;
  const bottomLimit = window.innerHeight - barSpace;
  if (box.top < topLimit || box.bottom > bottomLimit) {
    const target = topLimit + Math.max(0, (bottomLimit - topLimit - box.height) / 2);
    window.scrollBy({ top: box.top - target, behavior: "auto" });
  }
}

export function drawWires(board) {
  const svg = board.querySelector(".wires");
  if (!svg || board.clientWidth === 0) return;
  const width = board.scrollWidth;
  const height = board.scrollHeight;
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  svg.replaceChildren();

  const point = (node, edge) => {
    let x = 0;
    let y = 0;
    let current = node;
    while (current && current !== board) {
      x += current.offsetLeft;
      y += current.offsetTop;
      current = current.offsetParent;
    }
    const w = node.offsetWidth;
    const h = node.offsetHeight;
    if (edge === "bottom") return [x + w / 2, y + h];
    if (edge === "top") return [x + w / 2, y];
    if (edge === "left") return [x, y + h / 2];
    if (edge === "right") return [x + w, y + h / 2];
    return [x + w / 2, y + h / 2];
  };

  const add = (d, kind) => {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", d);
    path.setAttribute("class", kind || "descent");
    svg.append(path);
  };

  const marry = (a, b) => {
    if (!a || !b) return null;
    const aCenter = point(a, "center");
    const bCenter = point(b, "center");
    const left = aCenter[0] <= bCenter[0] ? a : b;
    const right = aCenter[0] <= bCenter[0] ? b : a;
    const [x1, y1] = point(left, "right");
    const [x2, y2] = point(right, "left");
    const y = (y1 + y2) / 2;
    add(`M ${round(x1)} ${round(y - 3)} H ${round(x2)}`, "marriage");
    add(`M ${round(x1)} ${round(y + 3)} H ${round(x2)}`, "marriage");
    return [(x1 + x2) / 2, y];
  };

  const bus = (origin, childNodes) => {
    if (!origin || !childNodes.length) return;
    const tops = childNodes.map((child) => point(child, "top"));
    const lowestOrigin = origin[1];
    const highestTop = Math.min(...tops.map((top) => top[1]));
    const busY = lowestOrigin < highestTop
      ? lowestOrigin + Math.max(16, (highestTop - lowestOrigin) / 2)
      : highestTop - 16;
    const xs = [origin[0], ...tops.map((top) => top[0])];
    add(`M ${round(origin[0])} ${round(origin[1])} V ${round(busY)}`);
    add(`M ${round(Math.min(...xs))} ${round(busY)} H ${round(Math.max(...xs))}`);
    for (const [x, y] of tops) add(`M ${round(x)} ${round(busY)} V ${round(y)}`);
  };

  const parentage = (adults, childNodes) => {
    const present = adults.filter(Boolean);
    const kids = childNodes.filter(Boolean);
    if (!present.length || !kids.length) return;
    if (present.length >= 2) bus(marry(present[0], present[1]), kids);
    else bus(point(present[0], "bottom"), kids);
  };

  for (const side of ["paternal", "maternal"]) {
    const couple = board.querySelector(`[data-couple="${side}"]`);
    const role = side === "paternal" ? "father" : "mother";
    const parent = board.querySelector(`[data-role="${role}"]`);
    if (couple && parent) parentage([...couple.querySelectorAll(".card")], [parent]);
  }

  const father = board.querySelector('[data-role="father"]');
  const mother = board.querySelector('[data-role="mother"]');
  const siblings = [...board.querySelectorAll('[data-role="full-sibling"], [data-role="focus"]')];
  if ((father || mother) && siblings.length) parentage([father, mother], siblings);

  const focus = board.querySelector('[data-role="focus"]');
  const spouseCards = [...board.querySelectorAll('[data-role="spouse"]')];
  const childCards = [...board.querySelectorAll('[data-role="child"]')];
  const petCards = [...board.querySelectorAll('[data-role="pet"]')];
  const ownerCards = [...board.querySelectorAll('[data-role="owner"]')];
  const groupCount = Number(board.querySelector(".descendants")?.dataset.groups || 0);
  if (focus && childCards.length === 0) {
    for (const spouse of spouseCards) marry(focus, spouse);
  } else if (focus && childCards.length && spouseCards.length === 1 && groupCount <= 1) {
    parentage([focus, spouseCards[0]], childCards);
  } else if (focus && childCards.length) {
    for (const spouse of spouseCards) marry(focus, spouse);
    const union = board.querySelector('[data-union="focus"]');
    bus(point(union || focus, "bottom"), childCards);
  }

  if (focus && petCards.length) {
    const origin = board.querySelector(".descendants")
      || board.querySelector('[data-union="focus"]')
      || focus;
    const before = svg.childElementCount;
    bus(point(origin, "bottom"), petCards);
    for (const path of [...svg.children].slice(before)) path.setAttribute("class", "pet");
  }

  if (focus && ownerCards.length) parentage(ownerCards, [focus]);
}

function round(value) {
  return Math.round(value);
}
