
# 🧪 RAG Lab — Complete Taxonomy & Learning Repository

A hands-on repository for learning **Retrieval-Augmented Generation (RAG)** from fundamentals to advanced and production-ready architectures.

This repository contains **20 dedicated RAG pattern labs**, organized progressively from basic retrieval to **GraphRAG, Agentic RAG, Multimodal RAG, Adaptive RAG, and Production RAG**.

The goal is simple:

> **Learn the core RAG concepts deeply enough to understand, design, and implement almost any RAG architecture.**

---

## 🧠 What is RAG?

**Retrieval-Augmented Generation (RAG)** is an architecture that allows an LLM to retrieve relevant external information before generating an answer.

Instead of relying only on the knowledge stored in the model:

```text
User Query
    ↓
Retrieve Relevant Information
    ↓
Provide Context to LLM
    ↓
Generate Answer
````

RAG is commonly used for:

* 📚 Document Question Answering
* 🏢 Enterprise Knowledge Bases
* 💬 AI Chatbots
* 📄 PDF / Document Assistants
* 🔎 Semantic Search
* 🧠 AI Agents
* 🕸️ Knowledge Graph Applications
* 📊 Data Analysis
* 🤖 Personalized AI Assistants

---

# 🏛️ RAG Mental Model

Almost every RAG system can be understood through a few core components:

```text
                    RAG SYSTEM ARCHITECTURE

                               │
        ┌──────────────────────┼──────────────────────┐
        ↓                      ↓                      ↓

     INDEXING              RETRIEVAL              GENERATION

        │                      │                      │
    Documents                Query                   LLM
        ↓                      ↓
    Chunking                 Search
        ↓                      ↓
   Embeddings           ┌──────┴──────┐
        ↓               ↓             ↓
    Vector DB        Vector        Keyword
                       Search        (BM25)
                         ↓             ↓
                         └──────┬──────┘
                                ↓
                            Reranker
                                ↓
                             Context
                                ↓
                               LLM
                                ↓
                            Response
```

Advanced architectures add components such as:

```text
                    ┌───────────────┐
                    │   AI Agent    │
                    └───────┬───────┘
                            ↓
        ┌───────────────────┼───────────────────┐
        ↓                   ↓                   ↓
   Vector Search       Knowledge Graph      Web Search
        ↓                   ↓                   ↓
        └───────────────────┼───────────────────┘
                            ↓
                        Reranking
                            ↓
                          Context
                            ↓
                           LLM
```

---

# 📂 Repository Structure

```text
rag-lab/
│
├── 00-learning-notes/
│
├── 01-basic-rag/
├── 02-vector-rag/
├── 03-keyword-rag/
├── 04-hybrid-rag/
├── 05-metadata-filtering/
├── 06-reranking/
│
├── 07-multi-query-rag/
├── 08-hyde/
├── 09-parent-document-rag/
├── 10-hierarchical-rag/
├── 11-multi-hop-rag/
├── 12-conversational-rag/
│
├── 13-graphrag/
├── 14-agentic-rag/
├── 15-corrective-rag/
├── 16-self-rag/
├── 17-memory-rag/
├── 18-multimodal-rag/
├── 19-adaptive-rag/
├── 20-production-rag/
│
└── README.md
```

---

# 🧠 Learning Notes

### [`00-learning-notes`](./00-learning-notes/README.md)

A structured learning roadmap covering:

* RAG fundamentals
* Document processing
* Chunking
* Embeddings
* Vector databases
* Retrieval strategies
* Reranking
* Query transformation
* GraphRAG
* Agentic RAG
* RAG evaluation
* Production architecture

---

# 🟢 Fundamentals & Baseline RAG

These labs establish the foundation required to understand more advanced RAG systems.

| #  | Pattern                   | Focus                                 |
| -- | ------------------------- | ------------------------------------- |
| 01 | **Basic / Naive RAG**     | Complete baseline RAG pipeline        |
| 02 | **Vector RAG**            | Embeddings and semantic similarity    |
| 03 | **Keyword / Sparse RAG**  | BM25 and exact keyword retrieval      |
| 04 | **Hybrid RAG**            | Dense + sparse retrieval              |
| 05 | **Metadata-Filtered RAG** | Filtering by metadata and permissions |
| 06 | **Reranking RAG**         | Improving retrieval quality           |

### 01 — Basic RAG

Learn the complete RAG pipeline:

```text
Documents
   ↓
Load
   ↓
