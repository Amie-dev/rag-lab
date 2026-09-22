/**
 * In-Memory Vector Store with Pre-Filtering and Post-Filtering Engine
 */

import { Chunk, VectorRecord } from '../types/document.types';
import { MetadataFilter, RetrievalOptions, RetrievalResult, SearchMode } from '../types/filter.types';
import { FilterEvaluator } from '../filters/evaluator';
import { DistanceMetrics } from './distance';

export class MemoryVectorStore {
  private records: Map<string, VectorRecord> = new Map();

  /**
   * Adds or updates a vector record in the store.
   */
  public addRecord(record: VectorRecord): void {
    this.records.set(record.id, record);
  }

  /**
   * Adds a batch of records.
   */
  public addRecords(records: VectorRecord[]): void {
    for (const rec of records) {
      this.addRecord(rec);
    }
  }

  /**
   * Retrieves a record by ID.
   */
  public getRecord(id: string): VectorRecord | undefined {
    return this.records.get(id);
  }

  /**
   * Deletes all records belonging to a specific document ID.
   */
  public deleteDocument(documentId: string): number {
    let deletedCount = 0;
    for (const [id, record] of this.records.entries()) {
      if (record.chunk.metadata.document_id === documentId) {
        this.records.delete(id);
        deletedCount++;
      }
    }
    return deletedCount;
  }

  /**
   * Clears all records in store.
   */
  public clear(): void {
    this.records.clear();
  }

  /**
   * Main search API supporting pre-filtering and post-filtering execution modes.
   */
  public search(
    queryVector: number[],
    filter?: MetadataFilter,
    options: RetrievalOptions = {}
  ): {
    results: RetrievalResult[];
    candidatesEvaluated: number;
    mode: SearchMode;
  } {
    const mode = options.mode || 'pre-filter';

    if (mode === 'pre-filter') {
      return this.searchPreFiltered(queryVector, filter, options.topK || 5);
    } else {
      return this.searchPostFiltered(
        queryVector,
        filter,
        options.topK || 5,
        options.postFilterCandidateLimit || 10
      );
    }
  }

  /**
   * 1️⃣ Pre-Filtering Retrieval
   * Filter constraint applied BEFORE vector distance calculation.
   * Only documents passing the metadata filter are evaluated and ranked.
   */
  public searchPreFiltered(
    queryVector: number[],
    filter?: MetadataFilter,
    topK: number = 5
  ): {
    results: RetrievalResult[];
    candidatesEvaluated: number;
    mode: SearchMode;
  } {
    const validCandidates: Array<{ record: VectorRecord; score: number }> = [];
    let candidatesEvaluated = 0;

    for (const record of this.records.values()) {
      // Step 1: Pre-filter evaluation
      const passesFilter = FilterEvaluator.evaluate(record.metadata, filter);
      if (!passesFilter) {
        continue;
      }

      // Step 2: Distance calculation on valid candidate
      candidatesEvaluated++;
      const score = DistanceMetrics.cosineSimilarity(queryVector, record.vector);

      validCandidates.push({ record, score });
    }

    // Step 3: Sort by cosine similarity descending
    validCandidates.sort((a, b) => b.score - a.score);

    const topResults = validCandidates.slice(0, topK).map((item) => ({
      chunk: item.record.chunk,
      score: item.score,
      recordId: item.record.id,
      metadataMatch: true,
    }));

    return {
      results: topResults,
      candidatesEvaluated,
      mode: 'pre-filter',
    };
  }

  /**
   * 2️⃣ Post-Filtering Retrieval
   * Global vector similarity search performed first across global index to get Top-N candidates.
   * Metadata filter is then applied AFTER global vector search.
   */
  public searchPostFiltered(
    queryVector: number[],
    filter?: MetadataFilter,
    topK: number = 5,
    globalCandidateLimit: number = 10
  ): {
    results: RetrievalResult[];
    candidatesEvaluated: number;
    mode: SearchMode;
  } {
    const globalScoredRecords: Array<{ record: VectorRecord; score: number }> = [];

    // Step 1: Compute vector similarity for ALL records globally
    for (const record of this.records.values()) {
      const score = DistanceMetrics.cosineSimilarity(queryVector, record.vector);
      globalScoredRecords.push({ record, score });
    }

    // Sort globally by score descending
    globalScoredRecords.sort((a, b) => b.score - a.score);

    // Step 2: Take top-N global vector candidates
    const topGlobalCandidates = globalScoredRecords.slice(0, globalCandidateLimit);

    // Step 3: Apply post-filtering onto global top-N candidates
    const filteredResults: RetrievalResult[] = [];
    for (const item of topGlobalCandidates) {
      const passesFilter = FilterEvaluator.evaluate(item.record.metadata, filter);

      if (passesFilter) {
        filteredResults.push({
          chunk: item.record.chunk,
          score: item.score,
          recordId: item.record.id,
          metadataMatch: true,
        });

        if (filteredResults.length >= topK) {
          break;
        }
      }
    }

    return {
      results: filteredResults,
      candidatesEvaluated: topGlobalCandidates.length,
      mode: 'post-filter',
    };
  }

  /**
   * Index Statistics
   */
  public getStats(): {
    totalRecords: number;
    tenants: string[];
    departments: string[];
  } {
    const tenants = new Set<string>();
    const departments = new Set<string>();

    for (const record of this.records.values()) {
      if (record.metadata.tenant_id) {
        tenants.add(record.metadata.tenant_id);
      }
      if (record.metadata.department) {
        departments.add(record.metadata.department);
      }
    }

    return {
      totalRecords: this.records.size,
      tenants: Array.from(tenants),
      departments: Array.from(departments),
    };
  }
}
