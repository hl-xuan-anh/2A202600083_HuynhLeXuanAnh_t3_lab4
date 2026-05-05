import { writeFile } from "node:fs/promises";
import { getConfig } from "./src/config.js";
import { fetchWikipediaSummary } from "./src/wikipedia.js";
import { extractCompanyInfo } from "./src/openaiExtract.js";
import { cleanData, enrichGoogleRelation } from "./src/extract/clean.js";
import { buildGraphFromExtractions } from "./src/buildGraph.js";
import { queryAiCompaniesCoFoundedByFormerGoogleEmployees } from "./src/query.js";
import {
  answerWithFlatRag,
  buildFlatRagIndex,
  embedFlatRagIndex
} from "./src/rag/flatRag.js";
import { answerWithGraphRag } from "./src/graphrag.js";

const COMPANIES = [
  "OpenAI",
  "DeepMind",
  "Cohere",
  "Anthropic",
  "Inflection AI"
];

// Keep your expanded query list; only Q1/Q2 are scored.
const QUERIES = [
  { id: "Q1", text: "What is OpenAI?" },
  {
    id: "Q2",
    text: "Which AI companies were co-founded by people who previously worked at Google?"
  },
  { id: "Q3", text: "When was DeepMind founded?" },
  { id: "Q4", text: "Who founded Cohere?" },
  { id: "Q5", text: "When was Anthropic founded?" },
  { id: "Q6", text: "Who founded Inflection AI?" },
  { id: "Q7", text: "What does Anthropic focus on?" },
  { id: "Q8", text: "What is the main goal of OpenAI?" },
  { id: "Q9", text: "Name one founder of DeepMind." },
  { id: "Q10", text: "Which companies were founded by Mustafa Suleyman?" },
  { id: "Q11", text: "Which founders are associated with Cohere?" },
  { id: "Q12", text: "Which company is associated with Aidan Gomez?" },
  { id: "Q13", text: "List companies founded by people who worked at Google." },
  {
    id: "Q14",
    text: "Find founders who worked at Google and the companies they later founded."
  },
  { id: "Q15", text: "Which companies share founders with DeepMind?" },
  {
    id: "Q16",
    text: "Which founders are connected to both Google and Inflection AI?"
  },
  { id: "Q17", text: "Find all companies linked to Google through their founders." },
  { id: "Q18", text: "Which founders connect multiple AI companies together?" },
  {
    id: "Q19",
    text: "Which companies are indirectly connected through shared founders?"
  },
  { id: "Q20", text: "Find relationships between Cohere and Google via people." }
];

function normalizeQueries(raw) {
  const out = [];
  let seq = 1;
  for (const q of raw) {
    const text = String(q?.text || "").trim();
    if (!text) {
      console.warn(`Skipping invalid query (missing text): ${JSON.stringify(q)}`);
      continue;
    }
    const id = String(q?.id || `Q${seq++}`).trim() || `Q${seq++}`;
    out.push({ id, text });
  }
  return out;
}

function containsAny(haystack, needles) {
  const h = String(haystack || "").toLowerCase();
  return needles.some((n) => h.includes(String(n).toLowerCase()));
}

function extractFoundedYearFromSummary(summary) {
  const s = String(summary || "");
  // Common patterns in Wikipedia summaries.
  const patterns = [
    /\bfounded\s+in\s+(\d{4})\b/i,
    /\bfounded\s+(\d{4})\b/i,
    /\bestablished\s+in\s+(\d{4})\b/i,
    /\bestablished\s+(\d{4})\b/i
  ];
  for (const p of patterns) {
    const m = s.match(p);
    if (m && m[1]) return Number(m[1]);
  }
  return null;
}

