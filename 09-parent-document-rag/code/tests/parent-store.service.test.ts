import { parentStoreService } from '../src/services/parent-store.service';
import { ParentChunk } from '../src/types';

const makeParent = (id: string): ParentChunk => ({
  id,
  documentId: 'doc',
  content: `content of ${id}`,
  parentIndex: 0,
  totalParents: 1,
  childCount: 2,
  childIds: [`${id}::child_1`, `${id}::child_2`],
  tokenEstimate: 12,
  metadata: { title: 'Parent' },
});

describe('ParentStoreService', () => {
  beforeEach(() => parentStoreService.clear());

  it('adds, retrieves and reports parents', () => {
    parentStoreService.addParents([makeParent('p1'), makeParent('p2')]);

    expect(parentStoreService.size()).toBe(2);
    expect(parentStoreService.isReady()).toBe(true);
    expect(parentStoreService.getParent('p1')?.id).toBe('p1');
    expect(parentStoreService.getAllParents().length).toBe(2);

    // getParents preserves requested order and skips missing ids
    expect(parentStoreService.getParents(['p2', 'missing', 'p1']).map((p) => p.id)).toEqual(['p2', 'p1']);
  });

  it('replaces an existing parent with the same id', () => {
    parentStoreService.addParents([makeParent('p1')]);
    const updated = { ...makeParent('p1'), content: 'updated' };
    parentStoreService.addParents([updated]);
    expect(parentStoreService.size()).toBe(1);
    expect(parentStoreService.getParent('p1')?.content).toBe('updated');
  });

  it('clears the store', () => {
    parentStoreService.addParents([makeParent('p1')]);
    parentStoreService.clear();
    expect(parentStoreService.size()).toBe(0);
    expect(parentStoreService.isReady()).toBe(false);
    expect(parentStoreService.getParent('p1')).toBeUndefined();
  });
});
