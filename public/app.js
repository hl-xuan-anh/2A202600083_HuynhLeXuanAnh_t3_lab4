function toElements(graph) {
  const nodeEls = graph.nodes.map((n) => ({
    data: { id: n.id, label: n.label, type: n.type, name: n.name }
  }));
  const edgeEls = graph.edges.map((e) => ({
    data: { id: e.id, source: e.source, target: e.target, type: e.type }
  }));
  return [...nodeEls, ...edgeEls];
}

function setResultsList(graph, highlightedIds) {
  const ul = document.getElementById("results");
  ul.innerHTML = "";
  const nodesById = new Map(graph.nodes.map((n) => [n.id, n]));
  const highlighted = (highlightedIds || [])
    .map((id) => nodesById.get(id))
    .filter(Boolean);

  if (highlighted.length === 0) {
    const li = document.createElement("li");
    li.textContent = "(none)";
    ul.appendChild(li);
    return;
  }

  for (const n of highlighted) {
    const li = document.createElement("li");
    li.textContent = n.name;
    ul.appendChild(li);
  }
}

async function main() {
  const res = await fetch("../graph.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load graph.json: ${res.status}`);
  const graph = await res.json();

  const subtitle = document.getElementById("subtitle");
  subtitle.textContent = graph?.meta?.query || "";

  const highlightedIds = graph?.meta?.highlightedNodeIds || [];
  setResultsList(graph, highlightedIds);

  const cy = cytoscape({
    container: document.getElementById("cy"),
    elements: toElements(graph),
    layout: { name: "cose", animate: false },
    style: [
      {
        selector: "node",
        style: {
          label: "data(label)",
          color: "#e2e8f0",
          "text-outline-color": "#0b1020",
          "text-outline-width": 2,
          "font-size": 10,
          "text-wrap": "wrap",
          "text-max-width": 90,
          width: 28,
          height: 28,
          "background-color": "#64748b"
        }
      },
      {
        selector: 'node[type="Company"]',
        style: { "background-color": "#38bdf8", shape: "round-rectangle" }
      },
      {
        selector: 'node[type="Person"]',
        style: { "background-color": "#a78bfa", shape: "ellipse" }
      },
      {
        selector: 'node[type="Organization"]',
        style: { "background-color": "#34d399", shape: "hexagon" }
      },
      {
        selector: "edge",
        style: {
          width: 1.5,
          "line-color": "rgba(226, 232, 240, 0.35)",
          "target-arrow-shape": "triangle",
          "target-arrow-color": "rgba(226, 232, 240, 0.35)",
          "curve-style": "bezier"
        }
      },
      {
        selector: 'edge[type="FOUNDED"]',
        style: { "line-color": "rgba(56, 189, 248, 0.55)" }
      },
      {
        selector: 'edge[type="WORKED_AT"]',
        style: { "line-color": "rgba(52, 211, 153, 0.55)" }
      },
      {
        selector: ".highlighted",
        style: {
          "background-color": "#fb7185",
          "border-color": "#fb7185",
          "border-width": 4
        }
      },
      {
        selector: ".dim",
        style: { opacity: 0.2 }
      }
    ]
  });

  for (const id of highlightedIds) {
    cy.getElementById(id).addClass("highlighted");
  }

  cy.on("tap", "node", (evt) => {
    const node = evt.target;
    const neighborhood = node.closedNeighborhood();
    cy.elements().addClass("dim");
    neighborhood.removeClass("dim");
  });

  cy.on("tap", (evt) => {
    if (evt.target === cy) cy.elements().removeClass("dim");
  });
}

main().catch((err) => {
  console.error(err);
  const subtitle = document.getElementById("subtitle");
  subtitle.textContent = String(err?.message || err);
});

