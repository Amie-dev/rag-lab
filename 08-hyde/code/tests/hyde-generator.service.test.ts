import { hydeGeneratorService } from '../src/services/hyde-generator.service';

describe('HyDEGeneratorService', () => {
  it('should generate a single hypothetical document for a query', async () => {
    const query = 'How does RAG reduce hallucinations?';
    const docs = await hydeGeneratorService.generateHypotheticalDocuments(query, 1, 'technical');

    expect(docs.length).toBe(1);
    expect(docs[0].originalQuery).toBe(query);
    expect(docs[0].hypotheticalText).toContain('Retrieval-Augmented Generation');
    expect(docs[0].domainContext).toBe('technical');
  });

  it('should generate multiple hypothetical documents when numDocs > 1', async () => {
    const query = 'How does JWT authentication handle session revocation?';
    const docs = await hydeGeneratorService.generateHypotheticalDocuments(query, 3, 'technical');

    expect(docs.length).toBe(3);
    docs.forEach((doc) => {
      expect(doc.originalQuery).toBe(query);
      expect(doc.hypotheticalText.length).toBeGreaterThan(20);
    });
  });

  it('should format domain-aware synthetic text for legal context', async () => {
    const query = 'What are contract termination liabilities?';
    const docs = await hydeGeneratorService.generateHypotheticalDocuments(query, 1, 'legal');

    expect(docs.length).toBe(1);
    expect(docs[0].domainContext).toBe('legal');
  });
});
