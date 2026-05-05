import { Graph } from "./graph/Graph.js";

export function buildGraphFromExtractions(extractions) {
  const graph = new Graph();
  const googleNode = graph.upsertNode({ type: "Organization", name: "Google" });

  for (const extraction of extractions) {
    const companyNode = graph.upsertNode({
      type: "Company",
      name: extraction.company
    });

    for (const founder of extraction.founders) {
      const personNode = graph.upsertNode({
        type: "Person",
        name: founder.name
      });
      graph.addEdge({ type: "FOUNDED", source: personNode, target: companyNode });

      for (const orgName of founder.worked_at || []) {
        const normalized =
          String(orgName).toLowerCase().includes("google") ||
          String(orgName).toLowerCase().includes("alphabet")
            ? "Google"
            : orgName;
        const orgNode =
          normalized === "Google"
            ? googleNode
            : graph.upsertNode({
          type: "Organization",
          name: normalized
        });
        graph.addEdge({ type: "WORKED_AT", source: personNode, target: orgNode });
      }
    }
  }

  return graph;
}
