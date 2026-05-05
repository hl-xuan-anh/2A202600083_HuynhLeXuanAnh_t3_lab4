const WIKI_SUMMARY_BASE =
  "https://en.wikipedia.org/api/rest_v1/page/summary/";

import fs from "fs";
import path from "path";

export async function fetchWikipediaSummary(title) {
  try {
    const filePath = path.join("data", "wiki", `${title}.json`);
    const raw = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw);

    return {
      title: data.title || title,
      extract: data.summary || "",
      content_urls: null
    };
  } catch (err) {
    throw new Error(`Local wiki file not found for "${title}"`);
  }
}

