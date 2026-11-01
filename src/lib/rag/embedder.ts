import type { EmbedWorkerResponse } from "@/workers/embed.worker";

const EMBED_TIMEOUT_MS = 8000;

/** Main-thread client of the query-embedding worker. Create it lazily, in the browser only. */
export class Embedder {
  private worker: Worker | null = null;
  private ready: Promise<void> | null = null;
  private nextId = 1;
  private pending = new Map<number, { resolve: (v: Float32Array) => void; reject: (e: Error) => void }>();

  /** Starts the worker and resolves once the model is downloaded and initialized. */
  start(onProgress?: (progress: number) => void): Promise<void> {
    if (this.ready) return this.ready;
    this.ready = new Promise<void>((resolve, reject) => {
      const worker = new Worker(new URL("../../workers/embed.worker.ts", import.meta.url), {
        type: "module",
      });
      this.worker = worker;
      worker.onerror = (event) => reject(new Error(event.message || "El modelo de búsqueda no pudo iniciar."));
      worker.onmessage = (event: MessageEvent<EmbedWorkerResponse>) => {
        const message = event.data;
        if (message.type === "progress") onProgress?.(message.progress);
        else if (message.type === "ready") resolve();
        else if (message.type === "result") {
          this.pending.get(message.id)?.resolve(message.vector);
          this.pending.delete(message.id);
        } else if (message.type === "error") {
          if (message.id === undefined) reject(new Error(message.message));
          else {
            this.pending.get(message.id)?.reject(new Error(message.message));
            this.pending.delete(message.id);
          }
        }
      };
      worker.postMessage({ type: "init" });
    });
    this.ready.catch(() => this.dispose());
    return this.ready;
  }

  /** Embeds a query; resolves to null when the worker is not ready or takes too long. */
  async embedQuery(text: string): Promise<Float32Array | null> {
    if (!this.worker || !this.ready) return null;
    try {
      await this.ready;
    } catch {
      return null;
    }
    const worker = this.worker;
    if (!worker) return null;
    const id = this.nextId++;
    const result = new Promise<Float32Array>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
    const timeout = new Promise<null>((resolve) => window.setTimeout(() => resolve(null), EMBED_TIMEOUT_MS));
    worker.postMessage({ type: "embed", id, text });
    try {
      return await Promise.race([result, timeout]);
    } catch {
      return null;
    } finally {
      this.pending.delete(id);
    }
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
    this.ready = null;
    for (const { reject } of this.pending.values()) reject(new Error("disposed"));
    this.pending.clear();
  }
}
