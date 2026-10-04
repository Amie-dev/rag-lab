# Chapter 2 — Hierarchical Chunking & Dual Stores

This chapter implements the **foundation** of Parent-Document RAG: turning a raw document into two linked layers — large *parents* and small *children* — and storing each layer where it belongs.

```text
Raw Document
     │
     ▼  ChunkingService
┌───────────────────────┐        ┌──────────────────────────────┐
│  Parent Chunks (large)│───────►│  ParentStoreService          │  (generation context)
│  + childIds[]         │        └──────────────────────────────┘
└──────────┬────────────┘
           │ each parent re-split
           ▼
┌───────────────────────┐        ┌──────────────────────────────┐
│  Child Chunks (small) │───────►│  ChildVectorStoreService     │  (retrieval units)
│  + parentId           │        │  (embedded & indexed)        │
└───────────────────────┘        └──────────────────────────────┘
```

---

## 🧩 1. The Hierarchical Chunker

File: [`src/services/chunking.service.ts`](../code/src/services/chunking.service.ts)

This service is the heart of the lab. It performs a **two-pass split**: first the raw document → parents, then each parent → children.

```typescript
export interface ParentChildChunkResult {
  parents: ParentChunk[];
  children: ChildChunk[];
}

export class ChunkingService {
  private readonly CHARS_PER_TOKEN = 4;

  getDefaultConfig(): ChunkingConfig {
    return {
      parentChunkSize: config.defaultParentChunkSize,
      parentChunkOverlap: config.defaultParentChunkOverlap,
      childChunkSize: config.defaultChildChunkSize,
      childChunkOverlap: config.defaultChildChunkOverlap,
    };
  }

  estimateTokens(text: string): number {
    return Math.ceil(text.length / this.CHARS_PER_TOKEN);
  }
```

- `getDefaultConfig()` centralizes defaults so callers can override just one knob.
- `estimateTokens()` uses the standard **~4 characters ≈ 1 token** heuristic. We convert characters to tokens only for budgeting/benchmarking; chunking itself is character-based. `CHARS_PER_TOKEN` is a `readonly` field so it is impossible to mutate at runtime.

### Building the Hierarchy

```typescript
createParentChildChunks(
  doc: Document,
  overrides: Partial<ChunkingConfig> = {}
): ParentChildChunkResult {
  const cfg: ChunkingConfig = { ...this.getDefaultConfig(), ...overrides };

  // Guard against misconfiguration (overlap must be smaller than size).
  const parentOverlap = Math.min(cfg.parentChunkOverlap, Math.max(0, cfg.parentChunkSize - 1));
  const childOverlap = Math.min(cfg.childChunkOverlap, Math.max(0, cfg.childChunkSize - 1));

  const parentTexts = this.chunkText(doc.content, cfg.parentChunkSize, parentOverlap);
  const metadata = doc.metadata || {};

  const parents: ParentChunk[] = [];
  const children: ChildChunk[] = [];

  parentTexts.forEach((parentText, pIdx) => {
    const parentId = `${doc.id}::parent_${pIdx + 1}`;
    const childTexts = this.chunkText(parentText, cfg.childChunkSize, childOverlap);
    // …build children and parent (see next block)…
  });

  return { parents, children };
}
```

Three things to note:

1. **Overlap guard**: if someone configures `overlap >= size`, the splitter would either loop forever or produce degenerate chunks. We clamp overlap to `size - 1`. This is defensive programming — a senior engineer removes "can't-happen" foot-guns.
2. **Deterministic IDs**: `doc_leave_policy::parent_2::child_3`. IDs encode the full path, so a child's parent is recoverable by string parsing *and* by the explicit `parentId` field.
3. **Hierarchical nesting**: children are produced by splitting the *already-split parent text*, so a child can never straddle two parents.

Inside the `forEach`, children and their parent are constructed and wired together:

```typescript
const childrenOfParent: ChildChunk[] = childTexts.map((childText, cIdx) => ({
  id: `${parentId}::child_${cIdx + 1}`,
  parentId,                        // ← the small→big pointer
  documentId: doc.id,
  content: childText,
  chunkIndex: cIdx,
  totalChunks: childTexts.length,
  tokenEstimate: this.estimateTokens(childText),
  metadata: {
    ...metadata,
    section: metadata.section || metadata.title,
    parentIndex: pIdx,
    childIndex: cIdx,
  },
}));

parents.push({
  id: parentId,
  documentId: doc.id,
  content: parentText,
  parentIndex: pIdx,
  totalParents: parentTexts.length,
  childCount: childrenOfParent.length,
  childIds: childrenOfParent.map((c) => c.id),   // ← back-reference
  tokenEstimate: this.estimateTokens(parentText),
  metadata: {
    ...metadata,
    section: metadata.section || metadata.title,
    parentIndex: pIdx,
    childCount: childrenOfParent.length,
  },
});

children.push(...childrenOfParent);
```

