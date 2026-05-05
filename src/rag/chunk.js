function approxTokenCount(text) {
  const words = String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.ceil(words * 1.3);
}

function splitWords(text) {
  return String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

export function chunkText(text, { targetTokens = 420, overlapTokens = 60 } = {}) {
  const words = splitWords(text);
  if (words.length === 0) return [];

  const tokensPerWord = 1.3;
  const targetWords = Math.max(1, Math.floor(targetTokens / tokensPerWord));
  const overlapWords = Math.max(0, Math.floor(overlapTokens / tokensPerWord));

  const chunks = [];
  for (let start = 0; start < words.length; start += Math.max(1, targetWords - overlapWords)) {
    const end = Math.min(words.length, start + targetWords);
    const chunk = words.slice(start, end).join(" ");
    chunks.push({
      text: chunk,
      approx_tokens: approxTokenCount(chunk)
    });
    if (end >= words.length) break;
  }
  return chunks;
}

