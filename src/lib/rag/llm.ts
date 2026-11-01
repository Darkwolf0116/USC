import type { WebWorkerMLCEngine } from "@mlc-ai/web-llm";
import type { LlmMessage } from "./types";

export interface LlmHandle {
  engine: WebWorkerMLCEngine;
  worker: Worker;
  modelId: string;
}

/**
 * Downloads (or reads from the browser cache) the model and loads it in a dedicated worker.
 * `@mlc-ai/web-llm` is imported dynamically so it never weighs on the initial bundle.
 */
export async function loadLlm(
  modelId: string,
  onProgress: (progress: number) => void,
): Promise<LlmHandle> {
  const webllm = await import("@mlc-ai/web-llm");
  const worker = new Worker(new URL("../../workers/llm.worker.ts", import.meta.url), {
    type: "module",
  });
  try {
    const engine = await webllm.CreateWebWorkerMLCEngine(worker, modelId, {
      initProgressCallback: (report) => onProgress(report.progress),
    });
    return { engine, worker, modelId };
  } catch (error) {
    worker.terminate();
    throw error;
  }
}

export function disposeLlm(handle: LlmHandle | null): void {
  handle?.worker.terminate();
}

/** Streams the completion token by token. Stop it with `handle.engine.interruptGenerate()`. */
export async function* streamCompletion(
  handle: LlmHandle,
  messages: LlmMessage[],
): AsyncGenerator<string, void, void> {
  const stream = await handle.engine.chat.completions.create({
    messages,
    stream: true,
    temperature: 0.2,
    top_p: 0.9,
    max_tokens: 360,
  });
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) yield delta;
  }
}
