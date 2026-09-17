import * as fs from 'fs';
import { FlatIndex } from '../indexes/flat';
import { HNSWIndex } from '../indexes/hnsw';
import { IVFIndex } from '../indexes/ivf';
import { VectorIndex } from '../indexes/base';
import { MetadataFilterEvaluator } from './filter';
import {
  IndexConfig,
  MetadataFilter,
  RetrievalResult,
  SimilarityMetric,
  VectorRecord,
} from '../schemas';

export interface VectorStoreOptions {
  indexConfig?: IndexConfig;
  dimension?: number;
}

export class VectorStore {
  private index: VectorIndex;
  private recordsMap: Map<string, VectorRecord> = new Map();
  private indexConfig: IndexConfig;

  constructor(options: VectorStoreOptions = {}) {
    this.indexConfig = options.indexConfig ?? { type: 'hnsw' };
    this.index = this.createIndex(this.indexConfig);
  }

  /**
   * Add a single record to vector store.
   */
  public async add(record: VectorRecord): Promise<void> {
    this.recordsMap.set(record.id, record);
    await this.index.insert(record);
  }

  /**
   * Add multiple vector records in batch.
   */
  public async addBatch(records: VectorRecord[]): Promise<void> {
    for (const record of records) {
      this.recordsMap.set(record.id, record);
    }
    await this.index.insertBatch(records);
  }

  /**
   * Search top-K similar vector records with optional metadata filtering and similarity threshold.
   */
  public async search(
    queryVector: number[],
    topK: number = 3,
    metric: SimilarityMetric = 'cosine',
    filter?: MetadataFilter,
    minSimilarityScore: number = 0
  ): Promise<RetrievalResult[]> {
    const filterFn = (record: VectorRecord) => MetadataFilterEvaluator.evaluate(record, filter);

    const searchResults = await this.index.search(queryVector, topK, metric, filterFn);

    const filtered = searchResults.filter((res) => res.score >= minSimilarityScore);

    return filtered.map((res) => ({
      chunk: res.record.chunk,
      score: res.score,
      distance: res.distance,
      metric,
      recordId: res.record.id,
    }));
  }

  /**
   * Delete record by ID.
   */
  public async remove(id: string): Promise<boolean> {
    this.recordsMap.delete(id);
    return this.index.remove(id);
  }

  /**
   * Clear all records and index state.
   */
  public async clear(): Promise<void> {
    this.recordsMap.clear();
    await this.index.clear();
  }

  /**
   * Get total count of records.
   */
  public count(): number {
    return this.recordsMap.size;
  }

  /**
   * Get active index type.
   */
  public getIndexType(): string {
    return this.indexConfig.type;
  }

  /**
   * Serialize vector store state to a JSON file.
   */
  public async saveToFile(filePath: string): Promise<void> {
    const records = Array.from(this.recordsMap.values());
    const data = JSON.stringify({ indexConfig: this.indexConfig, records }, null, 2);
    await fs.promises.writeFile(filePath, data, 'utf-8');
  }

  /**
   * Deserialize vector store state from a JSON file.
   */
  public async loadFromFile(filePath: string): Promise<void> {
    const raw = await fs.promises.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw);

    this.indexConfig = parsed.indexConfig || { type: 'hnsw' };
    this.index = this.createIndex(this.indexConfig);
    await this.clear();

    const records: VectorRecord[] = parsed.records || [];
    await this.addBatch(records);
  }

  private createIndex(config: IndexConfig): VectorIndex {
    switch (config.type) {
      case 'flat':
        return new FlatIndex();
      case 'ivf':
        return new IVFIndex(config.ivf);
      case 'hnsw':
      default:
        return new HNSWIndex(config.hnsw);
    }
  }
}
