import { multiQueryGeneratorService } from '../src/services/multi-query-generator.service';

describe('MultiQueryGeneratorService', () => {
  it('should generate multiple query variations including original query', async () => {
    const question = 'How to stop users from accessing protected pages after session expires?';
    const variations = await multiQueryGeneratorService.generateQueryVariations(question, 4);

    expect(variations.length).toBeGreaterThanOrEqual(2);
    expect(variations[0].queryId).toBe('q_0_original');
    expect(variations[0].text).toBe(question);
    expect(variations[1].text).not.toBe(question);
  });

  it('should produce distinct query variations', async () => {
    const question = 'What is our subscription refund policy?';
    const variations = await multiQueryGeneratorService.generateQueryVariations(question, 3);

    const texts = variations.map((v) => v.text.toLowerCase());
    const uniqueTexts = new Set(texts);
    expect(uniqueTexts.size).toBe(variations.length);
  });
});