Chunk
   ↓
Embed
   ↓
Store
   ↓
Retrieve
   ↓
LLM
```

Key concepts:

* Document loading
* Chunking
* Embeddings
* Vector storage
* Similarity search
* Context injection
* Generation

---

### 02 — Vector RAG

Learn semantic retrieval using embeddings.

Topics:

* Embedding models
* Vector representations
* Cosine similarity
* Dot product
* Euclidean distance
* ANN search
* HNSW
* Vector databases

---

### 03 — Keyword / Sparse RAG

Learn traditional information retrieval.

Topics:

* TF-IDF
* BM25
* Inverted indexes
* Exact keyword matching
* Sparse vectors

Useful for:

* Error codes
* Product IDs
* Part numbers
* Technical terminology
* Exact names

---

### 04 — Hybrid RAG

Combine semantic and lexical retrieval:

```text
             Query
               ↓
       ┌───────┴───────┐
       ↓               ↓
 Vector Search    BM25 Search
       ↓               ↓
       └───────┬───────┘
               ↓
         Result Fusion
               ↓
              LLM
```

Topics:

* Dense retrieval
* Sparse retrieval
* Reciprocal Rank Fusion (RRF)
* Score fusion
* Retrieval optimization

---

### 05 — Metadata-Filtered RAG

Learn how metadata improves retrieval precision and access control.

Examples:

```text
tenant = "company-a"
department = "engineering"
year >= 2025
document_type = "policy"
access_level = "internal"
```

Topics:

* Metadata filtering
* Pre-filtering
* Post-filtering
* Multi-tenant retrieval
* Access control

---

### 06 — Reranking RAG

Improve retrieval quality by reranking initial candidates.

```text
Query
  ↓
Retriever
  ↓
Top 20 Candidates
  ↓
Reranker
  ↓
Top 5
  ↓
LLM
```

Topics:

* Cross-encoder reranking
* Candidate retrieval
* Relevance scoring
* Top-K optimization

---

# 🟡 Advanced Retrieval & Query Strategies

These labs focus on improving retrieval when basic vector search is not enough.

| #  | Pattern                 | Focus                                   |
| -- | ----------------------- | --------------------------------------- |
| 07 | **Multi-Query RAG**     | Multiple query generation               |
| 08 | **HyDE**                | Hypothetical document embeddings        |
| 09 | **Parent-Document RAG** | Small retrieval chunks + larger context |
| 10 | **Hierarchical RAG**    | Multi-level document retrieval          |
| 11 | **Multi-Hop RAG**       | Iterative retrieval                     |
| 12 | **Conversational RAG**  | Multi-turn retrieval                    |

---

### 07 — Multi-Query RAG

Transform one user query into multiple search queries.

```text
User Query
    ↓
LLM Query Generation
    ↓
┌───────┬───────┬───────┐
↓       ↓       ↓
Query1 Query2 Query3
↓       ↓       ↓
└───────┴───────┘
        ↓
   Merge + Deduplicate
        ↓
       LLM
```

Useful when one query can be interpreted in multiple ways.

---

### 08 — HyDE

**Hypothetical Document Embeddings**

Instead of directly embedding the user's question:

```text
Question
   ↓
LLM generates hypothetical answer/document
   ↓
Embed hypothetical document
   ↓
Retrieve similar documents
   ↓
LLM
```

Useful when the query and document have very different linguistic structures.

---

### 09 — Parent-Document RAG

Retrieve using small chunks but provide a larger parent section to the LLM.

```text
Large Document
      ↓
 Parent Document
      ↓
 ┌────┬────┬────┬────┐
 ↓    ↓    ↓    ↓
Child Child Child Child
Chunks
      ↓
Embedding Search
      ↓
Relevant Child
      ↓
Parent Document
      ↓
LLM
```

Balances retrieval precision and contextual completeness.

---

### 10 — Hierarchical RAG

Retrieve information through multiple levels:

```text
Document
   ↓
Chapter
   ↓
Section
   ↓
Subsection
   ↓
Chunk
```

Useful for large document collections and long technical documents.

---

### 11 — Multi-Hop RAG

Some questions require information from multiple retrieval steps.

```text
Question
   ↓
Retrieve A
   ↓
Understand A
   ↓
Generate next query
   ↓
Retrieve B
   ↓
Combine A + B
   ↓
LLM
```

Useful for questions involving relationships across multiple documents.

---

### 12 — Conversational RAG

RAG designed for multi-turn conversations.

```text
Conversation History
        ↓
