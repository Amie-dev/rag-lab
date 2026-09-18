import { PositionedToken } from '../schemas';

export interface Tokenizer {
  tokenize(text: string): PositionedToken[];
}

/**
 * Standard Tokenizer for general text processing.
 * Tokenizes alphanumeric character sequences and tracks exact positions.
 */
export class StandardTokenizer implements Tokenizer {
  public tokenize(text: string): PositionedToken[] {
    const tokens: PositionedToken[] = [];
    const regex = /[a-zA-Z0-9]+/g;
    let match: RegExpExecArray | null;
    let position = 0;

    while ((match = regex.exec(text)) !== null) {
      const rawTerm = match[0];
      tokens.push({
        term: rawTerm.toLowerCase(),
        rawTerm,
        position: position++,
        startOffset: match.index,
        endOffset: match.index + rawTerm.length,
      });
    }

    return tokens;
  }
}

/**
 * Technical & Code Tokenizer.
 * Preserves exact error codes (e.g. ERR_CONNECTION_TIMED_OUT, 0x80004005),
 * SKUs (e.g. TX-9021-B), API endpoints (/api/v1/users), function names,
 * and splits camelCase / snake_case into constituent sub-tokens while preserving
 * the compound token.
 */
export class TechnicalTokenizer implements Tokenizer {
  public tokenize(text: string): PositionedToken[] {
    const tokens: PositionedToken[] = [];
    // Regex matches complex technical tokens, hex codes, hyphenated identifiers, path-like tokens, words
    const regex = /(?:0x[0-9a-fA-F]+)|(?:[a-zA-Z0-9]+(?:[-_./:][a-zA-Z0-9]+)+)|(?:[a-zA-Z0-9]+)/g;
    let match: RegExpExecArray | null;
    let position = 0;

    while ((match = regex.exec(text)) !== null) {
      const rawTerm = match[0];
      const startOffset = match.index;
      const endOffset = startOffset + rawTerm.length;
      const lower = rawTerm.toLowerCase();

      // Always emit the full compound token
      tokens.push({
        term: lower,
        rawTerm,
        position: position++,
        startOffset,
        endOffset,
      });

      // Split camelCase (e.g., createPaymentIntent -> create, Payment, Intent)
      const camelSubTokens = rawTerm.replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(' ');
      if (camelSubTokens.length > 1) {
        for (const sub of camelSubTokens) {
          if (sub.length > 0 && sub.toLowerCase() !== lower) {
            tokens.push({
              term: sub.toLowerCase(),
              rawTerm: sub,
              position: position++,
              startOffset,
              endOffset,
            });
          }
        }
      }

      // Split delimited terms (snake_case, hyphenated, paths: e.g. ERR_CONNECTION_TIMED_OUT, TX-9021-B)
      if (/[-_./:]/.test(rawTerm)) {
        const subParts = rawTerm.split(/[-_./:]+/).filter((p) => p.length > 0);
        if (subParts.length > 1) {
          for (const part of subParts) {
            if (part.toLowerCase() !== lower) {
              tokens.push({
                term: part.toLowerCase(),
                rawTerm: part,
                position: position++,
                startOffset,
                endOffset,
              });
            }
          }
        }
      }
    }

    return tokens;
  }
}

/**
 * Simple Tokenizer: splits on whitespace and strips surrounding punctuation.
 */
export class SimpleTokenizer implements Tokenizer {
  public tokenize(text: string): PositionedToken[] {
    const tokens: PositionedToken[] = [];
    const words = text.split(/\s+/);
    let currentOffset = 0;
    let position = 0;

    for (const word of words) {
      if (!word) continue;
      const matchIndex = text.indexOf(word, currentOffset);
      const startOffset = matchIndex !== -1 ? matchIndex : currentOffset;
      const clean = word.replace(/^[^\w]+|[^\w]+$/g, '');

      if (clean.length > 0) {
        tokens.push({
          term: clean.toLowerCase(),
          rawTerm: clean,
          position: position++,
          startOffset,
          endOffset: startOffset + clean.length,
        });
      }
      currentOffset = startOffset + word.length;
    }

    return tokens;
  }
}