function graphHelpers(graph) {
  const nodes = graph.nodes();
  const edges = graph.edges();
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  const foundedByCompany = new Map(); // companyName -> Set(personName)
  const foundedCompaniesByPerson = new Map(); // personName -> Set(companyName)
  const workedAtByPerson = new Map(); // personName -> Set(orgName)

  for (const e of edges) {
    const src = nodeById.get(e.source);
    const tgt = nodeById.get(e.target);
    if (!src || !tgt) continue;

    if (e.type === "FOUNDED" && src.type === "Person" && tgt.type === "Company") {
      const set1 = foundedByCompany.get(tgt.name) || new Set();
      set1.add(src.name);
      foundedByCompany.set(tgt.name, set1);

      const set2 = foundedCompaniesByPerson.get(src.name) || new Set();
      set2.add(tgt.name);
      foundedCompaniesByPerson.set(src.name, set2);
    }

    if (e.type === "WORKED_AT" && src.type === "Person" && tgt.type === "Organization") {
      const set = workedAtByPerson.get(src.name) || new Set();
      set.add(tgt.name);
      workedAtByPerson.set(src.name, set);
    }
  }

  return { foundedByCompany, foundedCompaniesByPerson, workedAtByPerson };
}

function evaluate({ queryId, answer, shared }) {
  const a = String(answer || "").trim();
  if (!a) return { correct: false, reason: "empty" };

  const { graph, summariesByCompany, graphQ } = shared;
  const { foundedByCompany, foundedCompaniesByPerson, workedAtByPerson } = graphHelpers(graph);

  if (queryId === "Q1") {
    return { correct: containsAny(a, ["OpenAI"]), reason: "contains OpenAI" };
  }

  if (queryId === "Q2") {
    const expected = (graphQ?.companies || []).map((c) => c.name);
    if (expected.length === 0) {
      const ok = containsAny(a, ["none", "no", "not", "i don't know"]);
      return { correct: ok, reason: "no expected companies" };
    }

    const mentionsExpected = expected.every((name) => containsAny(a, [name]));
    const hallucinatesOthers = containsAny(
      a,
      COMPANIES.filter((c) => !expected.includes(c))
    );
    const correct = mentionsExpected && !hallucinatesOthers;
    return {
      correct,
      reason: correct ? "mentions expected only" : `expected: ${expected.join(", ")}`
    };
  }

  if (queryId === "Q3") {
    const y = extractFoundedYearFromSummary(summariesByCompany.get("DeepMind"));
    const ok = y ? containsAny(a, [String(y)]) : containsAny(a, ["i don't know"]);
    return { correct: ok, reason: y ? `expects year ${y}` : "no year in summary" };
  }

  if (queryId === "Q4") {
    const founders = [...(foundedByCompany.get("Cohere") || new Set())];
    const ok = founders.length
      ? founders.some((n) => containsAny(a, [n]))
      : containsAny(a, ["i don't know"]);
    return { correct: ok, reason: founders.length ? "mentions a founder" : "no founders in graph" };
  }

  if (queryId === "Q5") {
    const y = extractFoundedYearFromSummary(summariesByCompany.get("Anthropic"));
    const ok = y ? containsAny(a, [String(y)]) : containsAny(a, ["i don't know"]);
    return { correct: ok, reason: y ? `expects year ${y}` : "no year in summary" };
  }

  if (queryId === "Q6") {
    const founders = [...(foundedByCompany.get("Inflection AI") || new Set())];
    const ok = founders.length
      ? founders.some((n) => containsAny(a, [n]))
      : containsAny(a, ["i don't know"]);
    return { correct: ok, reason: founders.length ? "mentions a founder" : "no founders in graph" };
  }

  if (queryId === "Q7") {
    const s = summariesByCompany.get("Anthropic") || "";
    const ok =
      containsAny(a, ["Anthropic"]) &&
      (containsAny(a, ["AI", "artificial intelligence"]) ||
        containsAny(a, [s.split(".")[0] || ""]));
    return { correct: ok, reason: "mentions Anthropic + focus keywords" };
  }

  if (queryId === "Q8") {
    const s = summariesByCompany.get("OpenAI") || "";
    const ok =
      containsAny(a, ["OpenAI"]) &&
      (containsAny(a, ["AI", "artificial intelligence", "benefit"]) ||
        containsAny(a, [s.split(".")[0] || ""]));
    return { correct: ok, reason: "mentions OpenAI + goal keywords" };
  }

  if (queryId === "Q9") {
    const founders = [...(foundedByCompany.get("DeepMind") || new Set())];
    const ok = founders.length
      ? founders.some((n) => containsAny(a, [n]))
      : containsAny(a, ["i don't know"]);
    return { correct: ok, reason: founders.length ? "mentions a founder" : "no founders in graph" };
  }

  if (queryId === "Q10") {
    const companies = [...(foundedCompaniesByPerson.get("Mustafa Suleyman") || new Set())];
    const ok = companies.length
      ? companies.some((c) => containsAny(a, [c]))
      : containsAny(a, ["i don't know", "none", "no"]);
    return { correct: ok, reason: companies.length ? "mentions a company" : "no edges for person" };
  }

  if (queryId === "Q11") {
    const founders = [...(foundedByCompany.get("Cohere") || new Set())];
    const ok = founders.length
      ? founders.every((n) => containsAny(a, [n])) || founders.some((n) => containsAny(a, [n]))
      : containsAny(a, ["i don't know"]);
    return { correct: ok, reason: founders.length ? "mentions Cohere founders" : "no founders in graph" };
  }

  if (queryId === "Q12") {
    const companies = [...(foundedCompaniesByPerson.get("Aidan Gomez") || new Set())];
    const ok = companies.length
      ? companies.some((c) => containsAny(a, [c]))
      : containsAny(a, ["i don't know"]);
    return { correct: ok, reason: companies.length ? "mentions a company" : "no edges for person" };
  }

  if (queryId === "Q13" || queryId === "Q17") {
    // Any company connected to Google through WORKED_AT + FOUNDED.
    const expected = new Set((graphQ?.companies || []).map((c) => c.name));
    const ok = expected.size
      ? [...expected].some((c) => containsAny(a, [c]))
      : containsAny(a, ["none", "no", "i don't know"]);
    return { correct: ok, reason: expected.size ? "mentions at least one expected company" : "no expected companies" };
  }

  if (queryId === "Q14") {
    const expectedCompanies = new Set((graphQ?.companies || []).map((c) => c.name));
    const expectsGoogle = containsAny(a, ["Google"]);
    const ok = (expectedCompanies.size === 0 && containsAny(a, ["none", "i don't know"])) ||
      ([...expectedCompanies].some((c) => containsAny(a, [c])) && expectsGoogle);
    return { correct: ok, reason: "mentions Google + at least one expected company" };
  }

  if (queryId === "Q15") {
    const dmFounders = foundedByCompany.get("DeepMind") || new Set();
    const relatedCompanies = new Set();
    for (const f of dmFounders) {
      for (const c of foundedCompaniesByPerson.get(f) || []) relatedCompanies.add(c);
    }
    relatedCompanies.delete("DeepMind");
    const ok = relatedCompanies.size
      ? [...relatedCompanies].some((c) => containsAny(a, [c]))
      : containsAny(a, ["none", "no", "i don't know"]);
    return { correct: ok, reason: "mentions a related company or none" };
  }

  if (queryId === "Q16") {
    const googlePeople = new Set(
      [...workedAtByPerson.entries()]
        .filter(([, orgs]) => orgs.has("Google"))
        .map(([p]) => p)
    );
    const infFounders = foundedByCompany.get("Inflection AI") || new Set();
    const expectedPeople = [...infFounders].filter((p) => googlePeople.has(p));
    const ok = expectedPeople.length
      ? expectedPeople.some((p) => containsAny(a, [p]))
      : containsAny(a, ["none", "no", "i don't know"]);
    return { correct: ok, reason: "mentions expected founder or none" };
  }

  if (queryId === "Q18") {
    const multi = [...foundedCompaniesByPerson.entries()]
      .filter(([, cs]) => cs.size >= 2)
      .map(([p]) => p);
    const ok = multi.length ? multi.some((p) => containsAny(a, [p])) : containsAny(a, ["none", "no", "i don't know"]);
    return { correct: ok, reason: "mentions a multi-company founder or none" };
  }

  if (queryId === "Q19") {
    // Shared founders across companies => mention any shared founder or any pair of companies.
    const founderToCompanies = foundedCompaniesByPerson;
    const shared = [...founderToCompanies.entries()].filter(([, cs]) => cs.size >= 2);
    const ok = shared.length
      ? shared.some(([p, cs]) => containsAny(a, [p]) || [...cs].some((c) => containsAny(a, [c])))
      : containsAny(a, ["none", "no", "i don't know"]);
    return { correct: ok, reason: "mentions shared founder/company or none" };
  }

  if (queryId === "Q20") {
    const cohereFounders = foundedByCompany.get("Cohere") || new Set();
    const googlePeople = new Set(
      [...workedAtByPerson.entries()]
        .filter(([, orgs]) => orgs.has("Google"))
        .map(([p]) => p)
    );
    const expected = [...cohereFounders].filter((p) => googlePeople.has(p));
    const ok = expected.length
      ? (containsAny(a, ["Cohere"]) && containsAny(a, ["Google"]))
      : containsAny(a, ["none", "no", "i don't know"]);
    return { correct: ok, reason: "mentions Cohere + Google (or none)" };
  }

  return { correct: null, reason: "no rule" };
}

