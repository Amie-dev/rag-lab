import * as fs from 'fs';
import * as path from 'path';
import { TextDocumentLoader } from '../src/loaders/text';

describe('TextDocumentLoader', () => {
  const loader = new TextDocumentLoader();
  const tempDir = path.join(__dirname, 'temp_loader_test');
  const sampleFile = path.join(tempDir, 'test.txt');

  beforeAll(() => {
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    fs.writeFileSync(sampleFile, 'Hello World Basic RAG Test Document', 'utf-8');
  });

  afterAll(() => {
    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('loads document from inline string', async () => {
    const docs = await loader.load('Inline test content for RAG');
    expect(docs).toHaveLength(1);
    expect(docs[0].content).toBe('Inline test content for RAG');
    expect(docs[0].metadata.source).toBe('inline_text_input');
  });

  test('loads document from file path', async () => {
    const docs = await loader.load(sampleFile);
    expect(docs).toHaveLength(1);
    expect(docs[0].content).toBe('Hello World Basic RAG Test Document');
    expect(docs[0].metadata.filename).toBe('test.txt');
  });

  test('loads directory of files', async () => {
    const docs = await loader.loadDirectory(tempDir);
    expect(docs.length).toBeGreaterThanOrEqual(1);
  });
});
