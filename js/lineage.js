import { comparePeople, displayName, esc, isLiving, lifeLine, shortName, yearsHTML } from "./format.js";
import { layoutClan } from "./layout.js";

const COL = 176;
const ROW = 118;
const CARD_W = 158;
const CARD_H = 64;
const handlers = { onSelect() {}, onBranch() {}, lineOf() { return ""; } };
let builtFor = "";
const view = { scale: 1, x: 24, y: 24 };

export function renderLineage(host, opts) {
  handlers.onSelect = opts.onSelect;
  handlers.onBranch = opts.onBranch;
  handlers.lineOf = opts.lineOf;

  if (host.dataset.ready !== "1") {
    host.innerHTML = `
      <div class="lineage-bar">
        <label class="branch">
          <span>Branch</span>
          <select></select>
        </label>
        <p class="lineage-note" hidden></p>
        <div class="zoom">
          <button type="button" data-zoom="in" aria-label="Zoom in">+</button>
          <button type="button" data-zoom="out" aria-label="Zoom out">−</button>
          <button type="button" data-zoom="fit">Fit</button>
        </div>
      </div>
      <div class="viewport" tabindex="0">
        <p class="hint">Drag to move. Scroll to zoom.</p>
        <div class="world"></div>
      </div>
    `;
    host.dataset.ready = "1";
    bind(host);
  }

  const select = host.querySelector("select");
  const options = opts.index.branches.slice();
  if (opts.branchId && !options.some((branch) => branch.id === opts.branchId)) {
    const person = opts.index.byId.get(opts.branchId);
    if (person) options.unshift({ id: person.id, label: displayName(person), count: opts.index.childrenOf(person.id).length });
  }
  const signature = options.map((branch) => `${branch.id}:${branch.count}`).join("|");
  if (select.dataset.signature !== signature) {
    select.innerHTML = options.map((branch) => {
      const noun = branch.count === 1 ? "descendant" : "descendants";
      return `<option value="${esc(branch.id)}">${esc(branch.label)} · ${branch.count} ${noun}</option>`;
    }).join("");
    select.dataset.signature = signature;
  }
  if (select.value !== opts.branchId) select.value = opts.branchId;

  if (!opts.branchId || !opts.index.byId.has(opts.branchId)) {
    host.querySelector(".world").innerHTML = `<p class="empty">Add a parent link in data/family.json to grow a branch.</p>`;
    builtFor = "";
    return;
  }

  if (builtFor !== opts.branchId) {
    buildWorld(host, opts.index, opts.branchId);
    builtFor = opts.branchId;
    fit(host);
  }
  paintSelection(host, opts.index, opts.currentId);
}

function bind(host) {
  const viewport = host.querySelector(".viewport");
  const select = host.querySelector("select");
  let dragging = false;
  let moved = false;
  let start = { x: 0, y: 0, ox: 0, oy: 0 };

  select.addEventListener("change", () => handlers.onBranch(select.value));
  host.querySelector(".zoom").addEventListener("click", (event) => {
    const button = event.target.closest("[data-zoom]");
    if (!button) return;
    if (button.dataset.zoom === "fit") {
      fit(host);
      return;
    }
    const rect = viewport.getBoundingClientRect();
    const factor = button.dataset.zoom === "in" ? 1.15 : 0.87;
    zoomAt(viewport, rect.left + rect.width / 2, rect.top + rect.height / 2, view.scale * factor);
  });

  viewport.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    dragging = true;
    moved = false;
    start = { x: event.clientX, y: event.clientY, ox: view.x, oy: view.y };
    viewport.setPointerCapture(event.pointerId);
    viewport.classList.add("is-grabbing");
  });
  viewport.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (!moved && Math.hypot(dx, dy) < 4) return;
    moved = true;
    view.x = start.ox + dx;
    view.y = start.oy + dy;
    apply(host);
  });
  const endDrag = () => {
    dragging = false;
    viewport.classList.remove("is-grabbing");
  };
  viewport.addEventListener("pointerup", endDrag);
  viewport.addEventListener("pointercancel", endDrag);
  viewport.addEventListener("click", (event) => {
    if (moved) {
      moved = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const button = event.target.closest(".node");
    if (!button) return;
    handlers.onSelect(button.dataset.id);
  });
  viewport.addEventListener("wheel", (event) => {
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.08 : 0.92;
    zoomAt(viewport, event.clientX, event.clientY, view.scale * factor);
  }, { passive: false });

  const note = host.querySelector(".lineage-note");
  note.addEventListener("click", (event) => {
    const button = event.target.closest("[data-jump]");
    if (!button) return;
    handlers.onBranch(button.dataset.jump);
  });
}

