"use client";

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useCatalog } from "@/components/catalog/CatalogProvider";
import type { Poster } from "@/data/types";
import { detectWebGpu } from "@/lib/rag/capabilities";
import { detectIntent } from "@/lib/rag/intents";
import { ASSISTANT_MODELS, DEFAULT_MODEL_ID, findModel, type AssistantModel } from "@/lib/rag/models";
import { buildMessages, NOT_FOUND_ANSWER, type HistoryTurn } from "@/lib/rag/prompt";
import { contentWords, highlightTerms } from "@/lib/rag/text";
import type { AssistantAction, AssistantRole, RetrievedSource } from "@/lib/rag/types";
import type { Embedder } from "@/lib/rag/embedder";
import type { LlmHandle } from "@/lib/rag/llm";
import { lockScroll, unlockScroll } from "@/lib/scroll-lock";
import { normalize } from "@/lib/search";

export const ASSISTANT_PANEL_ID = "asistente-panel";

const CONSENT_KEY = "usc-assistant-ai-consent";
const MODEL_KEY = "usc-assistant-model";
const MOBILE_QUERY = "(max-width: 40rem)";
const EMBEDDING_MB = 118;
/** Pronouns and connectors that make a short question depend on the previous one. */
const FOLLOW_UP_CUES = new Set(["y", "lo", "la", "los", "las", "ese", "esa", "esos", "esas", "eso", "su", "sus", "mismo", "tambien"]);

export type EngineStatus =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "unsupported"; reason: string }
  | { kind: "downloading"; progress: number; text: string }
  | { kind: "ready" }
  | { kind: "error"; message: string };

export type MessageStatus = "streaming" | "done" | "stopped" | "error";
export type MessageMode = "ai" | "search" | "action" | "info";

export interface AssistantMessage {
  id: string;
  role: AssistantRole;
  content: string;
  sources?: RetrievedSource[];
  /** Normalized terms of the question, used to mark matches in search-mode snippets. */
  terms?: string[];
  action?: AssistantAction;
  status: MessageStatus;
  mode?: MessageMode;
}

export interface AssistantState {
  open: boolean;
  messages: AssistantMessage[];
  engine: EngineStatus;
  modelId: string;
  busy: boolean;
  draft: string;
}

export interface AssistantActions {
  open: () => void;
  close: () => void;
  toggle: () => void;
  send: (text: string) => void;
  stop: () => void;
  reset: () => void;
  setDraft: (value: string) => void;
  activateAi: () => void;
  selectModel: (id: string) => void;
  openPdf: (posterSlug: string, trigger: HTMLElement | null) => void;
  goToCategory: (categorySlug: string) => void;
}

export interface AssistantMeta {
  panelId: string;
  /** Callback refs: the provider keeps the elements to manage focus without exposing ref objects. */
  registerLauncher: (element: HTMLButtonElement | null) => void;
  registerComposer: (element: HTMLTextAreaElement | null) => void;
  registerPanel: (element: HTMLElement | null) => void;
  isMobile: boolean;
  /** True when the local language model is loaded and answering. */
  aiActive: boolean;
  models: AssistantModel[];
  selectedModel: AssistantModel;
  /** Text for the polite live region: the last finished assistant message. */
  liveText: string;
}

interface AssistantContextValue {
  state: AssistantState;
  actions: AssistantActions;
  meta: AssistantMeta;
}

const AssistantContext = createContext<AssistantContextValue | null>(null);

export function useAssistant(): AssistantContextValue {
  const value = use(AssistantContext);
  if (!value) throw new Error("useAssistant must be used inside <AssistantProvider>.");
  return value;
}

function subscribeMobile(onChange: () => void): () => void {
  const query = window.matchMedia(MOBILE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function readMobile(): boolean {
  return window.matchMedia(MOBILE_QUERY).matches;
}

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* Storage can be blocked (private windows); the preference just is not remembered. */
  }
}

function errorText(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "No fue posible cargar la IA local.";
}

