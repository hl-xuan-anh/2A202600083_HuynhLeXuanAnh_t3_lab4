function nodeKey(type, name) {
  return `${type}:${name.toLowerCase()}`;
}

function normalizeAttributes(attributes) {
  if (!attributes || typeof attributes !== "object" || Array.isArray(attributes)) return {};
  const out = { ...attributes };

  if (out.founded_year !== undefined) {
    const n = Number(out.founded_year);
    if (Number.isFinite(n)) out.founded_year = Math.trunc(n);
    else delete out.founded_year;
  }

  if (out.description !== undefined) {
    const s = String(out.description).trim();
    if (s.length === 0) delete out.description;
    else out.description = s;
  }

  return out;
}

export class Graph {
  constructor() {
    this._nodeByKey = new Map();
    this._nodes = [];
    this._edges = [];
    this._edgeSeq = 1;
  }

  upsertNode({ type, name, label, attributes } = {}) {
    const trimmedName = String(name || "").trim();
    if (!trimmedName) throw new Error("Node name is required.");
    const key = nodeKey(type, trimmedName);
    const existing = this._nodeByKey.get(key);
    if (existing) {
      if (label && String(label).trim()) existing.label = String(label).trim();
      if (attributes && typeof attributes === "object" && !Array.isArray(attributes)) {
        existing.attributes = normalizeAttributes({
          ...(existing.attributes || {}),
          ...attributes
        });
      }
      if (!existing.attributes || typeof existing.attributes !== "object") {
        existing.attributes = {};
      }
      return existing;
    }

    const node = {
      id: `n${this._nodes.length + 1}`,
      type,
      name: trimmedName,
      label: String(label || "").trim() || trimmedName,
      attributes:
        attributes && typeof attributes === "object" && !Array.isArray(attributes)
          ? normalizeAttributes(attributes)
          : {}
    };
    this._nodes.push(node);
    this._nodeByKey.set(key, node);
    return node;
  }

  addEdge({ type, source, target }) {
    if (!source?.id || !target?.id) {
      throw new Error("Edge source/target must be nodes with id.");
    }

    const edge = {
      id: `e${this._edgeSeq++}`,
      type,
      source: source.id,
      target: target.id
    };
    this._edges.push(edge);
    return edge;
  }

  nodes() {
    return this._nodes.slice();
  }

  edges() {
    return this._edges.slice();
  }

  toJSON({ meta } = {}) {
    return {
      meta: meta || {},
      nodes: this.nodes(),
      edges: this.edges()
    };
  }
}
