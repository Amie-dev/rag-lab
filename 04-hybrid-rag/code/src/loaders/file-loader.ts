import * as fs from 'fs';
import * as path from 'path';
import { Document } from '../schemas';

export class FileLoader {
  static loadFile(filePath: string): Document {
    const absolutePath = path.resolve(filePath);
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`File not found: ${absolutePath}`);
    }

    const content = fs.readFileSync(absolutePath, 'utf-8');
    const filename = path.basename(absolutePath);
    const fileType = path.extname(absolutePath).slice(1);

    return {
      id: `doc_${filename}_${Date.now()}`,
      content,
      metadata: {
        source: absolutePath,
        filename,
        fileType,
        createdAt: new Date().toISOString()
      }
    };
  }

  static loadDirectory(dirPath: string): Document[] {
    const absoluteDir = path.resolve(dirPath);
    if (!fs.existsSync(absoluteDir) || !fs.statSync(absoluteDir).isDirectory()) {
      throw new Error(`Directory not found: ${absoluteDir}`);
    }

    const files = fs.readdirSync(absoluteDir);
    const documents: Document[] = [];

    for (const file of files) {
      const fullPath = path.join(absoluteDir, file);
      const stat = fs.statSync(fullPath);

      if (stat.isFile() && (file.endsWith('.md') || file.endsWith('.txt'))) {
        documents.push(this.loadFile(fullPath));
      }
    }

    return documents;
  }
}