Query Understanding
        ↓
Standalone Query
        ↓
Retrieval
        ↓
LLM
```

Example:

```text
User: What is React Native?

User: How is it different from Flutter?

User: What about performance?
```

The system needs conversation context to understand the last question.

---

# 🔴 Modern & Agentic RAG

These architectures move beyond traditional retrieve-then-generate pipelines.

| #  | Pattern            | Focus                             |
| -- | ------------------ | --------------------------------- |
| 13 | **GraphRAG**       | Knowledge graphs + retrieval      |
| 14 | **Agentic RAG**    | Agents controlling retrieval      |
| 15 | **Corrective RAG** | Retrieval evaluation + correction |
| 16 | **Self-RAG**       | Self-reflective retrieval         |
| 17 | **Memory RAG**     | Long-term memory retrieval        |
| 18 | **Multimodal RAG** | Text + images + tables            |
| 19 | **Adaptive RAG**   | Dynamic retrieval strategies      |
| 20 | **Production RAG** | Evaluation, security, scaling     |

---

### 13 — GraphRAG

Combine RAG with a knowledge graph.

```text
Documents
    ↓
Entity Extraction
    ↓
Knowledge Graph
    ↓
Neo4j
    ↓
Cypher / Graph Retrieval
    ↓
Relevant Entities + Relationships
    ↓
LLM
```

Example:

```text
User
 ↓
works_on
 ↓
AI Storybook
 ↓
uses
 ↓
OpenAI
```

Useful when relationships and multi-hop connections are important.

---

### 14 — Agentic RAG

An AI agent controls the retrieval process.

```text
                 User
                  ↓
               Agent
                  ↓
        ┌─────────┼─────────┐
        ↓         ↓         ↓
    Vector DB   SQL DB   Graph DB
        ↓         ↓         ↓
        └─────────┼─────────┘
                  ↓
              Evaluate
                  ↓
             Search Again?
               /     \
             Yes      No
              ↓        ↓
           Retrieve   Answer
```

The agent can decide:

* Whether retrieval is necessary
* Which tool to use
* Which source to query
* What query to generate
* Whether more retrieval is required

---

### 15 — Corrective RAG (CRAG)

Evaluate retrieved documents before generating the final answer.

```text
Query
 ↓
Retrieve
 ↓
Evaluate Relevance
 ↓
 ┌───────────────┐
 │ Good Results? │
 └───────┬───────┘
      Yes│No
         │
     ┌───┴──────┐
     ↓          ↓
    LLM      Re-retrieve
                ↓
            External Search
```

The goal is to avoid generating answers from poor retrieval results.

---

### 16 — Self-RAG

A self-reflective RAG architecture where the model evaluates:

* Whether retrieval is needed
* Whether retrieved information is relevant
* Whether the generated answer is supported

Conceptually:

```text
Question
   ↓
Need Retrieval?
   ↓
Retrieve
   ↓
Relevant?
   ↓
Generate
   ↓
Supported?
   ↓
Final Answer
```

---

### 17 — Memory RAG

Use retrieval to provide persistent information to an AI system.

```text
Current Conversation
        ↓
Memory Retrieval
        ↓
Relevant Past Information
        ↓
Current Context
        ↓
LLM
```

Useful for:

* Personal AI assistants
* Long-running agents
* User preferences
* Previous interactions
* Episodic memory

---

### 18 — Multimodal RAG

Retrieve information from multiple modalities:

```text
              Query
                ↓
      ┌─────────┼─────────┐
      ↓         ↓         ↓
     Text     Images    Tables
      ↓         ↓         ↓
      └─────────┼─────────┘
                ↓
          Multimodal LLM
                ↓
             Answer
```

Can work with:

* Text
* Images
* PDFs
* Tables
* Charts
* Diagrams
* Audio
* Video

---

### 19 — Adaptive RAG

Dynamically choose the appropriate retrieval strategy based on the query.

```text
                    Query
                      ↓
                Query Classifier
                      ↓
        ┌─────────────┼─────────────┐
        ↓             ↓             ↓
    Simple Query   Complex Query   Relationship
        ↓             ↓             ↓
    Vector RAG    Hybrid RAG      GraphRAG
        ↓             ↓             ↓
        └─────────────┼─────────────┘
                      ↓
                     LLM
