import { chunkingService } from '../src/services/chunking.service';
import { Document } from '../src/types';

describe('ChunkingService', () => {
  const buildDoc = (): Document => ({
    id: 'doc_test',
    content: Array.from(
      { length: 15 },
      (_, i) => `Sentence ${i + 1} explains the policy in detail for section ${Math.floor(i / 3) + 1}.`
    ).join(' '),
    metadata: { title: 'Test Policy' },
  });

  it('creates parents and children wired through parentId', () => {
    const { parents, children } = chunkingService.createParentChildChunks(buildDoc(), {
      parentChunkSize: 300,
      parentChunkOverlap: 40,
      childChunkSize: 120,
      childChunkOverlap: 20,
    });

    expect(parents.length).toBeGreaterThan(0);
    expect(children.length).toBeGreaterThanOrEqual(parents.length);

    const parentIds = new Set(parents.map((p) => p.id));
    for (const child of children) {
      expect(parentIds.has(child.parentId)).toBe(true);
      expect(child.documentId).toBe('doc_test');
      expect(child.content.length).toBeGreaterThan(0);
    }

    // parent.childIds must exactly match the children pointing at it (in order)
    const firstParent = parents[0];
    const firstParentChildren = children.filter((c) => c.parentId === firstParent.id);
    expect(firstParent.childCount).toBe(firstParentChildren.length);
    expect(firstParent.childIds).toEqual(firstParentChildren.map((c) => c.id));
  });

  it('populates token estimates and metadata on parents and children', () => {
    const { parents, children } = chunkingService.createParentChildChunks(buildDoc());
    parents.forEach((p) => {
      expect(p.tokenEstimate).toBeGreaterThan(0);
      expect(p.metadata.parentIndex).toBe(p.parentIndex);
    });
    children.forEach((c) => expect(c.tokenEstimate).toBeGreaterThan(0));
  });

  it('treats a short document as a single parent with a single child', () => {
    const short: Document = { id: 'short', content: 'A very short document.', metadata: { title: 'Short' } };
    const { parents, children } = chunkingService.createParentChildChunks(short);
    expect(parents.length).toBe(1);
    expect(children.length).toBe(1);
    expect(children[0].parentId).toBe(parents[0].id);
  });

  it('chunkText returns [] for blank input and respects the window size', () => {
    expect(chunkingService.chunkText('   ', 100, 10)).toEqual([]);

    const chunks = chunkingService.chunkText(
      'First sentence here. Second sentence here. Third sentence here. Fourth sentence here.',
      40,
      5
    );
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((c) => expect(c.length).toBeLessThanOrEqual(45));
  });

  it('exposes the default chunking configuration from environment config', () => {
    const cfg = chunkingService.getDefaultConfig();
    expect(cfg.parentChunkSize).toBeGreaterThan(0);
    expect(cfg.childChunkSize).toBeGreaterThan(0);
    expect(cfg.childChunkSize).toBeLessThan(cfg.parentChunkSize);
  });
});