export function AssistantProvider({ children }: { children: ReactNode }) {
  const catalog = useCatalog();
  const { categories } = catalog.meta;
  const catalogActions = catalog.actions;

  const [open, setOpen] = useState(false);
  const [messages, setMessagesState] = useState<AssistantMessage[]>([]);
  const [engine, setEngine] = useState<EngineStatus>({ kind: "idle" });
  const [webgpu, setWebgpu] = useState<"unknown" | "supported" | "unsupported">("unknown");
  const [unsupportedReason, setUnsupportedReason] = useState("");
  const [modelId, setModelId] = useState(DEFAULT_MODEL_ID);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState("");
  const isMobile = useSyncExternalStore(subscribeMobile, readMobile, () => false);

  const launcherRef = useRef<HTMLButtonElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const registerLauncher = useCallback((element: HTMLButtonElement | null) => {
    launcherRef.current = element;
  }, []);
  const registerComposer = useCallback((element: HTMLTextAreaElement | null) => {
    composerRef.current = element;
  }, []);
  const registerPanel = useCallback((element: HTMLElement | null) => {
    panelRef.current = element;
  }, []);
  const messagesRef = useRef<AssistantMessage[]>([]);
  const idCounter = useRef(0);
  const llmRef = useRef<LlmHandle | null>(null);
  const embedderRef = useRef<Embedder | null>(null);
  const activatingRef = useRef(false);
  const stopRequestedRef = useRef(false);
  const busyRef = useRef(false);
  const wasOpenRef = useRef(false);
  const startedRef = useRef(false);
  const modelIdRef = useRef(DEFAULT_MODEL_ID);

  const setMessages = useCallback((update: (current: AssistantMessage[]) => AssistantMessage[]) => {
    messagesRef.current = update(messagesRef.current);
    setMessagesState(messagesRef.current);
  }, []);

  const patchMessage = useCallback(
    (id: string, patch: Partial<AssistantMessage>) => {
      setMessages((current) => current.map((m) => (m.id === id ? { ...m, ...patch } : m)));
    },
    [setMessages],
  );

  const addMessage = useCallback(
    (message: Omit<AssistantMessage, "id">): string => {
      idCounter.current += 1;
      const id = `m${idCounter.current}`;
      setMessages((current) => [...current, { ...message, id }]);
      return id;
    },
    [setMessages],
  );

  const catalogLite = useMemo(
    () => ({
      categories: categories.map(({ slug, name }) => ({ slug, name })),
      posters: categories.flatMap((c) => c.posters.map(({ slug, title }) => ({ slug, title }))),
    }),
    [categories],
  );

  const findPoster = useCallback(
    (slug: string): Poster | undefined => {
      for (const category of categories) {
        const poster = category.posters.find((p) => p.slug === slug);
        if (poster) return poster;
      }
      return undefined;
    },
    [categories],
  );

  /* ---------- open / close ---------- */

  const openPanel = useCallback(() => setOpen(true), []);
  const closePanel = useCallback(() => setOpen(false), []);
  const togglePanel = useCallback(() => setOpen((value) => !value), []);

  // Focus: composer on open, launcher on close (unless focus already moved elsewhere, e.g. a dialog).
  useEffect(() => {
    if (open) {
      composerRef.current?.focus();
    } else if (wasOpenRef.current) {
      const active = document.activeElement;
      if (!active || active === document.body || panelRef.current?.contains(active)) {
        launcherRef.current?.focus();
      }
    }
    wasOpenRef.current = open;
  }, [open]);

  // The full-screen sheet on phones locks page scroll; the desktop panel never does.
  useEffect(() => {
    if (!open || !isMobile) return;
    lockScroll();
    return unlockScroll;
  }, [open, isMobile]);

  /* ---------- local AI ---------- */

  const activateAi = useCallback(async () => {
    if (activatingRef.current || llmRef.current) return;
    activatingRef.current = true;
    writeStorage(CONSENT_KEY, "1");
    const model = findModel(modelIdRef.current);
    const llmMB = model.downloadMB - EMBEDDING_MB;
    let embedFraction = 0;
    let llmFraction = 0;
    const report = () => {
      const progress = (embedFraction * EMBEDDING_MB + llmFraction * llmMB) / (EMBEDDING_MB + llmMB);
      setEngine({
        kind: "downloading",
        progress,
        text:
          llmFraction < 1
            ? "Descargando y preparando el modelo de lenguaje…"
            : "Preparando el modelo de búsqueda semántica…",
      });
    };
    report();
    try {
      const [{ Embedder }, { loadLlm }] = await Promise.all([
        import("@/lib/rag/embedder"),
        import("@/lib/rag/llm"),
      ]);
      const embedder = embedderRef.current ?? new Embedder();
      embedderRef.current = embedder;
      // The semantic search model is optional: if it fails, retrieval falls back to BM25.
      const embedderReady = embedder
        .start((p) => {
          embedFraction = p;
          report();
        })
        .catch(() => {
          embedder.dispose();
          embedderRef.current = null;
        });
      const handle = await loadLlm(model.id, (p) => {
        llmFraction = p;
        report();
      });
      await embedderReady;
      llmRef.current = handle;
      setEngine({ kind: "ready" });
    } catch (error) {
      setEngine({ kind: "error", message: errorText(error) });
    } finally {
      activatingRef.current = false;
    }
  }, []);

  // First time the panel opens: check WebGPU, restore preferences and auto-load if consent was given.
  useEffect(() => {
    if (!open || startedRef.current) return;
    startedRef.current = true;
    const storedModel = readStorage(MODEL_KEY);
    const resolvedModel = ASSISTANT_MODELS.find((m) => m.id === storedModel)?.id;
    if (resolvedModel) modelIdRef.current = resolvedModel;
    void detectWebGpu().then((support) => {
      if (resolvedModel) setModelId(resolvedModel);
      if (!support.supported) {
        setUnsupportedReason(support.reason ?? "");
        setWebgpu("unsupported");
        return;
      }
      setWebgpu("supported");
      if (readStorage(CONSENT_KEY) === "1") void activateAi();
    });
  }, [open, activateAi]);

  const selectModel = useCallback(
    (id: string) => {
      if (id === modelId || !ASSISTANT_MODELS.some((m) => m.id === id)) return;
      writeStorage(MODEL_KEY, id);
      modelIdRef.current = id;
      setModelId(id);
      if (llmRef.current) {
        void import("@/lib/rag/llm").then(({ disposeLlm }) => disposeLlm(llmRef.current));
        llmRef.current = null;
        setEngine({ kind: "idle" });
      } else if (engine.kind === "error") {
        setEngine({ kind: "idle" });
      }
    },
    [engine.kind, modelId],
  );

  // Release workers when the page unmounts the assistant.
  useEffect(
    () => () => {
      embedderRef.current?.dispose();
      llmRef.current?.worker.terminate();
    },
    [],
  );

  /* ---------- conversation ---------- */

  const minimizeOnMobile = useCallback(() => {
    if (readMobile()) setOpen(false);
  }, []);

  const runAction = useCallback(
    (action: AssistantAction, trigger: HTMLElement | null): string => {
      if (action.type === "selectCategory") {
        const category = categories.find((c) => c.slug === action.slug);
        catalogActions.selectCategory(action.slug);
        minimizeOnMobile();
        return `Listo, te llevé al eje «${category ? `Eje ${category.number}: ${category.name}` : action.slug}».`;
      }
      if (action.type === "openPoster") {
        const poster = findPoster(action.slug);
        if (!poster) return NOT_FOUND_ANSWER;
        const mobile = readMobile();
        if (mobile) setOpen(false);
        catalogActions.openViewer(poster, mobile ? launcherRef.current : trigger);
        return `Abrí el documento «${poster.title}».`;
      }
      catalogActions.setQuery(action.query);
      minimizeOnMobile();
      return `Apliqué la búsqueda «${action.query}» en el catálogo.`;
    },
    [categories, catalogActions, findPoster, minimizeOnMobile],
  );

  const respondWithRetrieval = useCallback(
    async (question: string, history: HistoryTurn[], assistantId: string) => {
      const { loadIndex, loadVectors, retrieve } = await import("@/lib/rag/retrieval");
      const index = await loadIndex();

      // Short follow-ups ("¿y quién la asesora?") borrow the previous question for retrieval.
      const previousQuestion = [...history].reverse().find((turn) => turn.role === "user")?.content;
      const isFollowUp =
        contentWords(question).length < 3 && normalize(question).split(/[^p{L}p{N}]+/u).some((w) => FOLLOW_UP_CUES.has(w));
      const retrievalQuery = isFollowUp && previousQuestion ? `${previousQuestion} ${question}` : question;

      let queryVector: Float32Array | null = null;
      let vectors: Float32Array | null = null;
      if (embedderRef.current) {
        queryVector = await embedderRef.current.embedQuery(retrievalQuery);
        if (queryVector) vectors = await loadVectors(index);
      }
      const sources = retrieve(index, retrievalQuery, { queryVector, vectors });
      const terms = highlightTerms(retrievalQuery);

      const searchModeReply = (prefix?: string) => {
        const intro =
          sources.length === 0
            ? NOT_FOUND_ANSWER
            : `${prefix ?? ""}Encontré ${sources.length} ${
                sources.length === 1 ? "fragmento relevante" : "fragmentos relevantes"
              } en el repositorio:`;
        patchMessage(assistantId, { content: intro, sources, terms, status: "done", mode: "search" });
      };

      const handle = llmRef.current;
      if (!handle || sources.length === 0) {
        searchModeReply();
        return;
      }

      let text = "";
      let frame = 0;
      const flush = () => {
        frame = 0;
        patchMessage(assistantId, { content: text });
      };
      try {
        stopRequestedRef.current = false;
        const { streamCompletion } = await import("@/lib/rag/llm");
        const llmMessages = buildMessages(question, sources, history);
        for await (const delta of streamCompletion(handle, llmMessages)) {
          text += delta;
          if (!frame) frame = window.requestAnimationFrame(flush);
        }
        if (frame) window.cancelAnimationFrame(frame);
        const stopped = stopRequestedRef.current;
        const notFound = text.trim().startsWith(NOT_FOUND_ANSWER.slice(0, 24));
        patchMessage(assistantId, {
          content: text.trim() || (stopped ? "Respuesta detenida." : NOT_FOUND_ANSWER),
          sources: notFound ? [] : sources,
          terms,
          status: stopped ? "stopped" : "done",
          mode: "ai",
        });
      } catch (error) {
        if (frame) window.cancelAnimationFrame(frame);
        if (stopRequestedRef.current) {
          patchMessage(assistantId, { content: text.trim() || "Respuesta detenida.", status: "stopped", mode: "ai" });
          return;
        }
        // The model failed mid-answer (for example the GPU was lost): degrade to search mode.
        llmRef.current = null;
        setEngine({ kind: "error", message: errorText(error) });
        searchModeReply("La IA local dejó de responder; te muestro resultados de búsqueda. ");
      }
    },
    [patchMessage],
  );

  const send = useCallback(
    (raw: string) => {
      const question = raw.trim();
      if (!question || busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      // Navigation commands and their confirmations are not part of the Q&A history.
      const history: HistoryTurn[] = messagesRef.current
        .filter((m, i, all) => {
          if (m.status === "streaming" || m.mode === "action") return false;
          return !(m.role === "user" && all[i + 1]?.mode === "action");
        })
        .map((m) => ({ role: m.role, content: m.content }));
      const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;

      addMessage({ role: "user", content: question, status: "done" });
      setDraft("");

      const finish = () => {
        busyRef.current = false;
        setBusy(false);
      };

      const action = detectIntent(question, catalogLite);
      if (action) {
        const content = runAction(action, trigger);
        addMessage({ role: "assistant", content, action, status: "done", mode: "action" });
        finish();
        return;
      }

      const assistantId = addMessage({ role: "assistant", content: "", status: "streaming" });
      respondWithRetrieval(question, history, assistantId)
        .catch((error: unknown) => {
          patchMessage(assistantId, {
            content: `No pude consultar el repositorio. ${errorText(error)}`,
            status: "error",
            mode: "info",
          });
        })
        .finally(finish);
    },
    [addMessage, catalogLite, patchMessage, respondWithRetrieval, runAction],
  );

  const stop = useCallback(() => {
    stopRequestedRef.current = true;
    llmRef.current?.engine.interruptGenerate();
  }, []);

  const reset = useCallback(() => {
    if (busyRef.current) stop();
    setMessages(() => []);
  }, [setMessages, stop]);

  const openPdf = useCallback(
    (posterSlug: string, trigger: HTMLElement | null) => {
      const poster = findPoster(posterSlug);
      if (!poster) return;
      const mobile = readMobile();
      if (mobile) setOpen(false);
      catalogActions.openViewer(poster, mobile ? launcherRef.current : trigger);
    },
    [catalogActions, findPoster],
  );

  const goToCategory = useCallback(
    (categorySlug: string) => {
      catalogActions.selectCategory(categorySlug);
      minimizeOnMobile();
    },
    [catalogActions, minimizeOnMobile],
  );

  /* ---------- derived values ---------- */

  const effectiveEngine: EngineStatus =
    webgpu === "unsupported"
      ? { kind: "unsupported", reason: unsupportedReason }
      : webgpu === "unknown"
        ? open
          ? { kind: "checking" }
          : { kind: "idle" }
        : engine;

  const lastMessage = messages[messages.length - 1];
  const liveText =
    lastMessage && lastMessage.role === "assistant" && lastMessage.status !== "streaming"
      ? lastMessage.content
      : "";

  const actions = useMemo<AssistantActions>(
    () => ({
      open: openPanel,
      close: closePanel,
      toggle: togglePanel,
      send,
      stop,
      reset,
      setDraft,
      activateAi: () => void activateAi(),
      selectModel,
      openPdf,
      goToCategory,
    }),
    [openPanel, closePanel, togglePanel, send, stop, reset, activateAi, selectModel, openPdf, goToCategory],
  );

  const value: AssistantContextValue = {
    state: { open, messages, engine: effectiveEngine, modelId, busy, draft },
    actions,
    meta: {
      panelId: ASSISTANT_PANEL_ID,
      registerLauncher,
      registerComposer,
      registerPanel,
      isMobile,
      aiActive: effectiveEngine.kind === "ready",
      models: ASSISTANT_MODELS,
      selectedModel: findModel(modelId),
      liveText,
    },
  };

  return <AssistantContext value={value}>{children}</AssistantContext>;
}