```

The goal is to optimize:

* Quality
* Latency
* Cost
* Retrieval complexity

---

### 20 — Production RAG

Move from a prototype to a reliable production system.

Topics include:

* RAG evaluation
* Retrieval evaluation
* Generation evaluation
* RAG Triad
* Hallucination detection
* Observability
* Logging
* Tracing
* Caching
* Rate limiting
* Security
* Access control
* Multi-tenancy
* Scalability
* Cost optimization
* Latency optimization

---

# ⭐ Top 10 Concepts to Master

You don't need to memorize every RAG variant.

Master these concepts deeply:

### 1. Basic RAG Pipeline

Understand the complete flow from document ingestion to generation.

### 2. Chunking Strategies

Understand:

* Fixed-size chunking
* Recursive chunking
* Semantic chunking
* Overlap
* Parent-child chunks

### 3. Embeddings

Understand how text becomes vectors and how semantic similarity works.

### 4. Vector Search

Understand:

* ANN
* HNSW
* Similarity metrics
* Top-K retrieval

### 5. Keyword Search

Understand:

* Inverted indexes
* TF-IDF
* BM25

### 6. Hybrid Search

Understand how dense and sparse retrieval can work together.

### 7. Reranking

Understand why retrieving the top 20 and reranking them to the top 5 can improve quality.

### 8. Query Transformation

Understand:

* Query rewriting
* Multi-query
* HyDE

### 9. GraphRAG

Understand:

* Entities
* Relationships
* Knowledge graphs
* Neo4j
* Cypher
* Graph retrieval
* Vector + graph retrieval

### 10. Agentic RAG

Understand how agents can dynamically control:

* Retrieval
* Tools
* Query generation
* Routing
* Iteration
* Verification

---

# 🗺️ Recommended Learning Path

Follow the repository in this order:

```text
                    RAG LEARNING PATH

                         START
                           │
                           ↓
                  ┌─────────────────┐
                  │  RAG FUNDAMENTALS│
                  └────────┬────────┘
                           ↓
                    Basic RAG
                           ↓
                      Chunking
                           ↓
                      Embeddings
                           ↓
                    Vector Search
                           ↓
                  Keyword / BM25
                           ↓
                     Hybrid RAG
                           ↓
                      Reranking
                           ↓
                ┌──────────┴──────────┐
                ↓                     ↓
         Query Transformation    Better Chunking
                ↓                     ↓
        Multi-Query / HyDE      Parent / Hierarchical
                └──────────┬──────────┘
                           ↓
                       Multi-Hop
                           ↓
                  Conversational RAG
                           ↓
                       GraphRAG
                           ↓
                     Agentic RAG
                           ↓
              ┌────────────┼────────────┐
              ↓            ↓            ↓
            CRAG         Self-RAG    Memory RAG
              └────────────┼────────────┘
                           ↓
                    Multimodal RAG
                           ↓
                     Adaptive RAG
                           ↓
                    Production RAG
                           ↓
                         MASTER
```

---

# 🛠️ Technologies

The implementations may use different technologies depending on the lab.

Common technologies explored in this repository:

### Languages

* JavaScript
* TypeScript
* Python

### LLMs

* OpenAI
* Other compatible LLM providers

### Vector Databases

* PostgreSQL + pgvector
* Pinecone
* Qdrant
* Weaviate
* Milvus

### Search

* BM25
* Vector similarity
* Hybrid retrieval
* Rerankers

### Knowledge Graph

* Neo4j
* Cypher

### AI Frameworks

* LangChain
* LlamaIndex
* AI SDKs
* Native model APIs

> The goal is to understand the underlying architecture rather than become dependent on a particular framework.

---

# 🎯 Learning Objectives

By completing this repository, you should be able to:

* Understand how RAG works internally
* Build a RAG pipeline from scratch
* Choose an appropriate chunking strategy
* Work with embedding models
* Implement vector search
* Implement BM25 search
* Build hybrid retrieval
* Add reranking
* Improve queries using query transformation
* Implement Multi-Query RAG
* Understand HyDE
* Build conversational RAG
* Understand multi-hop retrieval
* Build GraphRAG with Neo4j
* Build Agentic RAG systems
* Implement corrective retrieval
* Understand Self-RAG
* Implement memory-based retrieval
* Build Multimodal RAG
* Design adaptive retrieval systems
* Evaluate RAG quality
* Build production-ready RAG architectures

---

# 🧩 How to Read Any RAG Architecture

When you encounter a new RAG architecture, don't focus only on its name.

Break it down into these questions:

```text
1. How is the data indexed?
        ↓