function mark(ok) {
  if (ok === null) return "—";
  return ok ? "✅ Correct" : "❌ Incorrect";
}

function toMd(results) {
  const lines = [];
  lines.push("# BENCHMARK REPORT");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push("| Query | Flat RAG | GraphRAG |");
  lines.push("|---|---|---|");
  for (const r of results) {
    lines.push(`| ${r.query.id} | ${mark(r.evalFlat.correct)} | ${mark(r.evalGraph.correct)} |`);
  }
  lines.push("");
  lines.push("## Details");
  for (const r of results) {
    lines.push("");
    lines.push(`### ${r.query.id}`);
    lines.push("");
    lines.push(`**Query:** ${r.query.text}`);
    lines.push("");
    lines.push(`**Flat RAG:** ${mark(r.evalFlat.correct)}`);
    lines.push("");
    lines.push("```");
    lines.push(String(r.flat.answer || "").trim());
    lines.push("```");
    lines.push("");
    lines.push(`**GraphRAG:** ${mark(r.evalGraph.correct)}`);
    lines.push("");
    lines.push("```");
    lines.push(String(r.graph.answer || "").trim());
    lines.push("```");
  }
  lines.push("");
  return lines.join("\n");
}

async function buildSharedData(config) {
  const summaries = [];
  for (const c of COMPANIES) {
    const s = await fetchWikipediaSummary(c);
    summaries.push({ company: c, summary: s.extract || "" });
  }

  const summariesByCompany = new Map(summaries.map((s) => [s.company, s.summary]));

  const documents = summaries.map((s) => ({
    id: s.company,
    text: `${s.company}\n\n${s.summary}`
  }));

  const flatIndex = await embedFlatRagIndex({
    apiKey: config.apiKey,
    embeddingModel: "text-embedding-3-small",
    index: buildFlatRagIndex({ documents, targetTokens: 420 })
  });

  const cleanedExtractions = [];
  for (const s of summaries) {
    const extraction = await extractCompanyInfo({
      apiKey: config.apiKey,
      model: config.model,
      company: s.company,
      summary: s.summary
    });
    let cleaned = cleanData(extraction);
    cleaned = enrichGoogleRelation(cleaned, s.summary);
    cleanedExtractions.push(cleaned);
  }

  const graph = buildGraphFromExtractions(cleanedExtractions);
  const graphQ = queryAiCompaniesCoFoundedByFormerGoogleEmployees(graph);

  return { summariesByCompany, flatIndex, graph, graphQ };
}

async function run() {
  const config = getConfig();
  const shared = await buildSharedData(config);

  const results = [];
  for (const q of normalizeQueries(QUERIES)) {
    const flat = await answerWithFlatRag({
      apiKey: config.apiKey,
      llmModel: config.model,
      embeddingModel: "text-embedding-3-small",
      index: shared.flatIndex,
      question: q.text
    });

    const graph = await answerWithGraphRag({
      apiKey: config.apiKey,
      llmModel: config.model,
      question: q.text,
      wikipediaSummariesByCompany: shared.summariesByCompany,
      graph: shared.graph
    });

    results.push({
      query: q,
      flat,
      graph,
      evalFlat: evaluate({
        queryId: q.id,
        answer: flat.answer,
        shared
      }),
      evalGraph: evaluate({
        queryId: q.id,
        answer: graph.answer,
        shared
      })
    });
  }

  await writeFile("benchmark.md", toMd(results), "utf8");
  console.log("Wrote benchmark.md");
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