> ✅ **Invariant enforced here**: `parent.childIds` is *exactly* the ordered list of children whose `parentId` equals `parent.id`. The test `chunking.service.test.ts` asserts this invariant, and the resolver in Chapter 5 relies on it.

### The Boundary-Aware Splitter

```typescript
chunkText(text: string, chunkSize: number, overlap: number): string[] {
  const cleanText = text.replace(/\s+/g, ' ').trim();
  if (!cleanText) return [];
  if (cleanText.length <= chunkSize) return [cleanText];

  const chunks: string[] = [];
  let start = 0;

  while (start < cleanText.length) {
    let end = Math.min(start + chunkSize, cleanText.length);

    if (end < cleanText.length) {
      // 1. Prefer to break after a sentence terminator.
      const lastPeriod = cleanText.lastIndexOf('. ', end);
      if (lastPeriod > start + chunkSize * 0.5) {
        end = lastPeriod + 1;
      } else {
        // 2. Otherwise break on the nearest whitespace boundary.
        const lastSpace = cleanText.lastIndexOf(' ', end);
        if (lastSpace > start) {
          end = lastSpace;
        }
      }
    }

    const piece = cleanText.slice(start, end).trim();
    if (piece) chunks.push(piece);
    if (end >= cleanText.length) break;

    // Advance with overlap, guaranteeing forward progress.
    start = Math.max(end - overlap, start + 1);
  }

  return chunks;
}
```

Splitter design decisions:

- **Whitespace normalization** (`/\s+/g → ' '`) makes chunk sizes predictable and prevents runaway token counts from newlines.
- **Sentence-first, word-second, character-last** breaking: cutting mid-sentence severs meaning; we only accept a mid-sentence cut when no boundary is available. The `> start + chunkSize * 0.5` guard prevents a break so early that chunks become tiny.
- **Guaranteed progress**: `start = Math.max(end - overlap, start + 1)` is the classic anti-infinite-loop guard. Even if overlap ≥ size (should be impossible after the earlier clamp), `start` always advances.

---

## 🗄️ 2. The Parent Store (Generation Context)

File: [`src/services/parent-store.service.ts`](../code/src/services/parent-store.service.ts)

The parent store is deliberately trivial: a `Map<string, ParentChunk>`. It holds **no embeddings** and performs **no search**. Its only job is to answer one question fast: *"Given this `parentId`, give me the full parent section."*

```typescript
export class ParentStoreService {
  private parents: Map<string, ParentChunk> = new Map();

  addParents(parents: ParentChunk[]): void {
    for (const parent of parents) {
      this.parents.set(parent.id, parent);   // upsert semantics
    }
  }

  getParent(parentId: string): ParentChunk | undefined {
    return this.parents.get(parentId);
  }

  getParents(parentIds: string[]): ParentChunk[] {
    const result: ParentChunk[] = [];
    for (const id of parentIds) {
      const parent = this.parents.get(id);
      if (parent) result.push(parent);        // preserve order, skip misses
    }
    return result;
  }

  getAllParents(): ParentChunk[] {
    return Array.from(this.parents.values());
  }

  size(): number { return this.parents.size; }
  isReady(): boolean { return this.parents.size > 0; }
  clear(): void { this.parents.clear(); }
}

export const parentStoreService = new ParentStoreService();
```

Key points:

- **`Map` for O(1) lookup** — parent resolution does thousands of lookups per query; a linear array scan would be O(n·k).
- **Upsert via `set`** — re-ingesting a document with the same id replaces its parents instead of duplicating them.
- **`getParents` preserves requested order** and silently skips unknown ids, so an orphaned child never crashes the pipeline.
- **Singleton export** at the bottom: `export const parentStoreService = new ParentStoreService()`. The whole app shares one in-memory store. (In production you would swap this for Redis/Postgres behind the *same interface* — that is the value of the service abstraction.)

---

## 🗂️ 3. The Child Vector Store (Retrieval Units)

File: [`src/services/vector-store.service.ts`](../code/src/services/vector-store.service.ts)

The child vector store embeds children and provides dense cosine search. This is the **only** index that is searched.

```typescript
export class ChildVectorStoreService {
  private children: ChildChunk[] = [];
  private isInitialized: boolean = false;

  async ingestChildren(children: ChildChunk[]): Promise<number> {
    if (children.length === 0) return 0;

    const textsToEmbed = children.map((c) => `${c.content} ${c.metadata.title || ''}`.trim());
    const embeddings = await embeddingService.getBatchEmbeddings(textsToEmbed);

    for (let i = 0; i < children.length; i++) {
      children[i].embedding = embeddings[i];
    }

    this.children = [...this.children, ...children];
    this.isInitialized = true;
    return children.length;
  }

  searchByVector(vector: number[], topK: number = 10): ChildSearchHit[] {
    if (this.children.length === 0 || !vector || vector.length === 0) return [];

    const scored: Array<{ child: ChildChunk; score: number }> = [];

    for (const child of this.children) {
      if (!child.embedding) continue;
      const similarity = embeddingService.cosineSimilarity(vector, child.embedding);
      scored.push({ child, score: similarity });
    }

    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, topK).map((entry, idx) => ({
      child: entry.child,
      score: entry.score,
      searchMethod: 'child_dense' as const,
      rank: idx + 1,
    }));
  }

  async searchByText(text: string, topK: number = 10): Promise<ChildSearchHit[]> {
    const vector = await embeddingService.getEmbedding(text);
    return this.searchByVector(vector, topK);
  }

  clear(): void { this.children = []; this.isInitialized = false; }
  getChildren(): ChildChunk[] { return this.children; }
  isReady(): boolean { return this.isInitialized && this.children.length > 0; }
}

export const vectorStoreService = new ChildVectorStoreService();
```