2. How are documents/chunks created?
        ↓
3. How are embeddings generated?
        ↓
4. Where is the data stored?
        ↓
5. How is the query transformed?
        ↓
6. How is information retrieved?
        ↓
7. Is keyword search involved?
        ↓
8. Is reranking used?
        ↓
9. Is a knowledge graph involved?
        ↓
10. Is an AI agent controlling retrieval?
        ↓
11. How is retrieved context evaluated?
        ↓
12. How does the LLM generate the final answer?
```

This mental model makes unfamiliar RAG architectures much easier to understand.

---

# 🔬 RAG Architecture Comparison

| Architecture   | Retrieval      | Query Processing      | Agent      | Graph     | Main Purpose              |
| -------------- | -------------- | --------------------- | ---------- | --------- | ------------------------- |
| Basic RAG      | Vector         | Basic                 | ❌          | ❌         | Simple document QA        |
| Vector RAG     | Dense          | Basic                 | ❌          | ❌         | Semantic retrieval        |
| Keyword RAG    | BM25           | Basic                 | ❌          | ❌         | Exact matching            |
| Hybrid RAG     | Dense + BM25   | Basic                 | ❌          | ❌         | Better retrieval          |
| Reranking RAG  | Hybrid/Vector  | Basic                 | ❌          | ❌         | Improve relevance         |
| Multi-Query    | Vector/Hybrid  | Multi-query           | ❌          | ❌         | Query coverage            |
| HyDE           | Vector         | Hypothetical document | ❌          | ❌         | Semantic alignment        |
| Multi-Hop      | Multiple       | Iterative             | Sometimes  | Sometimes | Complex questions         |
| Conversational | Vector/Hybrid  | History-aware         | ❌          | ❌         | Chat applications         |
| GraphRAG       | Graph + Vector | Entity-aware          | ❌/Optional | ✅         | Relationships             |
| Agentic RAG    | Multiple       | Agent-driven          | ✅          | Optional  | Dynamic retrieval         |
| CRAG           | Multiple       | Evaluation            | Optional   | Optional  | Correct retrieval         |
| Self-RAG       | Multiple       | Self-reflection       | Optional   | Optional  | Self-evaluation           |
| Memory RAG     | Memory Store   | Context-aware         | Often      | Optional  | Persistent memory         |
| Multimodal RAG | Multimodal     | Multimodal            | Optional   | Optional  | Images/text/tables        |
| Adaptive RAG   | Dynamic        | Dynamic               | Often      | Optional  | Cost/quality optimization |

---

# 🚀 Beyond Basic RAG

A mature RAG system is rarely just:

```text
Query → Vector DB → LLM
```

A production architecture may look more like:

```text
                         User Query
                              ↓
                       Query Analysis
                              ↓
                        Router / Agent
                              ↓
          ┌───────────────────┼───────────────────┐
          ↓                   ↓                   ↓
     Vector Search        BM25 Search        Graph Search
          ↓                   ↓                   ↓
          └───────────────────┼───────────────────┘
                              ↓
                         Result Fusion
                              ↓
                           Reranker
                              ↓
                      Context Filtering
                              ↓
                         LLM / Agent
                              ↓
                       Answer Evaluation
                              ↓
                     Final Response
```

This is the direction from **prototype RAG → production AI systems**.

---

# 📈 Goal

The ultimate goal of this repository is not simply to learn different RAG names.

It is to develop the ability to look at an unfamiliar architecture and understand:

> **What problem is this RAG system solving, what retrieval strategy is it using, why was that strategy chosen, and how does the retrieved information reach the LLM?**

Once you understand those principles, most RAG architectures become combinations of familiar building blocks.

---

## ⭐ Final Learning Principle

> **Don't memorize RAG types. Understand the components.**

```text
Indexing
   +
Retrieval
   +
Query Transformation
   +
Reranking
   +
Context Construction
   +
Reasoning / Agents
   +
Generation
   +
Evaluation
   =
Modern RAG
```

---

## 📚 Repository Status

🚧 **Active Learning Repository**

New experiments, implementations, benchmarks, and notes will be added as the learning journey progresses.

---

## 👨‍💻 Author

**Aminul Islam**

Learning and building with:

**AI • GenAI • RAG • AI Agents • GraphRAG • Web • Mobile**

---

⭐ If this repository helps you understand RAG, consider giving it a star.

