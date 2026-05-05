# GraphRAG Cost Analysis (Token Usage & Time)

## 1. Token Usage

### 1.1 LLM Extraction (Main Cost Driver)
- Each company → 1 LLM call  
- Input: Wikipedia summary (~500–1500 tokens)  
- Output: structured JSON (~100–300 tokens)  

**Estimated:**
- ~800–1800 tokens / company  
- 5 companies → **~4,000 – 9,000 tokens**

---

### 1.2 Embedding
- Model: `text-embedding-3-small`  
- ~200–500 tokens / document  

**Estimated total:**
- **~1,000 – 2,500 tokens**

---

### 1.3 Graph Construction
- Runs locally (JavaScript)  
- **No token cost**

---

### ✅ Total Token Usage
- **~5,000 – 12,000 tokens / pipeline run**

---

## 2. Time Cost (Latency)

### 2.1 LLM Extraction (Slowest Step)
- ~1–3 seconds / request  
- 5 companies → **~5–15 seconds**

---

### 2.2 Embedding
- ~0.3–1 second / request  
- Total → **~1–3 seconds**

---

### 2.3 Wikipedia Fetch
- ~200–500 ms / request  
- Total → **~1–2 seconds**

---

### ✅ Total Build Time
- **~7 – 20 seconds / run**

---

## 3. Cost Trade-off: Flat RAG vs GraphRAG

| Phase            | Flat RAG        | GraphRAG           |
|------------------|-----------------|--------------------|
| Build Cost       | Low             | High               |
| Simple Queries   | Similar         | Similar            |
| Multi-hop Query  | Expensive       | Efficient          |

---

## 4. Key Insight

- GraphRAG has **high upfront cost**
- But **low marginal cost per query**

### Break-even point:
- ~10–20 queries

👉 If query volume is low → use Flat RAG  
👉 If multi-hop queries are frequent → GraphRAG is more efficient

---

## 5. Optimization Strategies

### 5.1 Immediate Improvements
- Cache:
  - Wikipedia summaries  
  - LLM extractions  
  - Embeddings  

→ Reduce cost by **~80–90%** on reruns

---

### 5.2 Advanced Optimization
- Use rule-based extraction before LLM
- Reduce input size (smaller chunks)
- Batch embedding requests

---

## 6. Final Conclusion

- **LLM extraction accounts for ~80% of total cost**
- **Latency is dominated by sequential API calls**
- GraphRAG is:
  - Expensive to build
  - Efficient at scale (especially multi-hop reasoning)