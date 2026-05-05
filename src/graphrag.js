import OpenAI from "openai";
import { buildContextOnlyPrompt } from "./rag/prompt.js";
import { queryAiCompaniesCoFoundedByFormerGoogleEmployees } from "./query.js";

function graphFactsContext(graph) {
  const nodes = graph.nodes();
  const edges = graph.edges();
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  const lines = [];
  for (const e of edges) {
    const src = nodeById.get(e.source);
    const tgt = nodeById.get(e.target);
    if (!src || !tgt) continue;
    if (e.type === "FOUNDED") lines.push(`${src.name} founded ${tgt.name}.`);
    if (e.type === "WORKED_AT") lines.push(`${src.name} worked at ${tgt.name}.`);
  }

  return lines.join("\n");
}

export async function answerWithGraphRag({
  apiKey,
  llmModel,
  question,
  wikipediaSummariesByCompany,
  graph
}) {
  const client = new OpenAI({ apiKey });

  const qNorm = String(question || "").toLowerCase();
  let context = "";

  if (qNorm.includes("co-founded") && qNorm.includes("google")) {
    const q = queryAiCompaniesCoFoundedByFormerGoogleEmployees(graph);
    const companyNames = q.companies.map((c) => c.name);
    context = [
      "Graph facts:",
      graphFactsContext(graph),
      "",
      "Query result (company names):",
      companyNames.length ? companyNames.join(", ") : "(none)"
    ].join("\n");
  } else if (qNorm.includes("openai")) {
    context = wikipediaSummariesByCompany.get("OpenAI") || "";
  } else {
    context = [...wikipediaSummariesByCompany.values()].join("\n\n---\n\n");
  }

  const prompt = buildContextOnlyPrompt({ context, question });
  const res = await client.responses.create({
    model: llmModel,
    input: prompt,
    temperature: 0
  });

  return { answer: res.output_text || "" };
}