function buildWorld(host, index, branchId) {
  const childMap = clanChildren(index, branchId);
  const { nodes, parentOf } = layoutClan(branchId, (id) => childMap.get(id) || []);
  const world = host.querySelector(".world");
  const maxX = nodes.reduce((max, node) => Math.max(max, node.x), 0);
  const maxDepth = nodes.reduce((max, node) => Math.max(max, node.depth), 0);
  const width = maxX * COL + CARD_W / 2 + 24;
  const height = maxDepth * ROW + CARD_H + 36;
  world.dataset.width = String(width);
  world.dataset.height = String(height);
  world._parentOf = parentOf;

  const lines = [];
  const byId = new Map(nodes.map((node) => [node.id, node]));
  for (const node of nodes) {
    const parent = parentOf.get(node.id);
    if (!parent || !byId.has(parent)) continue;
    const from = byId.get(parent);
    const x1 = from.x * COL;
    const y1 = from.depth * ROW + 12 + CARD_H;
    const x2 = node.x * COL;
    const y2 = node.depth * ROW + 12;
    const mid = (y1 + y2) / 2;
    lines.push(`M ${x1} ${y1} V ${mid} H ${x2} V ${y2}`);
  }

  const buttons = nodes.map((node) => {
    const person = index.byId.get(node.id);
    const meta = nodeMeta(person, index);
    const living = isLiving(person);
    return `<button type="button" class="node" data-id="${esc(person.id)}" data-living="${living ? "true" : "false"}" style="left:${node.x * COL}px;top:${node.depth * ROW + 12}px" title="${esc(displayName(person))}${meta ? ` — ${esc(meta)}` : ""}">
      <span class="node-name" dir="auto">${esc(displayName(person))}</span>
      <span class="node-meta">${nodeMetaHTML(person, index)}</span>
    </button>`;
  });

  world.innerHTML = `
    <svg class="lineage-wires" width="${width}" height="${height}" aria-hidden="true">
      ${lines.map((d) => `<path d="${d}"/>`).join("")}
    </svg>
    ${buttons.join("")}
  `;
  world._ids = new Set(nodes.map((node) => node.id));
  const overlaps = countOverlaps(nodes);
  if (overlaps) console.warn(`Lineage layout has ${overlaps} overlapping cards`);
}

function paintSelection(host, index, currentId) {
  const world = host.querySelector(".world");
  const parentOf = world._parentOf || new Map();
  const ids = world._ids || new Set();
  const path = new Set();
  let cursor = ids.has(currentId) ? currentId : "";
  const guard = new Set();
  while (cursor && !guard.has(cursor)) {
    guard.add(cursor);
    path.add(cursor);
    cursor = parentOf.get(cursor);
  }
  for (const node of world.querySelectorAll(".node")) {
    node.classList.toggle("is-current", node.dataset.id === currentId);
    node.classList.toggle("is-path", path.has(node.dataset.id));
  }
  if (ids.has(currentId)) ensureVisible(host, currentId);

  const note = host.querySelector(".lineage-note");
  if (!ids.has(currentId)) {
    const jump = handlers.lineOf(currentId);
    const person = index.byId.get(currentId);
    const name = person ? displayName(person) : "This person";
    if (jump && jump !== host.querySelector("select").value) {
      note.innerHTML = `${esc(name)} is on another line. <button type="button" data-jump="${esc(jump)}">Show that line</button>`;
    } else {
      note.textContent = `${name} is linked by marriage, not by this bloodline.`;
    }
    note.hidden = false;
  } else {
    note.hidden = true;
    note.innerHTML = "";
  }
}

