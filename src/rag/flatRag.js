import OpenAI from "openai";
import { chunkText } from "./chunk.js";
import { cosineSimilarity, embedTexts } from "./embeddings.js";
import { buildContextOnlyPrompt } from "./prompt.js";

export function buildFlatRagIndex({ documents, targetTokens = 420 }) {
  const chunks = [];
  for (const doc of documents) {
    const docChunks = chunkText(doc.text, { targetTokens });
    for (const c of docChunks) {
      chunks.push({
        id: `${doc.id}#${chunks.length + 1}`,
        doc_id: doc.id,
        text: c.text
      });
    }
  }
  return { chunks, embeddings: null };
}

export async function embedFlatRagIndex({ apiKey, index, embeddingModel }) {
  const vectors = await embedTexts({
    apiKey,
    model: embeddingModel || "text-embedding-3-small",
    texts: index.chunks.map((c) => c.text)
  });
  index.embeddings = vectors;
  return index;
}

export function retrieveTopK({ index, queryEmbedding, k = 3 }) {
  if (!index.embeddings) throw new Error("Index embeddings are not computed.");
  const scored = index.chunks.map((chunk, i) => ({
    chunk,
    score: cosineSimilarity(queryEmbedding, index.embeddings[i])
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}

export async function answerWithFlatRag({
  apiKey,
  llmModel,
  embeddingModel,
  index,
  question
}) {
  const client = new OpenAI({ apiKey });
  const [queryEmbedding] = await embedTexts({
    apiKey,
    model: embeddingModel || "text-embedding-3-small",
    texts: [question]
  });
  const top = retrieveTopK({ index, queryEmbedding, k: 3 });

  const context = top
    .map((t, i) => `[#${i + 1} | ${t.chunk.doc_id}]\n${t.chunk.text}`)
    .join("\n\n---\n\n");

  const prompt = buildContextOnlyPrompt({ context, question });
  const res = await client.responses.create({
    model: llmModel,
    input: prompt,
    temperature: 0
  });

  return {
    answer: res.output_text || "",
    retrieved: top.map((t) => ({ id: t.chunk.id, doc_id: t.chunk.doc_id, score: t.score }))
  };
}