Design notes:

- **Rich text embedding**: `"${content} ${title}"` embeds the child text *plus its title*, giving the vector a little topical grounding.
- **Batch embedding**: `getBatchEmbeddings` sends one request for many children — far cheaper than N network round-trips.
- **`searchMethod: 'child_dense'`** tags each hit so the merger (Chapter 3) and reranker (Chapter 4) know *where* a candidate came from.
- **Ranks are 1-based** (`idx + 1`) because Reciprocal Rank Fusion uses rank directly.
- **Guard clauses** (`length === 0`, missing embedding) make search total — it never throws on an empty or partially-indexed store.

---

## 🧮 4. The Embedding Service (Dual-Engine, Offline-Safe)

File: [`src/services/embedding.service.ts`](../code/src/services/embedding.service.ts)

The embedding service produces 1536-dimensional L2-normalized vectors and works **with or without an API key**.

```typescript
export class EmbeddingService {
  private openai: OpenAI | null = null;
  private readonly dimension = 1536;

  constructor() {
    if (config.openaiApiKey) {
      this.openai = new OpenAI({ apiKey: config.openaiApiKey });
    }
  }

  async getEmbedding(text: string): Promise<number[]> {
    if (this.openai && config.openaiApiKey) {
      try {
        const response = await this.openai.embeddings.create({
          model: config.openaiEmbeddingModel,
          input: text.replace(/\n/g, ' '),
        });
        return response.data[0].embedding;
      } catch (error) {
        console.warn('OpenAI Embedding API call failed, using deterministic local embedding fallback:', error);
      }
    }
    return this.generateLocalDeterministicEmbedding(text);
  }

  async getBatchEmbeddings(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    // …single batched OpenAI call, else map over the local generator…
    return texts.map((t) => this.generateLocalDeterministicEmbedding(t));
  }
```

- **Dual mode**: production calls OpenAI `text-embedding-3-small`; if the key is absent *or* the call throws, it degrades gracefully to a deterministic local algorithm. This means the whole test suite runs offline with zero flakiness.
- **`try/catch` around the network call** is essential — a transient API error must not fail ingestion.

The local fallback is a **feature-hashing** projection with sub-word n-grams, then L2 normalization:

```typescript
private generateLocalDeterministicEmbedding(text: string): number[] {
  const vector = new Array(this.dimension).fill(0);
  const normalizedText = text.toLowerCase().trim();
  const tokens = normalizedText.split(/\W+/).filter(Boolean);

  for (const token of tokens) {
    const hash = this.hashString(token);
    vector[Math.abs(hash) % this.dimension] += hash % 2 === 0 ? 1.0 : -1.0;

    // 3-gram projections for partial sub-word overlap
    for (let i = 0; i <= token.length - 3; i++) {
      const triHash = this.hashString(token.slice(i, i + 3));
      vector[Math.abs(triHash) % this.dimension] += triHash % 2 === 0 ? 0.5 : -0.5;
    }
  }

  let sumSquares = 0;
  for (let i = 0; i < this.dimension; i++) sumSquares += vector[i] * vector[i];
  const norm = Math.sqrt(sumSquares);
  if (norm === 0) return vector;

  for (let i = 0; i < this.dimension; i++) vector[i] /= norm;
  return vector;
}

private hashString(str: string): number {
  let hash = 0x811c9dc5;                       // FNV-1a offset basis
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return hash >>> 0;
}

cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}
```

> 📐 Because vectors are L2-normalized, `cosineSimilarity` is mathematically equivalent to the dot product; the code still divides by the product of norms so it stays correct even for non-normalized inputs. `hashString` implements **FNV-1a**, a fast, well-distributed hash.

### Summary of Chapter 2

| Component | Stores | Indexed for search? | Purpose |
| :--- | :--- | :--- | :--- |
| `ChunkingService` | — (produces both) | — | Split document into linked parents & children |
| `ParentStoreService` | Parent chunks | ❌ no | Provide complete generation context by `parentId` |
| `ChildVectorStoreService` | Child chunks + embeddings | ✅ yes | High-precision dense retrieval units |
| `EmbeddingService` | — (produces vectors) | — | Dense embeddings, online or offline |

Next, proceed to **[Chapter 3 — Child Retrieval, BM25 & Fusion](./03-child-retrieval-bm25-and-fusion.md)**.



