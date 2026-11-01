import MiniSearch from "minisearch";
import { tokenize } from "./text";
import type { RagChunk, RagIndexFile, RetrievedSource } from "./types";

const INDEX_URL = "/rag/index.json";
const VECTORS_URL = "/rag/vectors.bin";
const CANDIDATES = 24;
const RRF_K = 60;
export const DEFAULT_TOP_K = 5;

export interface RagIndex {
  meta: Omit<RagIndexFile, "chunks">;
  chunks: RagChunk[];
  search: MiniSearch<RagChunk>;
}

let indexPromise: Promise<RagIndex> | null = null;
let vectorsPromise: Promise<Float32Array | null> | null = null;

/** Loads `index.json` once and builds the BM25 index. Rejects (and retries next time) on failure. */
export function loadIndex(): Promise<RagIndex> {
  if (!indexPromise) {
    indexPromise = (async () => {
      const response = await fetch(INDEX_URL);
      if (!response.ok) throw new Error(`No se pudo cargar el índice (${response.status}).`);
      const { chunks, ...meta } = (await response.json()) as RagIndexFile;
      const search = new MiniSearch<RagChunk>({
        fields: ["title", "text"],
        storeFields: [],
        idField: "id",
        processTerm: (term) => tokenize(term),
        searchOptions: {
          boost: { title: 2 },
          prefix: true,
          fuzzy: 0.15,
          combineWith: "OR",
          processTerm: (term) => tokenize(term),
        },
      });
      search.addAll(chunks);
      return { meta, chunks, search };
    })().catch((error: unknown) => {
      indexPromise = null;
      throw error;
    });
  }
  return indexPromise;
}

/** Loads the embedding matrix (row-major, same order as chunks). Null when it is unavailable. */
export function loadVectors(index: RagIndex): Promise<Float32Array | null> {
  if (!vectorsPromise) {
    vectorsPromise = (async () => {
      const response = await fetch(VECTORS_URL);
      if (!response.ok) return null;
      const buffer = await response.arrayBuffer();
      const vectors = new Float32Array(buffer);
      return vectors.length === index.chunks.length * index.meta.dim ? vectors : null;
    })().catch(() => {
      vectorsPromise = null;
      return null;
    });
  }
  return vectorsPromise;
}

function bm25Ranking(index: RagIndex, query: string): number[] {
  const positions = new Map(index.chunks.map((chunk, i) => [chunk.id, i]));
  return index.search
    .search(query)
    .slice(0, CANDIDATES)
    .map((hit) => positions.get(hit.id as string))
    .filter((position): position is number => position !== undefined);
}

function vectorRanking(index: RagIndex, vectors: Float32Array, queryVector: Float32Array): number[] {
  const { dim } = index.meta;
  const scored: Array<[number, number]> = [];
  for (let row = 0; row < index.chunks.length; row += 1) {
    let dot = 0;
    const offset = row * dim;
    for (let k = 0; k < dim; k += 1) dot += vectors[offset + k] * queryVector[k];
    scored.push([row, dot]);
  }
  scored.sort((a, b) => b[1] - a[1]);
  return scored.slice(0, CANDIDATES).map(([row]) => row);
}

/** One poster (or one non-poster chunk) counts once, so five sources are five different documents. */
function dedupeKey(chunk: RagChunk): string {
  if (chunk.posterSlug) return `poster:${chunk.posterSlug}`;
  return `chunk:${chunk.id}`;
}

export interface RetrieveOptions {
  /** Normalized query embedding (e5 "query: " prefix). Omit for BM25-only retrieval. */
  queryVector?: Float32Array | null;
  vectors?: Float32Array | null;
  topK?: number;
}

/** Hybrid retrieval: BM25 (+ cosine when vectors are available) fused with Reciprocal Rank Fusion. */
export function retrieve(index: RagIndex, query: string, options: RetrieveOptions = {}): RetrievedSource[] {
  const topK = options.topK ?? DEFAULT_TOP_K;
  const rankings: number[][] = [bm25Ranking(index, query)];
  if (options.queryVector && options.vectors) {
    rankings.push(vectorRanking(index, options.vectors, options.queryVector));
  }

  const fused = new Map<number, number>();
  for (const ranking of rankings) {
    ranking.forEach((position, rank) => {
      fused.set(position, (fused.get(position) ?? 0) + 1 / (RRF_K + rank + 1));
    });
  }

  const ordered = Array.from(fused.entries()).sort((a, b) => b[1] - a[1]);
  const seen = new Set<string>();
  const results: RetrievedSource[] = [];
  for (const [position, score] of ordered) {
    const chunk = index.chunks[position];
    const key = dedupeKey(chunk);
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({ n: results.length + 1, chunk, score });
    if (results.length === topK) break;
  }
  return results;
}
