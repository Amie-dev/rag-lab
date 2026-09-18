import {
  Chunk,
  SearchQuery,
  KeywordRetrievalResult,
  MetadataFilter,
  ScoreExplanation,
  AnalyzerType,
  ScoringAlgorithm,
} from '../schemas';
import { InvertedIndex } from '../index/inverted_index';
import { createAnalyzer, Analyzer } from '../analysis/analyzer';
import { BM25Scorer } from '../scoring/bm25';
import { TFIDFScorer } from '../scoring/tfidf';

export class KeywordSearchEngine {
  private index: InvertedIndex;
  private analyzerMap: Map<AnalyzerType, Analyzer> = new Map();

  constructor(index?: InvertedIndex) {
    this.index = index || new InvertedIndex();
    this.analyzerMap.set('standard', createAnalyzer('standard'));
    this.analyzerMap.set('technical', createAnalyzer('technical'));
    this.analyzerMap.set('simple', createAnalyzer('simple'));
  }

  public getIndex(): InvertedIndex {
    return this.index;
  }

  /**
   * Adds chunks to the inverted index using the specified analyzer type.
   */
  public indexChunks(chunks: Chunk[], analyzerType: AnalyzerType = 'standard'): void {
    const analyzer = this.getAnalyzer(analyzerType);
    for (const chunk of chunks) {
      const tokens = analyzer.analyze(chunk.content);
      this.index.addChunk(chunk, tokens);
    }
  }

  /**
   * Executes a lexical keyword search query against the index.
   */
  public search(searchQuery: SearchQuery): KeywordRetrievalResult[] {
    const queryStr = searchQuery.query.trim();
    if (!queryStr || this.index.getTotalDocuments() === 0) {
      return [];
    }

    const analyzerType = searchQuery.analyzerType || 'standard';
    const algorithm: ScoringAlgorithm = searchQuery.algorithm || 'bm25';
    const topK = searchQuery.topK ?? 5;
    const analyzer = this.getAnalyzer(analyzerType);

    // 1. Analyze query terms
    const queryTokens = analyzer.analyze(queryStr);
    if (queryTokens.length === 0) {
      return [];
    }

    const queryTerms = queryTokens.map((t) => t.term);

    // 2. Candidate generation: gather candidate document IDs matching at least one term
    const candidateDocIds = new Set<string>();
    for (const term of queryTerms) {
      const postings = this.index.getPostings(term);
      for (const posting of postings) {
        candidateDocIds.add(posting.docId);
      }
    }

    // 3. Metadata filtering
    const validCandidateIds: string[] = [];
    for (const docId of candidateDocIds) {
      const chunk = this.index.getChunk(docId);
      if (!chunk) continue;
      if (searchQuery.filter && !this.evaluateMetadataFilter(chunk.metadata, searchQuery.filter)) {
        continue;
      }
      validCandidateIds.push(docId);
    }

    // 4. Scoring candidates using selected algorithm
    const bm25Scorer = new BM25Scorer(searchQuery.bm25Params);
    const tfidfScorer = new TFIDFScorer(searchQuery.tfidfParams);

    const results: KeywordRetrievalResult[] = [];

    for (const docId of validCandidateIds) {
      const chunk = this.index.getChunk(docId)!;
      const bm25Res = bm25Scorer.scoreDocument(queryTerms, docId, this.index);
      const tfidfRes = tfidfScorer.scoreDocument(queryTerms, docId, this.index);

      const matchedTerms = Array.from(
        new Set(
          bm25Res.details
            .filter((d) => d.rawTf > 0)
            .map((d) => d.term)
        )
      );

      const finalScore = algorithm === 'bm25' ? bm25Res.totalScore : tfidfRes.totalScore;
      const details = algorithm === 'bm25' ? bm25Res.details : tfidfRes.details;

      let explanation: ScoreExplanation | undefined;
      if (searchQuery.explain) {
        explanation = {
          chunkId: docId,
          documentId: chunk.metadata.documentId,
          finalScore,
          algorithm,
          termDetails: details,
          documentLength: this.index.getDocLength(docId),
          avgDocumentLength: this.index.getAvgDocLength(),
        };
      }

      results.push({
        chunk,
        score: finalScore,
        bm25Score: bm25Res.totalScore,
        tfidfScore: tfidfRes.totalScore,
        matchedTerms,
        explanation,
      });
    }

    // 5. Rank results in descending order of score
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, topK);
  }

  /**
   * Helper to retrieve or lazily create analyzer.
   */
  private getAnalyzer(type: AnalyzerType): Analyzer {
    let analyzer = this.analyzerMap.get(type);
    if (!analyzer) {
      analyzer = createAnalyzer(type);
      this.analyzerMap.set(type, analyzer);
    }
    return analyzer;
  }

  /**
   * Evaluates metadata filters ($eq, $ne, $gt, $gte, $lt, $lte, $in, $nin, $and, $or).
   */
  private evaluateMetadataFilter(
    metadata: Record<string, unknown>,
    filter: MetadataFilter
  ): boolean {
    if (filter.$and && filter.$and.length > 0) {
      for (const subFilter of filter.$and) {
        if (!this.evaluateMetadataFilter(metadata, subFilter)) return false;
      }
    }

    if (filter.$or && filter.$or.length > 0) {
      let matched = false;
      for (const subFilter of filter.$or) {
        if (this.evaluateMetadataFilter(metadata, subFilter)) {
          matched = true;
          break;
        }
      }
      if (!matched) return false;
    }

    for (const key of Object.keys(filter)) {
      if (key === '$and' || key === '$or') continue;
      const val = metadata[key];
      const condition = filter[key];

      if (condition === undefined) continue;

      if (typeof condition === 'object' && condition !== null && !Array.isArray(condition)) {
        const condObj = condition as Record<string, unknown>;
        for (const op of Object.keys(condObj)) {
          const targetVal = condObj[op];
          if (!this.evaluateOperator(val, op, targetVal)) {
            return false;
          }
        }
      } else {
        // Direct equality
        if (val !== condition) return false;
      }
    }

    return true;
  }

  private evaluateOperator(val: unknown, op: string, targetVal: unknown): boolean {
    switch (op) {
      case '$eq':
        return val === targetVal;
      case '$ne':
        return val !== targetVal;
      case '$gt':
        return typeof val === 'number' && typeof targetVal === 'number' && val > targetVal;
      case '$gte':
        return typeof val === 'number' && typeof targetVal === 'number' && val >= targetVal;
      case '$lt':
        return typeof val === 'number' && typeof targetVal === 'number' && val < targetVal;
      case '$lte':
        return typeof val === 'number' && typeof targetVal === 'number' && val <= targetVal;
      case '$in':
        return Array.isArray(targetVal) && targetVal.includes(val as any);
      case '$nin':
        return Array.isArray(targetVal) && !targetVal.includes(val as any);
      default:
        return false;
    }
  }
}
