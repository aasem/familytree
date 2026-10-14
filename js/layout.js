// Bands are laid out left to right. A parent's center sits in the middle of
// the band reserved for their children, so cousins cannot overlap.
export function layoutClan(rootId, childIds) {
  function measure(id, seen) {
    if (seen.has(id)) return null;
    const next = new Set(seen);
    next.add(id);
    const kids = [];
    for (const childId of childIds(id) || []) {
      const child = measure(childId, next);
      if (child) kids.push(child);
    }
    const width = Math.max(1, kids.reduce((sum, kid) => sum + kid.width, 0));
    return { id, kids, width };
  }

  const tree = measure(rootId, new Set());
  if (!tree) return { nodes: [], parentOf: new Map() };

  const nodes = [];
  const parentOf = new Map();

  function assign(node, left, depth, parentId) {
    nodes.push({ id: node.id, x: left + node.width / 2, depth });
    if (parentId) parentOf.set(node.id, parentId);
    let cursor = left;
    for (const kid of node.kids) {
      assign(kid, cursor, depth + 1, node.id);
      cursor += kid.width;
    }
  }

  assign(tree, 0, 0, null);
  return { nodes, parentOf };
}
