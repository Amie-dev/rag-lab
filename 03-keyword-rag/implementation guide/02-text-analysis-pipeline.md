# 🔤 Chapter 2 — Text Analysis Pipeline

Welcome to Chapter 2 of the **Keyword RAG Implementation Guide**. In this chapter, we build the multi-stage text processing engine responsible for converting unstructured raw text into normalized, position-aware tokens suitable for inverted indexing and BM25 scoring.

---

## 1. Analysis Pipeline Architecture

The analysis pipeline transforms string inputs through three sequential phases:

```
[ Raw Document Text ]
         │
         ▼
 1. Tokenization  ──► Splitting text into term sequences & tracking offsets
         │
         ▼
 2. Stop Word Filter ──► Filtering high-frequency non-informative words ("the", "is", "at")
         │
         ▼
 3. Stemming      ──► Truncating morphological variations to root form ("retrieving" -> "retriev")
         │
         ▼
[ Positioned Tokens Stream ]
```

---

## 2. Tokenizers (`tokenizer.ts`)

Located in [`03-keyword-rag/code/src/analysis/tokenizer.ts`](../code/src/analysis/tokenizer.ts). We implement three distinct tokenization strategies:

### 1. `StandardTokenizer`
Regex-based extraction of alphanumeric words (`/[a-zA-Z0-9]+/g`). Tracks token index `position`, `startOffset`, and `endOffset`.

### 2. `TechnicalTokenizer`
Designed for software engineering docs, code snippets, logs, and error tracebacks.
- Preserves exact hex codes (e.g. `0x80004005`), SKUs (`TX-9021-B`), error strings (`ERR_CONNECTION_TIMED_OUT`), and URL paths (`/api/v1/users`).
- Splits `camelCase` (e.g. `createPaymentIntent` -> `createPaymentIntent`, `create`, `Payment`, `Intent`).
- Splits delimited compound terms (`snake_case`, `kebab-case`) while retaining the parent token.

```typescript
export class TechnicalTokenizer implements Tokenizer {
  public tokenize(text: string): PositionedToken[] {
    const tokens: PositionedToken[] = [];
    const regex = /(?:0x[0-9a-fA-F]+)|(?:[a-zA-Z0-9]+(?:[-_./:][a-zA-Z0-9]+)+)|(?:[a-zA-Z0-9]+)/g;
    let match: RegExpExecArray | null;
    let position = 0;

    while ((match = regex.exec(text)) !== null) {
      const rawTerm = match[0];
      const startOffset = match.index;
      const endOffset = startOffset + rawTerm.length;
      const lower = rawTerm.toLowerCase();

      // Emit compound token
      tokens.push({ term: lower, rawTerm, position: position++, startOffset, endOffset });

      // Split camelCase
      const camelSubTokens = rawTerm.replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(' ');
      if (camelSubTokens.length > 1) {
        for (const sub of camelSubTokens) {
          if (sub.length > 0 && sub.toLowerCase() !== lower) {
            tokens.push({ term: sub.toLowerCase(), rawTerm: sub, position: position++, startOffset, endOffset });
          }
        }
      }
    }
    return tokens;
  }
}
```

---

## 3. Stop Word Filtering (`stopwords.ts`)

High-frequency function words add index bloat without aiding search precision. `stopwords.ts` defines a set of standard English stop words (`ENGLISH_STOP_WORDS`) along with utility `isStopWord(term, customSet)`.

---

## 4. Porter Stemming Algorithm (`stemmer.ts`)

Stemming reduces words to their root or stem (e.g., *"searching"*, *"searched"*, *"searches"* $\to$ *"search"*).
`PorterStemmer` implements the classic 5-step Porter algorithm rules (Step 1a through Step 5b), operating on consonant/vowel measure $m$.

---

## 5. Analyzer Composition (`analyzer.ts`)

Located in [`03-keyword-rag/code/src/analysis/analyzer.ts`](../code/src/analysis/analyzer.ts). `createAnalyzer(type, options)` factory creates:
- **`StandardAnalyzer`**: Tokenization + Lowercasing + Stop Words + Porter Stemming.
- **`TechnicalAnalyzer`**: Technical Tokenization + Preserves technical symbols + Selective Stop Words + Optional Stemming.
- **`SimpleAnalyzer`**: Light whitespace tokenization without stemming or stop word removal.

```typescript
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
```

In the next chapter, we look at how these analyzed tokens are indexed into an in-memory **Inverted Index**.