function clanChildren(index, rootId) {
  const inTree = new Set();
  const queue = [rootId];
  while (queue.length) {
    const id = queue.pop();
    if (!id || inTree.has(id)) continue;
    inTree.add(id);
    for (const child of index.childrenOf(id)) queue.push(child.id);
  }
  const map = new Map();
  for (const id of inTree) map.set(id, []);
  for (const id of inTree) {
    if (id === rootId) continue;
    const person = index.byId.get(id);
    const fatherIn = person.father && inTree.has(person.father) ? person.father : "";
    const motherIn = person.mother && inTree.has(person.mother) ? person.mother : "";
    const parent = fatherIn && motherIn ? fatherIn : (fatherIn || motherIn);
    if (parent && map.has(parent)) map.get(parent).push(id);
  }
  for (const kids of map.values()) {
    kids.sort((a, b) => comparePeople(index.byId.get(a), index.byId.get(b)));
  }
  return map;
}

function nodeMeta(person, index) {
  const years = lifeLine(person);
  const withText = index.spousesOf(person.id).map((spouse) => shortName(spouse)).join(", ");
  if (years && withText) return `${years} · ${withText}`;
  return years || withText;
}

function nodeMetaHTML(person, index) {
  const withText = index.spousesOf(person.id).map((spouse) => shortName(spouse)).join(", ");
  const bits = [yearsHTML(person), withText ? esc(withText) : ""].filter(Boolean);
  return bits.join(" · ");
}

function ensureVisible(host, id) {
  const viewport = host.querySelector(".viewport");
  const node = [...host.querySelectorAll(".node")].find((item) => item.dataset.id === id);
  if (!viewport || !node) return;
  const rect = node.getBoundingClientRect();
  const box = viewport.getBoundingClientRect();
  const inside = rect.left >= box.left + 12
    && rect.right <= box.right - 12
    && rect.top >= box.top + 12
    && rect.bottom <= box.bottom - 12;
  if (inside || rect.width === 0) return;
  const worldX = Number.parseFloat(node.style.left);
  const worldY = Number.parseFloat(node.style.top) + 32;
  view.x = viewport.clientWidth / 2 - worldX * view.scale;
  view.y = viewport.clientHeight / 2 - worldY * view.scale;
  apply(host);
}

function countOverlaps(nodes) {
  const rows = new Map();
  for (const node of nodes) {
    if (!rows.has(node.depth)) rows.set(node.depth, []);
    rows.get(node.depth).push(node);
  }
  let overlaps = 0;
  for (const row of rows.values()) {
    row.sort((a, b) => a.x - b.x);
    for (let i = 1; i < row.length; i += 1) {
      if (row[i].x * COL < row[i - 1].x * COL + CARD_W - 1) overlaps += 1;
    }
  }
  return overlaps;
}

function apply(host) {
  const world = host.querySelector(".world");
  world.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.scale})`;
}

function fit(host) {
  const viewport = host.querySelector(".viewport");
  const world = host.querySelector(".world");
  const width = Number(world.dataset.width || viewport.clientWidth);
  const height = Number(world.dataset.height || viewport.clientHeight);
  const pad = 36;
  const scale = Math.min(1, (viewport.clientWidth - pad) / width, (viewport.clientHeight - pad) / height);
  view.scale = Number.isFinite(scale) && scale > 0 ? Math.max(0.2, scale) : 1;
  view.x = Math.max(16, (viewport.clientWidth - width * view.scale) / 2);
  view.y = Math.max(16, (viewport.clientHeight - height * view.scale) / 2);
  apply(host);
}

function zoomAt(viewport, clientX, clientY, nextScale) {
  const rect = viewport.getBoundingClientRect();
  const px = clientX - rect.left;
  const py = clientY - rect.top;
  const worldX = (px - view.x) / view.scale;
  const worldY = (py - view.y) / view.scale;
  view.scale = Math.min(1.8, Math.max(0.15, nextScale));
  view.x = px - worldX * view.scale;
  view.y = py - worldY * view.scale;
  apply(viewport.parentElement);
}
