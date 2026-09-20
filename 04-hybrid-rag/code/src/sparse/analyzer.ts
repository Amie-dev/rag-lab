/**
 * Text Analyzer / Tokenizer specialized for technical document lexical retrieval
 */

export interface Token {
  term: string;
  rawTerm: string;
  position: number;
}

const DEFAULT_STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he',
  'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'were',
  'will', 'with', 'or', 'this', 'but', 'they', 'have', 'had', 'what', 'when',
  'where', 'who', 'which', 'why', 'how'
]);

export class TechnicalTextAnalyzer {
  private stopWords: Set<string>;

  constructor(customStopWords?: string[]) {
    this.stopWords = customStopWords ? new Set(customStopWords) : DEFAULT_STOP_WORDS;
  }

  tokenize(text: string): Token[] {
    if (!text) return [];

    // Regex matching technical terms (e.g. ERR_CONNECTION_TIMED_OUT, 0x80004005, TX-9021-B, createPaymentIntent)
    // or alphanumeric sequences
    const pattern = /0x[a-fA-F0-9]+|[a-zA-Z0-9]+(?:[-_:][a-zA-Z0-9]+)*/g;
    const tokens: Token[] = [];
    let match: RegExpExecArray | null;
    let position = 0;

    while ((match = pattern.exec(text)) !== null) {
      const rawTerm = match[0];
      const term = rawTerm.toLowerCase();

      // Keep token if it's not a stop word OR if it contains numbers/underscores/dashes (likely technical code)
      const isTechIdentifier = /[0-9_-]/.test(rawTerm);
      if (isTechIdentifier || !this.stopWords.has(term)) {
        tokens.push({
          term,
          rawTerm,
          position: position++
        });
      }
    }

    return tokens;
  }

  extractTerms(text: string): string[] {
    return this.tokenize(text).map((t) => t.term);
  }
}
