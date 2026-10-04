import { ChunkingConfig, Document, IngestionStats } from '../types';
import { chunkingService } from './chunking.service';
import { parentStoreService } from './parent-store.service';
import { vectorStoreService } from './vector-store.service';

/**
 * IndexingService orchestrates the Parent-Document ingestion pipeline:
 *
 *   Raw Documents
 *        ↓
 *   Parent Chunks  →  Parent Store           (generation context)
 *        ↓
 *   Child Chunks   →  Embed  →  Child Vector Index   (retrieval units)
 *
 * It is the single entry point the API/CLI uses to load knowledge into the
 * in-memory stores.
 */
export class IndexingService {
  /**
   * Ingests documents, building the parent/child hierarchy and populating both
   * the parent store and the child vector index.
   */
  async ingestDocuments(
    docs: Document[],
    overrides: Partial<ChunkingConfig> = {}
  ): Promise<IngestionStats> {
    let parentsCreated = 0;
    let childrenCreated = 0;

    for (const doc of docs) {
      const { parents, children } = chunkingService.createParentChildChunks(doc, overrides);

      parentStoreService.addParents(parents);
      await vectorStoreService.ingestChildren(children);

      parentsCreated += parents.length;
      childrenCreated += children.length;
    }

    return {
      documentsIngested: docs.length,
      parentsCreated,
      childrenCreated,
      totalParents: parentStoreService.size(),
      totalChildren: vectorStoreService.getChildren().length,
    };
  }

  /**
   * Resets both the parent store and the child vector index.
   */
  reset(): void {
    parentStoreService.clear();
    vectorStoreService.clear();
  }

  /**
   * Indicates whether the knowledge base has been populated.
   */
  isReady(): boolean {
    return parentStoreService.isReady() && vectorStoreService.isReady();
  }
}

export const indexingService = new IndexingService();
