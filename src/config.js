import "dotenv/config";

export function getConfig() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing OPENAI_API_KEY. Set it in your environment or in a .env file."
    );
  }

  return {
    apiKey,
    model: process.env.OPENAI_MODEL || "gpt-4o-mini"
  };
}

