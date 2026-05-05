import OpenAI from "openai";

export async function embedTexts({ apiKey, model = "text-embedding-3-small", texts }) {
  const client = new OpenAI({ apiKey });

  const normalized = texts
    .map(t => (typeof t === "string" ? t : t?.text))
    .filter(t => typeof t === "string" && t.trim().length > 0);

  if (normalized.length === 0) {
    throw new Error("embedTexts: no valid input texts");
  }

  const res = await client.embeddings.create({
    model,
    input: normalized
  });

  return res.data.map(d => d.embedding);
}

export function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
    throw new Error("cosineSimilarity: vectors must have same length arrays.");
  }

  let dot = 0;
  let a2 = 0;
  let b2 = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    a2 += a[i] * a[i];
    b2 += b[i] * b[i];
  }

  const denom = Math.sqrt(a2) * Math.sqrt(b2);
  return denom === 0 ? 0 : dot / denom;
}