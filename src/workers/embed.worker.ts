import { env, pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";

/* Query embeddings for the assistant. The index was built with the same model
   (scripts/build-rag-index.mjs): "passage: " prefix there, "query: " prefix here. */

const MODEL = "Xenova/multilingual-e5-small";

env.allowLocalModels = false;

export type EmbedWorkerRequest = { type: "init" } | { type: "embed"; id: number; text: string };

export type EmbedWorkerResponse =
  | { type: "progress"; progress: number }
  | { type: "ready" }
  | { type: "result"; id: number; vector: Float32Array }
  | { type: "error"; id?: number; message: string };

interface WorkerScope {
  postMessage: (message: EmbedWorkerResponse, transfer?: Transferable[]) => void;
}
const scope = self as unknown as WorkerScope;

let extractor: Promise<FeatureExtractionPipeline> | null = null;

function loadExtractor(): Promise<FeatureExtractionPipeline> {
  if (!extractor) {
    const files = new Map<string, { loaded: number; total: number }>();
    extractor = pipeline("feature-extraction", MODEL, {
      dtype: "q8",
      device: "wasm",
      progress_callback: (info: { status: string; file?: string; loaded?: number; total?: number }) => {
        if (info.status !== "progress" || !info.file || !info.total) return;
        files.set(info.file, { loaded: info.loaded ?? 0, total: info.total });
        let loaded = 0;
        let total = 0;
        for (const entry of files.values()) {
          loaded += entry.loaded;
          total += entry.total;
        }
        scope.postMessage({ type: "progress", progress: total > 0 ? loaded / total : 0 });
      },
    }) as Promise<FeatureExtractionPipeline>;
    extractor.catch(() => {
      extractor = null;
    });
  }
  return extractor;
}

self.onmessage = async (event: MessageEvent<EmbedWorkerRequest>) => {
  const request = event.data;
  try {
    if (request.type === "init") {
      await loadExtractor();
      scope.postMessage({ type: "ready" });
      return;
    }
    const model = await loadExtractor();
    const output = await model(`query: ${request.text}`, { pooling: "mean", normalize: true });
    const vector = new Float32Array(output.data as Float32Array);
    scope.postMessage({ type: "result", id: request.id, vector }, [vector.buffer]);
  } catch (error) {
    scope.postMessage({
      type: "error",
      id: request.type === "embed" ? request.id : undefined,
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
