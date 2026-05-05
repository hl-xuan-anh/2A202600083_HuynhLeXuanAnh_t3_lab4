export function buildContextOnlyPrompt({ context, question }) {
  return [
    "Answer the question using ONLY the context below.",
    "If unsure, say \"I don't know\".",
    "",
    "Context:",
    context,
    "",
    "Question:",
    question
  ].join("\n");
}

