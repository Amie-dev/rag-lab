import { RecursiveCharacterTextSplitter } from '../src/splitters/character';
import { TokenTextSplitter } from '../src/splitters/token';
import { Document } from '../src/schemas';

describe('TextSplitters', () => {
  const doc: Document = {
    id: 'doc_1',
    content: 'Paragraph 1: Basic RAG connects vector DB to LLM.\n\nParagraph 2: Chunking splits large documents into smaller pieces so they can be embedded accurately.',
    metadata: { source: 'unit_test' },
  };

  test('RecursiveCharacterTextSplitter chunks text with overlap', () => {
    const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 60, chunkOverlap: 10 });
    const chunks = splitter.splitDocument(doc);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].metadata.documentId).toBe('doc_1');
    expect(chunks[0].metadata.chunkIndex).toBe(0);
  });

  test('TokenTextSplitter chunks text based on estimated tokens', () => {
    const splitter = new TokenTextSplitter({ maxTokens: 10, overlapTokens: 2 });
    const chunks = splitter.splitDocument(doc);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].metadata.documentId).toBe('doc_1');
  });
});
