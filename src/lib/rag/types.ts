export type ChunkSource = "pdf" | "catalog" | "page";

/** One retrievable piece of text, as written by `scripts/build-rag-index.mjs`. */
export interface RagChunk {
  id: string;
  text: string;
  title: string;
  source: ChunkSource;
  posterSlug?: string;
  categorySlug?: string;
  page?: number;
}

export interface RagIndexFile {
  version: number;
  model: string;
  dim: number;
  hash: string;
  createdAt: string;
  chunks: RagChunk[];
}

/** A chunk picked for an answer, numbered from 1 so the model can cite it as [n]. */
export interface RetrievedSource {
  n: number;
  chunk: RagChunk;
  score: number;
}

export type AssistantRole = "user" | "assistant";

export type AssistantAction =
  | { type: "selectCategory"; slug: string }
  | { type: "openPoster"; slug: string }
  | { type: "search"; query: string };

/** Minimal chat turn passed to the language model. */
export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}
