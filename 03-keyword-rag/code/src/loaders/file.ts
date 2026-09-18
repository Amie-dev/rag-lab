import * as fs from 'fs';
import * as path from 'path';
import { Document, DocumentMetadata } from '../schemas';

export interface DocumentLoader {
  load(): Promise<Document[]>;
}

export class TextFileLoader implements DocumentLoader {
  private filePath: string;
  private customMetadata: Partial<DocumentMetadata>;

  constructor(filePath: string, customMetadata: Partial<DocumentMetadata> = {}) {
    this.filePath = path.resolve(filePath);
    this.customMetadata = customMetadata;
  }

  public async load(): Promise<Document[]> {
    if (!fs.existsSync(this.filePath)) {
      throw new Error(`File not found: ${this.filePath}`);
    }

    const content = await fs.promises.readFile(this.filePath, 'utf8');
    const filename = path.basename(this.filePath);
    const ext = path.extname(this.filePath).toLowerCase();

    const metadata: DocumentMetadata = {
      source: this.filePath,
      filename,
      fileType: ext.replace('.', '') || 'text',
      createdAt: new Date().toISOString(),
      ...this.customMetadata,
    };

    return [
      {
        id: `doc_${path.parse(filename).name}_${Date.now()}`,
        content,
        metadata,
      },
    ];
  }
}

export class MarkdownLoader extends TextFileLoader {
  constructor(filePath: string, customMetadata: Partial<DocumentMetadata> = {}) {
    super(filePath, { fileType: 'markdown', ...customMetadata });
  }
}

export class DirectoryLoader implements DocumentLoader {
  private dirPath: string;
  private extensions: string[];

  constructor(dirPath: string, extensions: string[] = ['.md', '.txt']) {
    this.dirPath = path.resolve(dirPath);
    this.extensions = extensions.map((e) => (e.startsWith('.') ? e.toLowerCase() : `.${e.toLowerCase()}`));
  }

  public async load(): Promise<Document[]> {
    if (!fs.existsSync(this.dirPath)) {
      throw new Error(`Directory not found: ${this.dirPath}`);
    }

    const documents: Document[] = [];
    await this.scanDirectory(this.dirPath, documents);
    return documents;
  }

  private async scanDirectory(currentPath: string, docs: Document[]): Promise<void> {
    const entries = await fs.promises.readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        await this.scanDirectory(fullPath, docs);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (this.extensions.includes(ext)) {
          const loader = new TextFileLoader(fullPath);
          const loadedDocs = await loader.load();
          docs.push(...loadedDocs);
        }
      }
    }
  }
}
