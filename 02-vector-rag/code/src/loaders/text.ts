import * as fs from 'fs';
import * as path from 'path';
import { Document } from '../schemas';

export interface DocumentLoader {
  load(): Promise<Document[]>;
}

export class FileDocumentLoader implements DocumentLoader {
  private filePathOrDir: string;

  constructor(filePathOrDir: string) {
    this.filePathOrDir = filePathOrDir;
  }

  public async load(): Promise<Document[]> {
    const stats = await fs.promises.stat(this.filePathOrDir);

    if (stats.isDirectory()) {
      return this.loadDirectory(this.filePathOrDir);
    } else {
      return [await this.loadFile(this.filePathOrDir)];
    }
  }

  private async loadDirectory(dirPath: string): Promise<Document[]> {
    const files = await fs.promises.readdir(dirPath);
    const documents: Document[] = [];

    for (const file of files) {
      const fullPath = path.join(dirPath, file);
      const stat = await fs.promises.stat(fullPath);
      if (stat.isFile() && this.isSupportedExtension(file)) {
        documents.push(await this.loadFile(fullPath));
      }
    }

    return documents;
  }

  private async loadFile(filePath: string): Promise<Document> {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const filename = path.basename(filePath);
    const ext = path.extname(filePath).replace('.', '');

    return {
      id: `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      content,
      metadata: {
        source: filePath,
        filename,
        fileType: ext,
        createdAt: new Date().toISOString(),
      },
    };
  }

  private isSupportedExtension(filename: string): boolean {
    const supported = ['.txt', '.md', '.markdown', '.json', '.csv', '.html'];
    return supported.includes(path.extname(filename).toLowerCase());
  }
}
