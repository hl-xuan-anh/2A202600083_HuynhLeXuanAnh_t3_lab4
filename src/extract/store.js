import { mkdir, readFile, writeFile } from "node:fs/promises";

export async function ensureDir(dir) {
  await mkdir(dir, { recursive: true });
}

export async function saveAllExtractions(filePath, allResults) {
  await writeFile(filePath, JSON.stringify(allResults, null, 2), "utf8");
}

export async function loadAllExtractions(filePath) {
  const raw = await readFile(filePath, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error("Extraction file must be an array.");
  return parsed;
}

