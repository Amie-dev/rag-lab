# Chapter 0 — Introduction & Mathematical Foundations of HyDE

## 📌 Overview: The Representation Gap in Vector Search

In standard Retrieval-Augmented Generation (RAG) pipelines, semantic search relies on computing a dense vector embedding directly from the raw user query and comparing it against pre-indexed knowledge base document chunk embeddings.

While effective for direct keyword or synonym matches, standard RAG fails when faced with the **Representation Gap**.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                             THE REPRESENTATION GAP                          │
├──────────────────────────────────────────┬──────────────────────────────────┤
│ User Query (Input)                       │ Knowledge Base Passage (Target)  │
├──────────────────────────────────────────┼──────────────────────────────────┤
│ Short & Interrogative                    │ Long & Declarative               │
│ e.g. "How to fix slow Postgres queries?" │ e.g. "Database Indexing & Query  │
│                                          │ Optimization: Adding composite   │
│                                          │ B-Tree indexes on heavily        │
│                                          │ filtered columns eliminates      │
│                                          │ sequential table scans..."       │
│ Low token count, high uncertainty        │ High token density, formal terms │
└──────────────────────────────────────────┴──────────────────────────────────┘
```

Because bi-encoder embedding models (such as OpenAI's `text-embedding-3-small` or `all-MiniLM-L6-v2`) encode text syntax and structural style alongside semantics, the vector for a short question lives in a distinctly different manifold region than the vector for a long declarative answer passage.

---

## 🧠 The HyDE Solution & Core Architecture

**HyDE (Hypothetical Document Embeddings)**, introduced by Luyu Gao et al. (2022), addresses this mismatch by using a Large Language Model (LLM) to bridge the structural gap.

### The Pipeline Transformation

```mermaid
flowchart TD
    subgraph DIRECT_RAG["Standard Direct Vector RAG (Flawed for Short Queries)"]
        Q1["User Query: 'How to fix slow Postgres queries?'"] --> E1["Embedding Model"]
        E1 --> V1["Query Vector [0.12, -0.45, 0.88, ...]"]
        V1 --> S1["Vector Search in Knowledge Base"]
        S1 --> R1["❌ Suboptimal / Off-target Chunks (Low Cosine Similarity)"]
    end

    subgraph HYDE_RAG["HyDE Pipeline (Bridging the Representation Gap)"]
        Q2["User Query: 'How to fix slow Postgres queries?'"] --> LLM["LLM (HyDE Generator)"]
        LLM --> H2["Synthetic Passages (Hypothetical Document)"]
        H2 --> E2["Embedding Model"]
        E2 --> V2["Hypothetical Vector [0.41, 0.12, 0.76, ...]"]
        V2 --> S2["Vector Search in Knowledge Base"]
        S2 --> R2["✅ Highly Relevant Grounded Chunks (High Cosine Similarity)"]
    end
```

### Why Hypothetical Passages Work Even When Factually Imperfect

A common misconception is that the hypothetical document must be 100% factually accurate. **It does not.**

1. **Structural Alignment**: The synthetic passage adopts the exact declarative tone, technical jargon, and syntax expected in the knowledge base.
2. **Semantic Similarity Bridge**: In embedding space, an imperfect hypothetical explanation of B-Tree indexing is substantially closer to the real document on B-Tree indexing than the original 6-word question was.
3. **Retrieval Aid Only**: The hypothetical document is passed to the vector search engine to identify candidate chunks. It is **never** used as factual evidence during final LLM answer generation.

---

## 📐 Mathematical Foundations

### 1. Vector Cosine Similarity Definition

Given two $n$-dimensional dense vectors $\mathbf{u}, \mathbf{v} \in \mathbb{R}^d$, the cosine similarity is computed as:

$$\text{Sim}(\mathbf{u}, \mathbf{v}) = \frac{\mathbf{u} \cdot \mathbf{v}}{\|\mathbf{u}\|_2 \|\mathbf{v}\|_2} = \frac{\sum_{i=1}^{d} u_i v_i}{\sqrt{\sum_{i=1}^{d} u_i^2} \sqrt{\sum_{i=1}^{d} v_i^2}}$$

When vectors are $L_2$-normalized ($\|\mathbf{u}\|_2 = \|\mathbf{v}\|_2 = 1.0$), cosine similarity simplifies to the dot product:

$$\text{Sim}(\mathbf{u}, \mathbf{v}) = \mathbf{u} \cdot \mathbf{v}$$

### 2. Manifold Distance Comparison

Let:
- $\mathbf{q} \in \mathbb{R}^d$: Embedding vector of the raw user query.
- $\mathbf{d}_{\text{real}} \in \mathbb{R}^d$: Embedding vector of a relevant real knowledge base passage.
- $\mathbf{d}_{\text{hypo}} \in \mathbb{R}^d$: Embedding vector of the generated hypothetical passage.

In standard RAG, the representation distance $\mathcal{D}_{\text{direct}}$ is:

$$\mathcal{D}_{\text{direct}} = 1 - \text{Sim}(\mathbf{q}, \mathbf{d}_{\text{real}})$$

In HyDE RAG, the representation distance $\mathcal{D}_{\text{HyDE}}$ is:

$$\mathcal{D}_{\text{HyDE}} = 1 - \text{Sim}(\mathbf{d}_{\text{hypo}}, \mathbf{d}_{\text{real}})$$

Empirical evaluation shows:

$$\mathcal{D}_{\text{HyDE}} < \mathcal{D}_{\text{direct}}$$

This reduction in distance leads to higher Recall@K and Mean Reciprocal Rank (MRR) during vector retrieval.

---

## 🛡️ Key Guardrails & Tradeoffs

| Aspect | Direct Vector RAG | HyDE RAG |
| :--- | :--- | :--- |
| **LLM Latency** | 1 LLM Call (Final Answer) | 2 LLM Calls (Generation + Final Answer) |
| **Retrieval Quality** | Moderate (sensitive to query wording) | High (bridges semantic & structural gap) |
| **Token Cost** | Lower | Slightly higher (cost of generating hypothetical text) |
| **Query Types Supported** | Exact term lookup, SKU search | Conceptual, architectural, open-ended questions |
| **Grounding Safety** | Relies on retrieved context | Relies **only** on real retrieved context (HyDE text discarded) |

Next, proceed to **[Chapter 1 — Project Setup & Domain Schemas](./01-project-setup-and-domain-schemas.md)**.
