import { comparePeople, displayName, isLiving, isPet } from "./format.js";

export async function loadFamily(url) {
  let response;
  try {
    response = await fetch(url, { cache: "no-cache" });
  } catch {
    throw new Error("Could not fetch data/family.json. Open this site through a local server or GitHub Pages.");
  }
  if (!response.ok) throw new Error(`Could not load the family file (${response.status}).`);
  try {
    return createIndex(await response.json());
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error("data/family.json is not valid JSON.");
    throw error;
  }
}

export function createIndex(data) {
  if (!data || typeof data !== "object" || !Array.isArray(data.people)) {
    throw new Error("data/family.json needs a people array.");
  }

  const issues = [];
  const people = [];
  const seen = new Set();

  for (const raw of data.people) {
    if (!raw || typeof raw !== "object") {
      issues.push("Skipped an entry that is not a person.");
      continue;
    }
    const id = String(raw.id || "").trim();
    const name = String(raw.name || "").trim();
    if (!id) {
      issues.push(`Skipped ${name || "a person"} because the id is missing.`);
      continue;
    }
    if (seen.has(id)) {
      issues.push(`Duplicate id “${id}”. Later copies were skipped.`);
      continue;
    }
    seen.add(id);
    const kind = raw.kind === "pet" ? "pet" : "person";
    const species = kind === "pet" ? normalizeSpecies(raw.species) : "";
    const spouses = [...new Set(
      (Array.isArray(raw.spouses) ? raw.spouses : [])
        .map((item) => String(item || "").trim())
        .filter(Boolean),
    )];
    const owners = [...new Set(
      (Array.isArray(raw.owners) ? raw.owners : [])
        .map((item) => String(item || "").trim())
        .filter(Boolean),
    )];
    people.push({
      id,
      name,
      kind,
      species,
      gender: raw.gender === "male" || raw.gender === "female" ? raw.gender : "",
      living: typeof raw.living === "boolean" ? raw.living : undefined,
      birth: String(raw.birth || "").trim(),
      death: String(raw.death || "").trim(),
      place: String(raw.place || "").trim(),
      photo: String(raw.photo || "").trim(),
      bio: String(raw.bio || "").trim(),
      father: kind === "pet" ? "" : String(raw.father || "").trim(),
      mother: kind === "pet" ? "" : String(raw.mother || "").trim(),
      spouses: kind === "pet" ? [] : spouses,
      owners: kind === "pet" ? owners : [],
    });
  }

  const byId = new Map(people.map((person) => [person.id, person]));
  const humans = people.filter((person) => !isPet(person));
  const pets = people.filter((person) => isPet(person));

  for (const person of people) {
    if (!person.name) issues.push(`“${person.id}” has no name.`);
    if (isPet(person)) {
      if (!person.species) issues.push(`${displayName(person)} is a pet without a species (cat, dog, bird, or other).`);
      if (!person.owners.length) issues.push(`${displayName(person)} has no owners.`);
      for (const ownerId of person.owners) {
        if (ownerId === person.id) issues.push(`${displayName(person)} is listed as their own owner.`);
        else if (!byId.has(ownerId)) issues.push(`${displayName(person)} points at an unknown owner “${ownerId}”.`);
        else if (isPet(byId.get(ownerId))) issues.push(`${displayName(person)} lists another pet as an owner.`);
      }
      continue;
    }
    for (const [label, value] of [["father", person.father], ["mother", person.mother]]) {
      if (!value) continue;
      if (value === person.id) issues.push(`${displayName(person)} is listed as their own ${label}.`);
      else if (!byId.has(value)) issues.push(`${displayName(person)} points at an unknown ${label} “${value}”.`);
      else if (isPet(byId.get(value))) issues.push(`${displayName(person)} lists a pet as ${label}.`);
    }
    if (person.spouses.includes(person.id)) issues.push(`${displayName(person)} is listed as their own spouse.`);
    for (const spouseId of person.spouses) {
      if (!byId.has(spouseId)) issues.push(`${displayName(person)} points at an unknown spouse “${spouseId}”.`);
      else if (isPet(byId.get(spouseId))) issues.push(`${displayName(person)} lists a pet as a spouse.`);
    }
  }
  issues.push(...findCycles(humans, byId));

  const childrenById = new Map(people.map((person) => [person.id, []]));
  for (const person of humans) {
    for (const parentId of [person.father, person.mother]) {
      if (parentId && parentId !== person.id && childrenById.has(parentId) && !isPet(byId.get(parentId))) {
        childrenById.get(parentId).push(person.id);
      }
    }
  }
  for (const [id, kids] of childrenById) {
    kids.sort((a, b) => comparePeople(byId.get(a), byId.get(b)));
    childrenById.set(id, [...new Set(kids)]);
  }

  const counts = descendantCounts(humans, childrenById);
  const branches = buildBranches(humans, byId, childrenById, counts);

  let focusId = String(data.focusId || "").trim();
  if (!byId.has(focusId)) {
    if (focusId) issues.push(`focusId “${focusId}” does not match a person.`);
    focusId = humans[0]?.id || people[0]?.id || "";
  }

  function personList(ids) {
    return ids.map((id) => byId.get(id)).filter(Boolean);
  }

  function childrenOf(id) {
    return personList(childrenById.get(id) || []);
  }

  function spousesOf(id) {
    const person = byId.get(id);
    if (!person || isPet(person)) return [];
    const ids = new Set(person.spouses || []);
    for (const other of humans) {
      if (other.spouses.includes(id)) ids.add(other.id);
      if (other.father === id && other.mother && other.mother !== id) ids.add(other.mother);
      if (other.mother === id && other.father && other.father !== id) ids.add(other.father);
    }
    ids.delete(id);
    return personList([...ids]).sort(comparePeople);
  }

  function parentsOf(id) {
    const person = byId.get(id);
    if (!person) return [];
    return [person.father, person.mother].map((pid) => byId.get(pid)).filter(Boolean);
  }

  function siblingsOf(id) {
    const person = byId.get(id);
    if (!person || isPet(person)) return [];
    return humans
      .filter((other) => {
        if (other.id === id) return false;
        const sameFather = person.father && other.father === person.father;
        const sameMother = person.mother && other.mother === person.mother;
        return sameFather || sameMother;
      })
      .sort(comparePeople);
  }

  function petsOf(id) {
    return pets
      .filter((pet) => pet.owners.includes(id))
      .sort(comparePeople);
  }

  function ownersOf(id) {
    const pet = byId.get(id);
    if (!pet || !isPet(pet)) return [];
    return personList(pet.owners).sort(comparePeople);
  }

  function fullSiblings(id) {
    const person = byId.get(id);
    if (!person) return [];
    return siblingsOf(id).filter((sibling) => {
      if (person.father && person.mother) {
        return sibling.father === person.father && sibling.mother === person.mother;
      }
      return true;
    });
  }

  function childGroups(id) {
    const groups = new Map();
    for (const child of childrenOf(id)) {
      const other = child.father === id ? child.mother : child.father;
      const key = other || "";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(child);
    }
    const order = spousesOf(id).map((spouse) => spouse.id);
    const keys = [...groups.keys()].sort((a, b) => {
      const ai = order.indexOf(a);
      const bi = order.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
    return keys.map((key) => ({
      otherId: key,
      other: key ? byId.get(key) || null : null,
      children: groups.get(key),
    }));
  }

  function topAncestor(id) {
    let current = id;
    const person = byId.get(id);
    if (person && isPet(person)) {
      const owner = person.owners.find((ownerId) => byId.has(ownerId) && !isPet(byId.get(ownerId)));
      current = owner || id;
    }
    const seenIds = new Set();
    while (current && !seenIds.has(current)) {
      seenIds.add(current);
      const node = byId.get(current);
      if (!node || isPet(node)) break;
      const next = [node.father, node.mother].find((pid) => pid && byId.has(pid) && !isPet(byId.get(pid)));
      if (!next) break;
      current = next;
    }
    return current;
  }

  function canonicalBranch(id) {
    const match = branches.find((branch) => branch.ids.includes(id));
    return match ? match.id : id;
  }

  function search(query) {
    const needle = String(query || "").trim().toLowerCase();
    if (!needle) return people;
    return people.filter((person) => {
      const haystack = [
        person.name,
        person.place,
        person.bio,
        person.birth,
        person.death,
        person.species,
        isPet(person) ? "pet" : "",
      ].join(" ").toLowerCase();
      return haystack.includes(needle);
    });
  }

  return {
    title: String(data.title || "Family Tree").trim() || "Family Tree",
    subtitle: String(data.subtitle || "").trim(),
    sample: data.sample === true,
    lang: String(data.lang || "").trim(),
    dir: data.dir === "rtl" ? "rtl" : "ltr",
    focusId,
    people,
    humans,
    pets,
    byId,
    issues,
    livingCount: humans.filter((person) => isLiving(person)).length,
    petCount: pets.length,
    generationCount: generationCount(humans, byId),
    branches,
    childrenOf,
    spousesOf,
    parentsOf,
    siblingsOf,
    fullSiblings,
    petsOf,
    ownersOf,
    halfSiblings(id) {
      const full = new Set(fullSiblings(id).map((person) => person.id));
      return siblingsOf(id).filter((person) => !full.has(person.id));
    },
    childGroups,
    topAncestor,
    canonicalBranch,
    search,
  };
}

function normalizeSpecies(value) {
  const species = String(value || "").trim().toLowerCase();
  if (species === "cat" || species === "dog" || species === "bird") return species;
  if (species) return "other";
  return "cat";
}

function findCycles(people, byId) {
  const color = new Map();
  const issues = [];
  const reported = new Set();

  function visit(id) {
    if (!id || !byId.has(id)) return;
    const state = color.get(id) || 0;
    if (state === 1) {
      if (!reported.has(id)) {
        reported.add(id);
        issues.push(`Parent links loop through ${displayName(byId.get(id))}. Check father and mother.`);
      }
      return;
    }
    if (state === 2) return;
    color.set(id, 1);
    const person = byId.get(id);
    visit(person.father);
    visit(person.mother);
    color.set(id, 2);
  }

  for (const person of people) visit(person.id);
  return issues;
}

function generationCount(people, byId) {
  const memo = new Map();
  function depth(id, stack) {
    if (!byId.has(id)) return 0;
    if (memo.has(id)) return memo.get(id);
    if (stack.has(id)) return 0;
    stack.add(id);
    const person = byId.get(id);
    let best = 0;
    for (const parentId of [person.father, person.mother]) {
      if (parentId && byId.has(parentId)) best = Math.max(best, 1 + depth(parentId, stack));
    }
    stack.delete(id);
    memo.set(id, best);
    return best;
  }
  let max = 0;
  for (const person of people) max = Math.max(max, depth(person.id, new Set()));
  return people.length ? max + 1 : 0;
}

function descendantCounts(people, childrenById) {
  const memo = new Map();
  function walk(id, stack) {
    if (memo.has(id)) return memo.get(id);
    if (stack.has(id)) return new Set();
    stack.add(id);
    const seen = new Set();
    for (const childId of childrenById.get(id) || []) {
      seen.add(childId);
      for (const descendant of walk(childId, stack)) seen.add(descendant);
    }
    stack.delete(id);
    memo.set(id, seen);
    return seen;
  }
  const sizes = new Map();
  for (const person of people) sizes.set(person.id, walk(person.id, new Set()).size);
  return sizes;
}

function buildBranches(people, byId, childrenById, counts) {
  const used = new Set();
  const branches = [];
  for (const person of people) {
    const kids = childrenById.get(person.id) || [];
    if (!kids.length || used.has(person.id)) continue;
    const kidSet = new Set(kids);
    const partner = people.find((other) => {
      if (other.id === person.id || used.has(other.id)) return false;
      const otherKids = childrenById.get(other.id) || [];
      return otherKids.length === kidSet.size && otherKids.every((id) => kidSet.has(id));
    });
    used.add(person.id);
    const ids = [person.id];
    let label = displayName(person);
    if (partner) {
      used.add(partner.id);
      ids.push(partner.id);
      label = `${displayName(person)} & ${displayName(partner)}`;
    }
    branches.push({
      id: person.id,
      ids,
      label,
      count: counts.get(person.id) || 0,
    });
  }
  branches.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  return branches;
}
