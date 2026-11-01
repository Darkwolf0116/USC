import { WebWorkerMLCEngineHandler } from "@mlc-ai/web-llm";

/** Hosts the WebLLM engine off the main thread. The page talks to it via CreateWebWorkerMLCEngine. */
const handler = new WebWorkerMLCEngineHandler();

self.onmessage = (event: MessageEvent) => {
  handler.onmessage(event);
};
