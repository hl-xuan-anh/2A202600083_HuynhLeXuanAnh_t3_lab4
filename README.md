# AI Company GraphRAG vs Flat RAG

Fetches Wikipedia summaries for a small set of AI companies, uses the OpenAI API to extract founders + prior organizations, builds a graph (`graph.json`), and visualizes it with Cytoscape.js. Includes a benchmark that compares Flat RAG vs GraphRAG across multiple queries and exports `benchmark.md`.

## Repo Structure

```
.
├─ benchmark.js                 # Runs Flat RAG + GraphRAG and writes benchmark.md
├─ package.json
├─ package-lock.json
├─ README.md
├─ .env.example                 # Example env vars
├─ screenshot/
│  ├─ knowledge_graph.png       # Knowledge graph screenshot
├─ public/
│  ├─ index.html                # Cytoscape graph visualizer
│  ├─ app.js                    # Loads graph.json and highlights query result nodes
│  └─ style.css
└─ src/
   ├─ cli.js                    # Main pipeline: wiki -> LLM -> clean -> graph -> export
   ├─ config.js                 # Reads OPENAI_API_KEY / OPENAI_MODEL
   ├─ wikipedia.js              # Wikipedia REST summary fetcher
   ├─ openaiExtract.js          # Structured extraction (JSON schema)
   ├─ buildGraph.js             # Builds nodes/edges (normalizes Google)
   ├─ query.js                  # Graph query: co-founded by former Google employees
   ├─ graphrag.js               # GraphRAG answer wrapper (context from graph + wiki)
   ├─ extract/
   │  ├─ pipeline.js            # Orchestrates extraction + debug logs
   │  ├─ clean.js               # cleanData + enrichGoogleRelation
   │  └─ store.js               # Save/load data/extract/all_companies.json
   ├─ graph/
   │  └─ Graph.js               # In-memory graph + graph.json schema
   └─ rag/
      ├─ chunk.js               # Simple chunker (~420 tokens)
      ├─ embeddings.js          # OpenAI embeddings + cosine similarity
      ├─ prompt.js              # Context-only prompt template
      └─ flatRag.js             # Flat RAG pipeline (top-3 retrieval)
```

## Setup

1. Install dependencies: `npm install`
2. Set your API key:
   - PowerShell: `$env:OPENAI_API_KEY="..."`
   - Or copy `.env.example` → `.env` and fill it in

Optional:
- `OPENAI_MODEL` (default: `gpt-4o-mini`)

## Run

- Build graph + export files: `npm start`
  - Writes:
    - `data/extract/all_companies.json`
    - `graph.json`
- Visualize: `npm run serve` then open `http://localhost:8080/public/`
- Benchmark: `node benchmark.js` (writes `benchmark.md`)
