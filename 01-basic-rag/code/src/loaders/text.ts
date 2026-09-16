import * as fs from 'fs';
import * as path from 'path';
import { DocumentLoader } from './base';
import { Document } from '../schemas';

export class TextDocumentLoader implements DocumentLoader {
  supportedExtensions(): string[] {
    return ['.txt', '.md', '.markdown', '.log', '.json', '.csv', '.html'];
  }

  async load(filePathOrContent: string): Promise<Document[]> {
    let content: string;
    let source: string;
    let filename: string | undefined;
    let fileType = 'text/plain';

    if (fs.existsSync(filePathOrContent) && fs.statSync(filePathOrContent).isFile()) {
      source = path.resolve(filePathOrContent);
      filename = path.basename(filePathOrContent);
      content = fs.readFileSync(filePathOrContent, 'utf-8');
      const ext = path.extname(filePathOrContent).toLowerCase();
      if (ext === '.md' || ext === '.markdown') fileType = 'text/markdown';
      else if (ext === '.json') fileType = 'application/json';
      else if (ext === '.html') fileType = 'text/html';
    } else {
      source = 'inline_text_input';
      content = filePathOrContent;
    }

    if (!content.trim()) {
      return [];
    }

    const docId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    return [
      {
        id: docId,
        content: content.trim(),
        metadata: {
          source,
          filename,
          fileType,
          createdAt: new Date().toISOString(),
        },
      },
    ];
  }

  async loadDirectory(dirPath: string): Promise<Document[]> {
    if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
      throw new Error(`Directory path does not exist or is not a directory: ${dirPath}`);
    }

    const files = fs.readdirSync(dirPath);
    const documents: Document[] = [];
    const exts = this.supportedExtensions();

    for (const file of files) {
      const fullPath = path.join(dirPath, file);
      const stat = fs.statSync(fullPath);
      if (stat.isFile()) {
        const ext = path.extname(file).toLowerCase();
        if (exts.includes(ext)) {
          const docs = await this.load(fullPath);
          documents.push(...docs);
        }
      }
    }

    return documents;
  }
}
