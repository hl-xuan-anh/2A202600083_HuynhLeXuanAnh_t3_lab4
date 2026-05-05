import OpenAI from "openai";
import { z } from "zod";

const ExtractionSchema = z.object({
  company: z.string().min(1),
  founders: z.array(
    z.object({
      name: z.string().min(1),
      worked_at: z.array(z.string())
    })
  )
});

function extractionJsonSchema() {
  return {
    name: "company_extraction",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        company: { type: "string" },
        founders: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              name: { type: "string" },
              worked_at: { type: "array", items: { type: "string" } }
            },
            required: ["name", "worked_at"]
          }
        }
      },
      required: ["company", "founders"]
    }
  };
}

export async function extractCompanyInfo({ apiKey, model, company, summary }) {
  const client = new OpenAI({ apiKey });

  const prompt = [
    "Extract structured data from the text.",
    "",
    "Return JSON:",
    "{",
    '  "company": "",',
    '  "founders": [',
    "    {",
    '      "name": "",',
    '      "worked_at": []',
    "    }",
    "  ]",
    "}",
    "",
    "Rules:",
    '- Only include real founders (no "Not specified")',
    '- worked_at must include "Google" if mentioned or implied',
    '- Normalize "Google LLC", "Alphabet" \u2192 "Google"',
    '- If unknown, return empty array []',
    "- Keep output minimal and valid JSON only",
    "",
    summary
  ].join("\n");

  const response = await client.responses.create({
    model,
    input: prompt,
    temperature: 0,
    text: {
      format: {
        type: "json_schema",
        ...extractionJsonSchema()
      }
    }
  });

  const outputText = response.output_text;
  if (!outputText) throw new Error("OpenAI response had no output_text.");

  let parsed;
  try {
    parsed = JSON.parse(outputText);
  } catch (e) {
    throw new Error(
      `Failed to parse OpenAI JSON output. Raw:\n${outputText}\nError: ${e}`
    );
  }

  const result = ExtractionSchema.parse(parsed);
  result.founders = result.founders.map((f) => ({
    name: f.name.trim(),
    worked_at: (f.worked_at || [])
      .map((o) => String(o).trim())
      .filter((o) => o.length > 0)
  }));

  return result;
}
