import { Document, Chunk } from '../schemas';

export interface TextSplitter {
  /**
   * Split a document into manageable chunks with overlap and metadata.
   */
  splitDocument(document: Document): Chunk[];

  /**
   * Batch split multiple documents.
   */
  splitDocuments(documents: Document[]): Chunk[];
}
