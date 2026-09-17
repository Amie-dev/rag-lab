# 📘 Basic RAG (Naive RAG) — Complete Step-by-Step Implementation Guide

Welcome to the comprehensive implementation guide for **Basic RAG (Naive RAG)**.

This guide is designed as an end-to-end tutorial to help you understand, build, and master a production-grade Retrieval-Augmented Generation (RAG) engine from first principles using **TypeScript**.

All source code and tests discussed in this guide are located in [01-basic-rag/code](../code).

---

## 🏗️ Architecture & Data Flow

Basic RAG connects an external knowledge base to a Large Language Model (LLM) through two primary execution phases:

```mermaid
flowchart TD
    subgraph INGESTION["📥 Phase 1: Ingestion Pipeline"]
        A["📄 Raw Documents"] --> B["🔌 Document Loader (TextDocumentLoader)"]
        B --> C["✂️ Text Splitter (RecursiveCharacter / Token)"]
        C --> D["🧠 Embedding Model (Mock / OpenAI / Gemini)"]
        D --> E[("🗄️ In-Memory Vector Database")]
    end

    subgraph RETRIEVAL_GENERATION["🔎 Phase 2: Retrieval & Generation Pipeline"]
        F["👤 User Question"] --> G["🧠 Query Embedding"]
        G --> H["🔎 Vector Similarity Search (Cosine / Dot Product / Euclidean)"]
        E --> H
        H --> I["📚 Top-K Relevant Chunks"]
        I --> J["🧩 Context Augmentation & Prompt Formatting"]
        F --> J
        J --> K["🤖 LLM Generator (Mock / OpenAI / Gemini)"]
        K --> L["💬 Final Synthesized Answer"]
    end
```

---

## 📚 Chapters Index

| Chapter | Title | Focus & Core Code Modules |
| :--- | :--- | :--- |
| **[Chapter 1](./01-domain-models-and-config.md)** | **Domain Models & System Config** | [schemas.ts](../code/src/schemas.ts), [config.ts](../code/src/config.ts), [index.ts](../code/src/index.ts), [package.json](../code/package.json), [tsconfig.json](../code/tsconfig.json), [jest.config.js](../code/jest.config.js), [.env.example](../code/.env.example) |
| **[Chapter 2](./02-document-loaders.md)** | **Document Loading Architecture** | [loaders/base.ts](../code/src/loaders/base.ts), [loaders/text.ts](../code/src/loaders/text.ts), [tests/loaders.test.ts](../code/tests/loaders.test.ts) |
| **[Chapter 3](./03-text-splitters.md)** | **Chunking Strategies** | [splitters/base.ts](../code/src/splitters/base.ts), [splitters/character.ts](../code/src/splitters/character.ts), [splitters/token.ts](../code/src/splitters/token.ts), [tests/splitters.test.ts](../code/tests/splitters.test.ts) |
| **[Chapter 4](./04-embedding-models.md)** | **Vector Embedding Models** | [embeddings/base.ts](../code/src/embeddings/base.ts), [embeddings/mock.ts](../code/src/embeddings/mock.ts), [embeddings/openai.ts](../code/src/embeddings/openai.ts), [embeddings/gemini.ts](../code/src/embeddings/gemini.ts), [tests/embeddings.test.ts](../code/tests/embeddings.test.ts) |
| **[Chapter 5](./05-vector-store.md)** | **In-Memory Vector Database** | [vectordb/base.ts](../code/src/vectordb/base.ts), [vectordb/inMemory.ts](../code/src/vectordb/inMemory.ts), [tests/vectordb.test.ts](../code/tests/vectordb.test.ts) |
| **[Chapter 6](./06-llm-generators.md)** | **LLM Response Synthesis** | [llm/base.ts](../code/src/llm/base.ts), [llm/mock.ts](../code/src/llm/mock.ts), [llm/openai.ts](../code/src/llm/openai.ts), [llm/gemini.ts](../code/src/llm/gemini.ts) |
| **[Chapter 7](./07-rag-pipeline.md)** | **RAG Pipeline Orchestration** | [pipeline/ingestion.ts](../code/src/pipeline/ingestion.ts), [pipeline/retrieval.ts](../code/src/pipeline/retrieval.ts), [pipeline/generation.ts](../code/src/pipeline/generation.ts), [pipeline/basicRag.ts](../code/src/pipeline/basicRag.ts) |
| **[Chapter 8](./08-cli-and-testing.md)** | **Interactive CLI & Testing** | [cli.ts](../code/src/cli.ts), [tests/pipeline.test.ts](../code/tests/pipeline.test.ts) |

---

## 🚀 Quick Start & How to Use This Guide

1. Navigate to the code workspace:
   ```bash
   cd 01-basic-rag/code
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the interactive CLI with zero setup (uses built-in deterministic mock models):
   ```bash
   npm run start -- ask -q "What is vector embedding?"
   ```
4. Run the Jest test suite:
   ```bash
   npm test
   ```
5. Read through the chapters sequentially to understand the design rationale, mathematical formulations, and step-by-step TypeScript implementation of every component.
