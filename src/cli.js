import { getConfig } from "./config.js";
import { ensureDir, loadAllExtractions, saveAllExtractions } from "./extract/store.js";
import { runExtractionPipeline } from "./extract/pipeline.js";
import { buildGraphFromExtractions } from "./buildGraph.js";
import { queryAiCompaniesCoFoundedByFormerGoogleEmployees } from "./query.js";
import { writeFile } from "node:fs/promises";

const COMPANIES = [
  "OpenAI",
  "DeepMind",
  "Cohere",
  "Anthropic",
  "Inflection AI"
];

async function main() {
  const config = getConfig();

  const extractDir = "./data/extract";
  const extractPath = `${extractDir}/all_companies.json`;
  await ensureDir(extractDir);

  const { allResults } = await runExtractionPipeline({
    config,
    companies: COMPANIES,
    log: true
  });

  await saveAllExtractions(extractPath, allResults);
  const cleanedExtractions = await loadAllExtractions(extractPath);

  const graph = buildGraphFromExtractions(cleanedExtractions);
  const queryResult = queryAiCompaniesCoFoundedByFormerGoogleEmployees(graph);

  const graphJson = graph.toJSON({
    meta: {
      query:
        "AI companies co-founded by former Google employees",
      highlightedNodeIds: queryResult.companyNodeIds
    }
  });

  await writeFile("graph.json", JSON.stringify(graphJson, null, 2), "utf8");

  const companyNames = queryResult.companies.map((c) => c.name);
  console.log('Query: "AI companies co-founded by former Google employees"');
  if (companyNames.length === 0) {
    console.log("Result: (none found in extracted data)");
  } else {
    console.log("Result:");
    for (const name of companyNames) console.log(`- ${name}`);
  }
  console.log("Wrote graph.json");
  console.log(`Wrote ${extractPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
