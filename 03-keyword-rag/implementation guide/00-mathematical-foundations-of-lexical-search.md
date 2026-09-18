# 📐 Chapter 0 — Mathematical Foundations of Lexical Search

Welcome to Chapter 0 of the **Keyword RAG Implementation Guide**. In this chapter, we explore the mathematical principles underlying lexical and sparse information retrieval, including **Term Frequency (TF)**, **Inverse Document Frequency (IDF)**, **TF-IDF**, and the state-of-the-art **Okapi BM25** ranking algorithm.

---

## 1. Dense vs. Sparse (Lexical) Retrieval

In Retrieval-Augmented Generation (RAG) systems, retrieval mechanisms broadly fall into two paradigms:

| Paradigm | Mechanism | Strengths | Limitations |
| :--- | :--- | :--- | :--- |
| **Dense Vector RAG** | High-dimensional embedding vectors ($1536$-d) & cosine/dot product distance | Captures semantic intent, synonyms, and paraphrasing | Struggles with exact keywords, serial numbers, codes, and domain acronyms |
| **Sparse / Keyword RAG** | Exact lexical term matching over inverted index lists | Precise exact-match precision, fast term lookups, zero embedding costs | Misses vocabulary mismatch / synonyms ("cat" vs "feline") |

Keyword RAG builds upon decades of Search & Information Retrieval (IR) research, ensuring exact-match fidelity when users search for technical IDs, product SKUs, exact code symbols, or specific terminology.

---

## 2. Term Frequency ($TF$) and Inverse Document Frequency ($IDF$)

### Term Frequency ($TF$)
Term Frequency measures how frequently a term $t$ appears within a document chunk $d$:

$$f(t, d) = \text{count of term } t \text{ in document } d$$

In basic TF-IDF, raw term frequency can be normalized by document length:

$$\text{TF}(t, d) = \frac{f(t, d)}{|d|}$$

### Inverse Document Frequency ($IDF$)
Not all words carry equal informational value. Common terms (e.g., *"the"*, *"is"*, *"system"*) appear across almost every document and provide minimal query discrimination. $IDF$ down-weights frequent terms and boosts rare, highly informative terms.

For a corpus with $N$ total document chunks, let $n(t)$ be the document frequency (number of chunks containing term $t$).

#### Standard Log-IDF Formula:
$$\text{IDF}_{\text{standard}}(t) = \ln\left( \frac{N}{n(t)} \right) + 1$$

#### Lucene / Smooth IDF Formula:
$$\text{IDF}_{\text{smooth}}(t) = \ln\left( 1 + \frac{N - n(t) + 0.5}{n(t) + 0.5} \right)$$

#### Okapi BM25 Probabilistic IDF:
$$\text{IDF}_{\text{BM25}}(t) = \ln\left( \frac{N - n(t) + 0.5}{n(t) + 0.5} + 1 \right)$$

> [!NOTE]
> Adding $+1$ inside or outside the logarithm guarantees non-negative $IDF$ values, preventing negative relevance scores when a term occurs in more than half of the corpus documents ($n(t) > N / 2$).

---

## 3. The Okapi BM25 Ranking Algorithm

**Okapi BM25** (Best Matching 25) is a non-linear TF-IDF scoring function that solves two major limitations of classical TF-IDF:
1. **Term Frequency Saturation**: Multiple occurrences of a word yield diminishing returns. Mentioning a keyword $10$ times is not $10\times$ more relevant than mentioning it twice.
2. **Document Length Normalization**: Longer documents naturally contain higher raw term counts simply because they have more text. BM25 penalizes long documents while rewarding concise documents matching the query.

### BM25 Formula

Given a search query $q = \{t_1, t_2, \dots, t_m\}$ and document chunk $d$:

$$\text{Score}_{\text{BM25}}(q, d) = \sum_{i=1}^{m} \text{IDF}(t_i) \cdot \frac{f(t_i, d) \cdot (k_1 + 1)}{f(t_i, d) + k_1 \cdot \left(1 - b + b \cdot \frac{|d|}{\text{avgdl}}\right)}$$

Where:
- $N$: Total number of document chunks in the index corpus.
- $n(t_i)$: Number of document chunks containing query term $t_i$.
- $f(t_i, d)$: Raw term frequency of $t_i$ in chunk $d$.
- $|d|$: Length of chunk $d$ (total token count).
- $\text{avgdl}$: Average token length of all document chunks across the corpus ($\text{avgdl} = \frac{1}{N} \sum_{j=1}^N |d_j|$).
- $k_1$: **Term frequency saturation parameter** (typically $1.2 \le k_1 \le 2.0$). Controls how rapidly additional occurrences of a term saturate the score.
- $b$: **Document length normalization parameter** (typically $0.75$, bounded $0 \le b \le 1$). $b=1$ applies full length penalty; $b=0$ ignores document length entirely.

---

## 4. Visualizing BM25 Parameter Effects

### Effect of $k_1$ (Frequency Saturation)
- When $k_1 = 0$, term frequency is completely ignored ($TF$ term simplifies to $1$).
- As $f(t, d) \to \infty$, the $TF$ component asymptotically approaches $k_1 + 1$.

```
TF Component
 ^
 |             ----------------- (Asymptote: k1 + 1)
 |           /
 |         /
 |       /
 |     /
 |   /
 +-----------------------------------> Raw Term Frequency f(t, d)
```

### Effect of $b$ (Length Normalization)
- If $|d| > \text{avgdl}$, the denominator increases, scaling down the TF component.
- If $|d| < \text{avgdl}$, the denominator decreases, scaling up the TF component.

---

## 5. Mathematical Summary Table

| Parameter / Metric | Symbol | Description | Standard Value |
| :--- | :--- | :--- | :--- |
| **Corpus Size** | $N$ | Total indexed document chunks | Variable |
| **Doc Frequency** | $n(t)$ | Count of chunks containing term $t$ | $1 \le n(t) \le N$ |
| **Chunk Length** | $|d|$ | Token count of target chunk | Variable |
| **Average Chunk Length** | $\text{avgdl}$ | Mean token count across all chunks | Corpus mean |
| **TF Saturation** | $k_1$ | Controls term frequency scaling curvature | $1.2$ |
| **Length Penalty** | $b$ | Controls degree of document length normalization | $0.75$ |

In the next chapter, we will translate these domain schemas and mathematical abstractions into concrete TypeScript definitions.
