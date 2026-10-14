export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[ch]));
}

export function displayName(person) {
  const name = String(person?.name || "").trim();
  return name || "Unnamed";
}

export function shortName(person) {
  return displayName(person).split(/\s+/)[0] || "Unnamed";
}

export function isLiving(person) {
  if (typeof person?.living === "boolean") return person.living;
  return !String(person?.death || "").trim();
}

export function yearText(value) {
  const match = String(value || "").match(/\d{4}/);
  return match ? match[0] : "";
}

export function parseYear(value) {
  const year = yearText(value);
  return year ? Number(year) : 9999;
}

export function comparePeople(a, b) {
  const year = parseYear(a?.birth) - parseYear(b?.birth);
  if (year !== 0) return year;
  return displayName(a).localeCompare(displayName(b), undefined, { sensitivity: "base" });
}

export function lifeLine(person) {
  const birth = yearText(person?.birth);
  const death = yearText(person?.death);
  if (isLiving(person)) return birth ? `${birth}-` : "";
  if (birth && death) return `${birth}-${death}`;
  if (birth) return `${birth}-`;
  if (death) return `-${death}`;
  return "";
}

export function lifeDetail(person) {
  const birth = String(person?.birth || "").trim();
  const death = String(person?.death || "").trim();
  if (isLiving(person)) return birth ? `${birth}-` : "";
  if (birth && death) return `${birth} – ${death}`;
  if (birth) return `${birth}-`;
  if (death) return death;
  return "";
}

export function yearsHTML(person) {
  const line = lifeLine(person);
  return line ? `<span class="years">${esc(line)}</span>` : "";
}

export function lifeDetailHTML(person) {
  const line = lifeDetail(person);
  return line ? `<span class="years">${esc(line)}</span>` : "";
}

export function metaHTML(person, notes = []) {
  const bits = [yearsHTML(person), ...notes.filter(Boolean).map((note) => esc(note))];
  return bits.join(" · ");
}

export function isPet(person) {
  return person?.kind === "pet";
}

export function speciesLabel(person) {
  if (person?.species === "cat") return "cat";
  if (person?.species === "dog") return "dog";
  if (person?.species === "bird") return "bird";
  if (isPet(person)) return "pet";
  return "";
}

export function childWord(person) {
  if (isPet(person)) return speciesLabel(person) || "pet";
  if (person?.gender === "female") return "daughter";
  if (person?.gender === "male") return "son";
  return "child";
}

export function shareLabel(person, other) {
  const sameFather = person.father && person.father === other.father;
  const sameMother = person.mother && person.mother === other.mother;
  if (sameFather && sameMother) return "";
  if (sameFather) return "Same father";
  if (sameMother) return "Same mother";
  return "";
}

export function initials(person) {
  const parts = displayName(person).split(/\s+/).filter(Boolean).slice(0, 2);
  if (!parts.length) return "?";
  if (parts.length === 1) return [...parts[0]].slice(0, 2).join("").toUpperCase();
  return parts.map((part) => [...part][0] || "").join("").toUpperCase();
}

export function sealColor(id) {
  let hash = 0;
  const key = String(id || "");
  for (let i = 0; i < key.length; i += 1) hash = (hash * 33 + key.charCodeAt(i)) >>> 0;
  return `hsl(${hash % 360} 28% 34%)`;
}

export function safePhoto(src) {
  if (!src || typeof src !== "string") return "";
  const value = src.trim();
  if (!value || /^javascript:/i.test(value)) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/") || value.includes("..") || value.includes("\\")) return "";
  return value;
}

export function avatarHTML(person, size) {
  const letters = esc(initials(person));
  const color = sealColor(person.id);
  const pet = isPet(person);
  const sizeCls = size === "lg" ? " lg" : size === "sm" ? " sm" : "";
  const cls = `avatar${sizeCls}${pet ? " pet" : ""}`;
  const photo = safePhoto(person.photo);
  const px = size === "lg" ? 112 : size === "sm" ? 32 : 44;
  let inner;
  if (photo) {
    inner = `<img src="${esc(photo)}" alt="" width="${px}" height="${px}" decoding="async" loading="lazy">`;
  } else if (pet) {
    inner = petIcon(person.species);
  } else {
    inner = letters;
  }
  return `<span class="${cls}" style="background:${color}" data-initials="${letters}" aria-hidden="true">${inner}</span>`;
}

function petIcon(species) {
  if (species === "dog") {
    return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5.5 10.5c-.8-1.8.2-3.7 2-3.7.7 0 1.3.3 1.8.8L10 8.3c.4-.5 1-.8 1.7-.8.8 0 1.5.4 1.9 1.1.5-.7 1.3-1.1 2.2-1.1 1.8 0 2.8 1.9 2 3.7-.3.7-.8 1.2-1.4 1.5v1.8c0 2.2-1.8 4-4 4h-.8c-2.2 0-4-1.8-4-4v-1.8c-.6-.3-1.1-.8-1.4-1.5Z" fill="currentColor" opacity=".95"/><circle cx="10.2" cy="12.2" r=".7" fill="#241c16"/><circle cx="13.8" cy="12.2" r=".7" fill="#241c16"/><path d="M11.2 14.2c.5.4 1.1.4 1.6 0" stroke="#241c16" stroke-width="1" stroke-linecap="round"/></svg>`;
  }
  if (species === "bird") {
    return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4.5 13.5c2.2-1.2 4-1.8 6.2-1.8 1.4 0 2.6.3 3.8.9L18 10c1.2-.7 2.6.2 2.3 1.6l-.8 3.2c-.3 1.2-1.3 2.1-2.5 2.3l-2 .3c-1.5.3-3 .1-4.3-.5-1.8-.8-3.4-1.5-6.2-1.9Z" fill="currentColor"/><circle cx="16.2" cy="11.2" r=".8" fill="#241c16"/><path d="M8.5 16.5c1.2 1.4 2.8 2.2 4.7 2.2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`;
  }
  // cat (default pet)
  return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5.2 9.2 3.8 4.8c-.2-.6.4-1.1.9-.8L8 6.2c.9-.4 1.9-.6 3-.6s2.1.2 3 .6l3.3-2.2c.5-.3 1.1.2.9.8l-1.4 4.4C18.2 11 19 13 19 15.2 19 18.4 16.1 21 12 21s-7-2.6-7-5.8c0-2.2.8-4.2 2.2-6Z" fill="currentColor"/><circle cx="9.2" cy="13.2" r="1" fill="#241c16"/><circle cx="14.8" cy="13.2" r="1" fill="#241c16"/><path d="M10.4 16.2c.9.7 2.3.7 3.2 0" stroke="#241c16" stroke-width="1.2" stroke-linecap="round"/><path d="M12 14.2v1.2" stroke="#241c16" stroke-width="1.2" stroke-linecap="round"/></svg>`;
}
