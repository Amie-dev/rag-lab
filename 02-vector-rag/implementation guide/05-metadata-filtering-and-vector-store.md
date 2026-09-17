# Chapter 5 — Metadata Payload Filtering & Vector Database

Production Vector RAG databases must support combining **semantic vector similarity search** with **structured metadata query filtering** (e.g., searching for documents where `category == 'pets'` AND `year >= 2024`).

This chapter covers the MongoDB-style payload filtering engine and the `VectorStore` facade.

Source code locations:
- [`src/vectordb/filter.ts`](../code/src/vectordb/filter.ts)
- [`src/vectordb/vectorStore.ts`](../code/src/vectordb/vectorStore.ts)
- [`tests/vectorStore.test.ts`](../code/tests/vectorStore.test.ts)

---

## 1. Metadata Payload Filtering Engine

The `MetadataFilterEvaluator` evaluates metadata field values against query expressions before or during vector index search:

```typescript
import { MetadataFilter, VectorRecord } from '../schemas';

export class MetadataFilterEvaluator {
  public static evaluate(record: VectorRecord, filter?: MetadataFilter): boolean {
    if (!filter || Object.keys(filter).length === 0) return true;

    const metadata = { ...record.metadata, ...record.chunk?.metadata };

    for (const [key, value] of Object.entries(filter)) {
      if (key === '$and') {
        const subFilters = value as MetadataFilter[];
        if (!subFilters.every((sub) => this.evaluate(record, sub))) return false;
        continue;
      }

      if (key === '$or') {
        const subFilters = value as MetadataFilter[];
        if (!subFilters.some((sub) => this.evaluate(record, sub))) return false;
        continue;
      }

      const fieldValue = metadata[key];

      // Exact value match
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        if (Array.isArray(value)) {
          if (!value.includes(fieldValue as any)) return false;
        } else if (fieldValue !== value) {
          return false;
        }
        continue;
      }

      // Operator dictionary ($eq, $ne, $gt, $gte, $lt, $lte, $in, $nin)
      const condition = value as Record<string, unknown>;
      for (const [op, val] of Object.entries(condition)) {
        switch (op) {
          case '$eq': if (fieldValue !== val) return false; break;
          case '$ne': if (fieldValue === val) return false; break;
          case '$gt': if (typeof fieldValue !== 'number' || fieldValue <= (val as number)) return false; break;
          case '$gte': if (typeof fieldValue !== 'number' || fieldValue < (val as number)) return false; break;
          case '$lt': if (typeof fieldValue !== 'number' || fieldValue >= (val as number)) return false; break;
          case '$lte': if (typeof fieldValue !== 'number' || fieldValue > (val as number)) return false; break;
          case '$in': if (!Array.isArray(val) || !val.includes(fieldValue as any)) return false; break;
          case '$nin': if (Array.isArray(val) && val.includes(fieldValue as any)) return false; break;
        }
      }
    }

    return true;
  }
}
```

---

## 2. VectorStore Manager & JSON Persistence

The `VectorStore` class wraps index strategy instantiations, executes query filtering, enforces similarity score thresholds, and supports saving/loading vector store state to disk:

```typescript
import * as fs from 'fs';
import { FlatIndex } from '../indexes/flat';
import { HNSWIndex } from '../indexes/hnsw';
import { IVFIndex } from '../indexes/ivf';
import { VectorIndex } from '../indexes/base';
import { MetadataFilterEvaluator } from './filter';
import { IndexConfig, MetadataFilter, RetrievalResult, SimilarityMetric, VectorRecord } from '../schemas';

export class VectorStore {
  private index: VectorIndex;
  private recordsMap: Map<string, VectorRecord> = new Map();
  private indexConfig: IndexConfig;

  constructor(options: { indexConfig?: IndexConfig } = {}) {
    this.indexConfig = options.indexConfig ?? { type: 'hnsw' };
    this.index = this.createIndex(this.indexConfig);
  }

  public async search(
    queryVector: number[],
    topK: number = 3,
    metric: SimilarityMetric = 'cosine',
    filter?: MetadataFilter,
    minSimilarityScore: number = 0
  ): Promise<RetrievalResult[]> {
    const filterFn = (record: VectorRecord) => MetadataFilterEvaluator.evaluate(record, filter);
    const searchResults = await this.index.search(queryVector, topK, metric, filterFn);

    return searchResults
      .filter((res) => res.score >= minSimilarityScore)
      .map((res) => ({
        chunk: res.record.chunk,
        score: res.score,
        distance: res.distance,
        metric,
        recordId: res.record.id,
      }));
  }

  public async saveToFile(filePath: string): Promise<void> {
    const records = Array.from(this.recordsMap.values());
    const data = JSON.stringify({ indexConfig: this.indexConfig, records }, null, 2);
    await fs.promises.writeFile(filePath, data, 'utf-8');
  }

  private createIndex(config: IndexConfig): VectorIndex {
    switch (config.type) {
      case 'flat': return new FlatIndex();
      case 'ivf': return new IVFIndex(config.ivf);
      case 'hnsw': default: return new HNSWIndex(config.hnsw);
    }
  }
}
```

---

## 3. Unit Test Verification

Verified in [`tests/vectorStore.test.ts`](../code/tests/vectorStore.test.ts):

```typescript
describe('VectorStore & Metadata Filtering Suite', () => {
  it('should support metadata filtering and score thresholding', async () => {
    const store = new VectorStore({ indexConfig: { type: 'flat' } });
    await store.addBatch(sampleRecords);

    const filtered = await store.search([1, 0, 0], 5, 'cosine', {
      category: 'pets',
      year: { $gte: 2023 },
    }, 0.8);

    expect(filtered.length).toBe(1);
    expect(filtered[0].recordId).toBe('rec_cat_1');
  });
});
```
