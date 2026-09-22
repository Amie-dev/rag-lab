# 💻 Chapter 8 — Interactive CLI, Sample Data & Testing Suite

Welcome to Chapter 8 of the **Metadata-Filtered RAG Implementation Guide**. In this final chapter, we cover the Commander CLI tool, the enterprise sample dataset, and the automated Jest testing suite.

Source code modules:
- [`05-metadata-filtering/code/src/cli.ts`](../code/src/cli.ts)
- [`05-metadata-filtering/code/sample_data/enterprise_documents.json`](../code/sample_data/enterprise_documents.json)
- [`05-metadata-filtering/code/tests/`](../code/tests/)

---

## 1. Enterprise Sample Dataset

File: [`05-metadata-filtering/code/sample_data/enterprise_documents.json`](../code/sample_data/enterprise_documents.json)

```json
[
  {
    "id": "doc_tenant101_refund_pdf",
    "content": "Tenant 101 Official Finance Policy: Refund requests for annual enterprise software subscriptions are processed within 14 business days. All customer refunds require dual approval from the Finance department controller.",
    "metadata": {
      "tenant_id": "tenant_101",
      "department": "finance",
      "file_type": "pdf",
      "document_type": "policy",
      "created_at": "2026-03-15",
      "access_level": 2,
      "is_public": false,
      "language": "en"
    }
  },
  {
    "id": "doc_tenant102_refund_pdf",
    "content": "Tenant 102 Enterprise Policy: All purchases are final and non-refundable unless stated in custom service level agreement contracts.",
    "metadata": {
      "tenant_id": "tenant_102",
      "department": "finance",
      "file_type": "pdf",
      "document_type": "policy",
      "created_at": "2026-02-01",
      "access_level": 2,
      "is_public": false,
      "language": "en"
    }
  }
]
```

---

## 2. Interactive CLI Tool

File: [`05-metadata-filtering/code/src/cli.ts`](../code/src/cli.ts)

```typescript
import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { RAGService } from './services/ragService';
import { BenchmarkService } from './services/benchmarkService';
import { AuthenticatedUser, IngestDocumentDTO } from './types/api.types';
import { MetadataFilter } from './types/filter.types';

const program = new Command();
const ragService = new RAGService();
const benchmarkService = new BenchmarkService(ragService);

program
  .name('metadata-rag')
  .description('Production-Grade Metadata-Filtered RAG Engine CLI')
  .version('1.0.0');

program
  .command('seed')
  .description('Seed the in-memory vector store with enterprise sample documents')
  .action(async () => {
    console.log('Seeding enterprise sample data...');
    // Seed logic...
  });

program
  .command('search')
  .description('Execute metadata-filtered vector search')
  .requiredOption('-q, --query <text>', 'Search query string')
  .option('-t, --tenant <tenantId>', 'Tenant ID filter', 'tenant_101')
  .option('-m, --mode <mode>', 'Search mode: pre-filter or post-filter', 'pre-filter')
  .action(async (options) => {
    // Search execution...
  });

program
  .command('query')
  .description('Execute full Metadata-Filtered RAG pipeline')
  .requiredOption('-q, --question <text>', 'User question')
  .option('-t, --tenant <tenantId>', 'Tenant ID', 'tenant_101')
  .action(async (options) => {
    // RAG execution...
  });

program
  .command('benchmark')
  .description('Run Pre-Filtering vs Post-Filtering benchmark analysis')
  .action(async (options) => {
    // Benchmark execution...
  });

program.parse(process.argv);
```

---

## 3. Automated Test Suite

The test suite contains 4 comprehensive test files in `tests/`:

### 1. `filterEvaluator.test.ts`
Tests `$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`, `$in`, `$nin`, `$contains`, and logical `$and`, `$or`, `$not` predicate evaluation.

### 2. `vectorStore.test.ts`
Tests `searchPreFiltered` vs `searchPostFiltered` on memory vector store, verifying that post-filtering suffers candidate starvation when global top-N limit is smaller than non-matching candidates.

### 3. `multiTenantAuth.test.ts`
Tests `SecurityFilterBuilder.buildAuthorizedFilter()`, verifying that malicious attempts to override `tenant_id` in client query payloads are safely sanitized.

### 4. `apiRoutes.test.ts`
Integration testing of Express routes (`/health`, `/documents/ingest`, `/search`, `/rag/query`, `/benchmark/filter-comparison`) using `supertest`.

---

## 4. Running the Tests

```bash
# Navigate to code directory
cd 05-metadata-filtering/code

# Run Jest tests
npm test
```

Expected output:
```text
PASS tests/multiTenantAuth.test.ts
PASS tests/filterEvaluator.test.ts
PASS tests/vectorStore.test.ts
PASS tests/apiRoutes.test.ts

Test Suites: 4 passed, 4 total
Tests:       16 passed, 16 total
Snapshots:   0 total
Time:        4.188 s
```
