import { PositionedToken, AnalyzerType } from '../schemas';
import { Tokenizer, StandardTokenizer, TechnicalTokenizer, SimpleTokenizer } from './tokenizer';
import { isStopWord, ENGLISH_STOP_WORDS } from './stopwords';
import { PorterStemmer } from './stemmer';

export interface AnalyzerOptions {
  lowercase?: boolean;
  removeStopWords?: boolean;
  stemming?: boolean;
  customStopWords?: Set<string>;
}

export interface Analyzer {
  readonly type: AnalyzerType;
  analyze(text: string): PositionedToken[];
}

/**
 * Standard Analyzer: Standard Tokenization + Lowercase + Stop Words + Porter Stemming
 */
export class StandardAnalyzer implements Analyzer {
  public readonly type: AnalyzerType = 'standard';
  private tokenizer: Tokenizer;
  private removeStopWords: boolean;
  private stemming: boolean;
  private customStopWords?: Set<string>;

  constructor(options: AnalyzerOptions = {}) {
    this.tokenizer = new StandardTokenizer();
    this.removeStopWords = options.removeStopWords ?? true;
    this.stemming = options.stemming ?? true;
    this.customStopWords = options.customStopWords;
  }

  public analyze(text: string): PositionedToken[] {
    const rawTokens = this.tokenizer.tokenize(text);
    const analyzed: PositionedToken[] = [];

    for (const token of rawTokens) {
      let term = token.term.toLowerCase();

      if (this.removeStopWords && isStopWord(term, this.customStopWords)) {
        continue;
      }

      if (this.stemming && term.length > 2) {
        term = PorterStemmer.stem(term);
      }

      analyzed.push({
        ...token,
        term,
      });
    }

    return analyzed;
  }
}

/**
 * Technical Analyzer: Technical Tokenization (error codes, SKUs, camelCase, identifiers)
 * Preserves exact technical terms, selectively removes standard stop words, optional stemming.
 */
export class TechnicalAnalyzer implements Analyzer {
  public readonly type: AnalyzerType = 'technical';
  private tokenizer: Tokenizer;
  private removeStopWords: boolean;
  private stemming: boolean;

  constructor(options: AnalyzerOptions = {}) {
    this.tokenizer = new TechnicalTokenizer();
    this.removeStopWords = options.removeStopWords ?? true;
    this.stemming = options.stemming ?? false; // Default false for technical terms to keep exact matches
  }

  public analyze(text: string): PositionedToken[] {
    const rawTokens = this.tokenizer.tokenize(text);
    const analyzed: PositionedToken[] = [];

    for (const token of rawTokens) {
      let term = token.term.toLowerCase();

      // Skip stop word removal if it looks like a technical error code or SKU or contains numbers/symbols
      const isTechnicalTerm = /[0-9_\-./:]/.test(term) || term.startsWith('0x');

      if (!isTechnicalTerm && this.removeStopWords && isStopWord(term)) {
        continue;
      }

      if (!isTechnicalTerm && this.stemming && term.length > 2) {
        term = PorterStemmer.stem(term);
      }

      analyzed.push({
        ...token,
        term,
      });
    }

    return analyzed;
  }
}

/**
 * Simple Analyzer: Light Tokenization + Lowercase without stemming or stop words removal
 */
export class SimpleAnalyzer implements Analyzer {
  public readonly type: AnalyzerType = 'simple';
  private tokenizer: Tokenizer;

  constructor() {
    this.tokenizer = new SimpleTokenizer();
  }

  public analyze(text: string): PositionedToken[] {
    return this.tokenizer.tokenize(text);
  }
}

export function createAnalyzer(type: AnalyzerType = 'standard', options?: AnalyzerOptions): Analyzer {
  switch (type) {
    case 'technical':
      return new TechnicalAnalyzer(options);
    case 'simple':
      return new SimpleAnalyzer();
    case 'standard':
    default:
      return new StandardAnalyzer(options);
  }
}
