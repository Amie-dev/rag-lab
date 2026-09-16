# Vector Embeddings and Similarity Search

Vector embeddings convert high-dimensional textual concepts into numeric vector arrays representing semantic meaning.
When text is converted into embeddings, semantically similar concepts lie close to each other in vector space.

## Similarity Measures
1. **Cosine Similarity**: Measures the cosine of the angle between two vectors. Values range from -1.0 to 1.0 (or 0 to 1 for normalized vectors). It is invariant to vector magnitude.
2. **Dot Product**: Computes the sum of products of corresponding vector dimensions. Effective when vectors are unit-normalized.
3. **Euclidean Distance**: Measures straight-line geometric distance between vector points in space. Smaller distance indicates higher similarity.

In Basic RAG, query vectors are matched against stored chunk vectors using these similarity measures to find the Top-K relevant candidates.
