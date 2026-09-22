/**
 * Metadata Filtering Expression Types and Operators
 */

export type FilterValue = string | number | boolean | Array<string | number>;

export type ComparisonOperator =
  | '$eq'
  | '$ne'
  | '$gt'
  | '$gte'
  | '$lt'
  | '$lte'
  | '$in'
  | '$nin'
  | '$contains';

export type ConditionFilter = {
  [K in ComparisonOperator]?: FilterValue;
};

export type FieldFilter = FilterValue | ConditionFilter;

export interface MetadataFilter {
  $and?: MetadataFilter[];
  $or?: MetadataFilter[];
  $not?: MetadataFilter;
  [field: string]: FieldFilter | MetadataFilter[] | MetadataFilter | undefined;
}

export type SearchMode = 'pre-filter' | 'post-filter';

export interface RetrievalResult {
  chunk: Chunk;
  score: number;
  recordId: string;
  metadataMatch: boolean;
}

export interface RetrievalOptions {
  topK?: number;
  mode?: SearchMode;
  postFilterCandidateLimit?: number; // Top N for global post-filtering search space before constraint
}
