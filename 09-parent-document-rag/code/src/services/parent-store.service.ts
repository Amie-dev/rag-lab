import { ParentChunk } from '../types';

/**
 * ParentStoreService holds large parent chunks by ID.
 *
 * Parents are deliberately NOT embedded or indexed for retrieval — this store
 * exists solely to resolve a `parentId` discovered during child retrieval into
 * the complete, coherent generation context.
 */
export class ParentStoreService {
  private parents: Map<string, ParentChunk> = new Map();

  /**
   * Adds (or replaces) a collection of parent chunks.
   */
  addParents(parents: ParentChunk[]): void {
    for (const parent of parents) {
      this.parents.set(parent.id, parent);
    }
  }

  /**
   * Retrieves a single parent chunk by its ID.
   */
  getParent(parentId: string): ParentChunk | undefined {
    return this.parents.get(parentId);
  }

  /**
   * Retrieves multiple parent chunks by ID, preserving the requested order and
   * skipping any IDs that are not present.
   */
  getParents(parentIds: string[]): ParentChunk[] {
    const result: ParentChunk[] = [];
    for (const id of parentIds) {
      const parent = this.parents.get(id);
      if (parent) result.push(parent);
    }
    return result;
  }

  /**
   * Returns all stored parent chunks.
   */
  getAllParents(): ParentChunk[] {
    return Array.from(this.parents.values());
  }

  /**
   * Number of stored parents.
   */
  size(): number {
    return this.parents.size;
  }

  /**
   * Indicates whether the parent store currently holds any chunks.
   */
  isReady(): boolean {
    return this.parents.size > 0;
  }

  /**
   * Clears the parent store.
   */
  clear(): void {
    this.parents.clear();
  }
}

export const parentStoreService = new ParentStoreService();
