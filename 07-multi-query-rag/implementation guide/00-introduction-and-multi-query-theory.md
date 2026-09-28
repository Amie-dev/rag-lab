# Chapter 0 — Introduction & Mathematical Foundations of Multi-Query RAG

## 📌 Overview & Problem Statement

Standard **Single-Query RAG** pipelines convert the user's raw question directly into a single vector embedding (or BM25 keyword query) and execute a single search against a vector database.

While straightforward, this approach suffers from a fundamental vulnerability: **Vocabulary & Perspective Mismatch**.

Users often phrase questions using colloquial terms, high-level intent, or specific synonyms (e.g., *"How to stop users from accessing protected pages after their session expires?"*), whereas the underlying documentation may describe the feature using different terminology (e.g., *"JWT Refresh Token Blacklisting"*, *"AuthGuard Route Protectors"*, *"401 Unauthorized Redirects"*).

As a result:
- A single vector embedding falls into a restricted region of the latent vector space.
- Highly relevant document chunks that use different phrasing are missed.
- **Retrieval Recall** remains low, bottlenecking answer quality.

---

## 🎯 The Multi-Query Solution

**Multi-Query RAG** solves this issue by inserting a **Query Transformation** step prior to retrieval:

$$\text{User Question } Q \longrightarrow \text{LLM Query Generator} \longrightarrow \{Q_0, Q_1, Q_2, \dots, Q_m\}$$

Where:
- $Q_0$ is the original user query.
- $Q_1, \dots, Q_m$ are $m$ generated query variations exploring different technical perspectives, intent reformulations, and domain-specific terminology.

Each query $Q_i$ is executed **independently** against the retrieval engine:

$$R(Q_i) = \text{TopK}(Q_i)$$

The resulting candidate sets are merged, deduplicated, and combined via **Score Fusion**:

$$\mathcal{C} = \bigcup_{i=0}^m R(Q_i)$$

$$\text{Score}(d) = \text{Fusion}\left( \{ \text{Score}(Q_i, d) \}_{i=0}^m \right)$$

---

## 📊 Score Fusion Strategies

### 1. Reciprocal Rank Fusion (RRF)
RRF combines rankings from multiple retrieval runs without needing score normalization across queries:

$$RRF\_Score(d) = \sum_{q \in Q_{retrieved}} \frac{1}{k + rank(q, d)}$$

Where $k$ is a smoothing constant (typically $k = 60$), and $rank(q, d)$ is the 1-based rank position of document $d$ in the retrieval list for query $q$.

### 2. Max Score Fusion
$$\text{Max\_Score}(d) = \max_{q \in Q_{retrieved}} \text{Score}(q, d)$$

### 3. Average Score Fusion
$$\text{Avg\_Score}(d) = \frac{1}{|Q_{retrieved}|} \sum_{q \in Q_{retrieved}} \text{Score}(q, d)$$

---

## 🔄 Single-Query vs Multi-Query Comparison

| Aspect | Single-Query RAG | Multi-Query RAG |
| :--- | :--- | :--- |
| **Retrieval Queries** | 1 | $m + 1$ (e.g., 4–5) |
| **Retrieval Coverage** | Limited semantic angle | Multi-perspective broad coverage |
| **Recall Potential** | Moderate / Low | High (+30% to +60% recall gain) |
| **Query Transformation** | None | LLM Structured Query Generator |
| **Deduplication** | Unnecessary | Mandatory by chunk ID |
| **Result Fusion** | Single list sorting | RRF / Max / Avg Score Fusion |

In the next chapter, we will inspect the project structure, TypeScript configuration, and domain schemas.
