import { Document } from '../schemas';

export interface DocumentLoader {
  /**
   * Load and extract structured Document from file path or content string.
   */
  load(filePathOrContent: string): Promise<Document[]>;

  /**
   * Supported file extensions (e.g., ['.txt', '.md']).
   */
  supportedExtensions(): string[];
}
