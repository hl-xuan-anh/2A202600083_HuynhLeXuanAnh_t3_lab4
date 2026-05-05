import { fetchWikipediaSummary } from "../wikipedia.js";
import { extractCompanyInfo } from "../openaiExtract.js";
import { cleanData, enrichGoogleRelation } from "./clean.js";

export async function runExtractionPipeline({ config, companies, log = true }) {
  const allResults = [];
  const summariesByCompany = new Map();

  for (const company of companies) {
    const wiki = await fetchWikipediaSummary(company);
    const rawText = wiki.extract || "";
    summariesByCompany.set(company, rawText);

    const llm = await extractCompanyInfo({
      apiKey: config.apiKey,
      model: config.model,
      company,
      summary: rawText
    });

    let data = cleanData(llm);
    data = enrichGoogleRelation(data, rawText);

    if (log) {
      console.log("=== EXTRACT RESULT ===");
      console.log(JSON.stringify(data, null, 2));
    }

    allResults.push(data);
  }

  return { allResults, summariesByCompany };
}

