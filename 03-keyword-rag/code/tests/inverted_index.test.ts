import * as fs from 'fs';
import * as path from 'path';
import { InvertedIndex } from '../src/index/inverted_index';
import { StandardAnalyzer } from '../src/analysis/analyzer';
import { Chunk } from '../src/schemas';

describe('Inverted Index Data Structure', () => {
  let index: InvertedIndex;
  let analyzer: StandardAnalyzer;

  beforeEach(() => {
    index = new InvertedIndex();
    analyzer = new StandardAnalyzer();
  });

  const createSampleChunk = (id: string, content: string): Chunk => ({
    id,
    content,
    metadata: {
      documentId: `doc_${id}`,
      chunkIndex: 0,
      source: 'test.md',
    },
  });

  test('Indexes chunks and updates term statistics correctly', () => {
    const chunk1 = createSampleChunk('c1', 'Database connection failed with timeout');
    const chunk2 = createSampleChunk('c2', 'Database performance optimization guide');

    index.addChunk(chunk1, analyzer.analyze(chunk1.content));
    index.addChunk(chunk2, analyzer.analyze(chunk2.content));

    expect(index.getTotalDocuments()).toBe(2);
    expect(index.getDocumentFrequency('databas')).toBe(2);
    expect(index.getDocumentFrequency('timeout')).toBe(1);

    const postings = index.getPostings('databas');
    expect(postings.length).toBe(2);
    expect(postings[0].termFrequency).toBe(1);
  });

  test('Removes chunk and updates statistics accurately', () => {
    const chunk1 = createSampleChunk('c1', 'Database connection timeout');
    const chunk2 = createSampleChunk('c2', 'Network timeout error');

    index.addChunk(chunk1, analyzer.analyze(chunk1.content));
    index.addChunk(chunk2, analyzer.analyze(chunk2.content));

    expect(index.getDocumentFrequency('timeout')).toBe(2);

    index.removeChunk('c1');

    expect(index.getTotalDocuments()).toBe(1);
    expect(index.getDocumentFrequency('timeout')).toBe(1);
    expect(index.getDocumentFrequency('databas')).toBe(0);
  });

  test('Serializes and deserializes inverted index state', () => {
    const chunk1 = createSampleChunk('c1', 'Stripe payment integration');
    index.addChunk(chunk1, analyzer.analyze(chunk1.content));

    const serialized = index.serialize();
    expect(serialized.version).toBe('1.0.0');
    expect(serialized.stats.totalDocuments).toBe(1);

    const newIndex = new InvertedIndex();
    newIndex.deserialize(serialized);

    expect(newIndex.getTotalDocuments()).toBe(1);
    expect(newIndex.getDocumentFrequency('stripe')).toBe(1);
  });

  test('Saves to and loads from file on disk', async () => {
    const tmpDir = path.join(__dirname, '../scratch');
    const tmpFile = path.join(tmpDir, 'test_index.json');

    const chunk = createSampleChunk('c1', 'File persistence test');
    index.addChunk(chunk, analyzer.analyze(chunk.content));

    await index.saveToFile(tmpFile);
    expect(fs.existsSync(tmpFile)).toBe(true);

    const loadedIndex = new InvertedIndex();
    await loadedIndex.loadFromFile(tmpFile);

    expect(loadedIndex.getTotalDocuments()).toBe(1);
    expect(loadedIndex.getDocumentFrequency('persist')).toBe(1);

    if (fs.existsSync(tmpFile)) {
      fs.unlinkSync(tmpFile);
    }
  });
});
