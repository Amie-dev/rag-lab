import { StandardTokenizer, TechnicalTokenizer, SimpleTokenizer } from '../src/analysis/tokenizer';
import { PorterStemmer } from '../src/analysis/stemmer';
import { StandardAnalyzer, TechnicalAnalyzer } from '../src/analysis/analyzer';

describe('Text Analysis & Tokenization', () => {
  test('StandardTokenizer extracts tokens and tracks offsets', () => {
    const tokenizer = new StandardTokenizer();
    const text = 'Quick brown fox jumps!';
    const tokens = tokenizer.tokenize(text);

    expect(tokens.length).toBe(4);
    expect(tokens[0]).toEqual({
      term: 'quick',
      rawTerm: 'Quick',
      position: 0,
      startOffset: 0,
      endOffset: 5,
    });
    expect(tokens[3].term).toBe('jumps');
  });

  test('TechnicalTokenizer preserves error codes and camelCase tokens', () => {
    const tokenizer = new TechnicalTokenizer();
    const text = 'Failed with ERR_CONNECTION_TIMED_OUT in createPaymentIntent for SKU TX-9021-B';
    const tokens = tokenizer.tokenize(text);
    const terms = tokens.map((t) => t.term);

    expect(terms).toContain('err_connection_timed_out');
    expect(terms).toContain('createpaymentintent');
    expect(terms).toContain('tx-9021-b');
    expect(terms).toContain('create');
    expect(terms).toContain('payment');
    expect(terms).toContain('intent');
  });

  test('PorterStemmer correctly stems English words', () => {
    expect(PorterStemmer.stem('running')).toBe('run');
    expect(PorterStemmer.stem('connections')).toBe('connect');
    expect(PorterStemmer.stem('relational')).toBe('relat');
  });

  test('StandardAnalyzer filters stop words and stems terms', () => {
    const analyzer = new StandardAnalyzer();
    const tokens = analyzer.analyze('The quick brown foxes are running fast');
    const terms = tokens.map((t) => t.term);

    expect(terms).not.toContain('the');
    expect(terms).not.toContain('are');
    expect(terms).toContain('quick');
    expect(terms).toContain('fox');
    expect(terms).toContain('run');
  });

  test('TechnicalAnalyzer preserves exact technical terms without stemming them', () => {
    const analyzer = new TechnicalAnalyzer({ stemming: false });
    const tokens = analyzer.analyze('Error ERR_CONNECTION_TIMED_OUT code 0x80004005');
    const terms = tokens.map((t) => t.term);

    expect(terms).toContain('err_connection_timed_out');
    expect(terms).toContain('0x80004005');
  });
});
