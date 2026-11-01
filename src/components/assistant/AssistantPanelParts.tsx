"use client";

import {
  Fragment,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  AlertCircle,
  FileText,
  FolderOpen,
  Loader2,
  RotateCcw,
  SendHorizontal,
  Settings2,
  ShieldCheck,
  Sparkles,
  Square,
  X,
} from "lucide-react";
import { Highlight } from "@/components/catalog/Highlight";
import { makeSnippet } from "@/lib/rag/snippet";
import type { RetrievedSource } from "@/lib/rag/types";
import { useAssistant, type AssistantMessage } from "./AssistantProvider";

const TITLE_ID = "asistente-titulo";
const SUGGESTIONS = [
  "¿Qué pósteres hay sobre la marcha?",
  "Llévame a Práctica Infancia",
  "¿Quién asesora los proyectos cardiopulmonares?",
];
const PRIVACY_NOTE = "Tus preguntas se procesan en tu dispositivo; no se envían a ningún servidor.";

/* ---------- Root ---------- */

export function AssistantRoot({ children }: { children: ReactNode }) {
  const { state, actions, meta } = useAssistant();
  const { registerPanel, panelId } = meta;

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape" && !event.defaultPrevented) {
      event.stopPropagation();
      actions.close();
    }
  };

  return (
    <section
      ref={registerPanel}
      id={panelId}
      className="assistant keep-motion"
      aria-labelledby={TITLE_ID}
      hidden={!state.open}
      onKeyDown={handleKeyDown}
    >
      {children}
    </section>
  );
}

/* ---------- Header ---------- */

export function AssistantHeader() {
  const { state, actions, meta } = useAssistant();
  const canPickModel = state.engine.kind !== "unsupported" && state.engine.kind !== "checking";

  return (
    <header className="assistant__header surface-navy">
      <Sparkles size={22} aria-hidden="true" className="assistant__mark" />
      <div className="assistant__heading">
        <h2 id={TITLE_ID} className="assistant__title">
          Asistente virtual
        </h2>
        <p className="assistant__subtitle">{meta.aiActive ? "IA local activa" : "Modo búsqueda"}</p>
      </div>
      <div className="assistant__header-actions">
        {canPickModel ? <ModelMenu /> : null}
        {state.messages.length > 0 ? (
          <button
            type="button"
            className="btn btn--icon assistant__header-btn"
            aria-label="Nueva conversación"
            title="Nueva conversación"
            onClick={actions.reset}
          >
            <RotateCcw size={18} aria-hidden="true" />
          </button>
        ) : null}
        <button
          type="button"
          className="btn btn--icon assistant__header-btn"
          aria-label="Cerrar asistente"
          title="Cerrar asistente"
          onClick={actions.close}
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}

function ModelMenu() {
  const { state, actions, meta } = useAssistant();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      buttonRef.current?.focus();
    }
  };

  return (
    <div
      className="assistant__menu-wrap"
      onKeyDown={handleKeyDown}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        className="btn btn--icon assistant__header-btn"
        aria-label="Elegir modelo de IA"
        title="Elegir modelo de IA"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        <Settings2 size={18} aria-hidden="true" />
      </button>
      {open ? (
        <fieldset id={menuId} className="assistant__menu">
          <legend className="assistant__menu-title">Modelo de IA local</legend>
          {meta.models.map((model) => (
            <label key={model.id} className="assistant__option">
              <input
                type="radio"
                name="assistant-model"
                checked={state.modelId === model.id}
                onChange={() => actions.selectModel(model.id)}
              />
              <span className="assistant__option-text">
                <strong>
                  {model.label} <span className="assistant__option-size">{model.sizeLabel}</span>
                </strong>
                <span>{model.description}</span>
              </span>
            </label>
          ))}
        </fieldset>
      ) : null}
    </div>
  );
}

/* ---------- Status ---------- */

export function AssistantStatus() {
  const { state, actions, meta } = useAssistant();
  const [confirming, setConfirming] = useState(false);
  const { engine } = state;

  if (engine.kind === "ready") return null;

  if (engine.kind === "checking") {
    return (
      <div className="assistant__status" role="status">
        <p className="assistant__note">Comprobando compatibilidad con la IA local…</p>
      </div>
    );
  }

  if (engine.kind === "unsupported") {
    return (
      <div className="assistant__status">
        <p className="assistant__note">
          <AlertCircle size={16} aria-hidden="true" />
          <span>
            {engine.reason} Estás en modo búsqueda: te muestro los fragmentos más relevantes del repositorio.
          </span>
        </p>
      </div>
    );
  }

  if (engine.kind === "downloading") {
    const percent = Math.round(engine.progress * 100);
    return (
      <div className="assistant__status">
        <div
          className="assistant__progress"
          role="progressbar"
          aria-label="Descarga de la IA local"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <div className="assistant__progress-bar" style={{ inlineSize: `${percent}%` }} />
        </div>
        <p className="assistant__note" role="status">
          <Loader2 size={16} aria-hidden="true" className="assistant__spin" />
          <span>
            {engine.text} {percent} %
          </span>
        </p>
      </div>
    );
  }

  if (engine.kind === "error") {
    return (
      <div className="assistant__status">
        <p className="assistant__note">
          <AlertCircle size={16} aria-hidden="true" />
          <span>{engine.message} Seguirás en modo búsqueda.</span>
        </p>
        <button type="button" className="btn btn--secondary assistant__status-btn" onClick={actions.activateAi}>
          Reintentar
        </button>
      </div>
    );
  }

  const size = meta.selectedModel.sizeLabel;
  if (!confirming) {
    return (
      <div className="assistant__status">
        <button
          type="button"
          className="btn btn--secondary assistant__status-btn"
          onClick={() => setConfirming(true)}
        >
          <Sparkles size={18} aria-hidden="true" />
          Activar IA local ({size})
        </button>
      </div>
    );
  }

  return (
    <div className="assistant__status">
      <ModelConsent
        size={size}
        onAccept={() => {
          setConfirming(false);
          actions.activateAi();
        }}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}

interface ModelConsentProps {
  size: string;
  onAccept: () => void;
  onCancel: () => void;
}

function ModelConsent({ size, onAccept, onCancel }: ModelConsentProps) {
  const headingId = useId();
  const acceptRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    acceptRef.current?.focus();
  }, []);

  return (
    <section className="assistant__consent" aria-labelledby={headingId}>
      <h3 id={headingId} className="assistant__consent-title">
        <ShieldCheck size={18} aria-hidden="true" />
        Activar la IA local
      </h3>
      <p>
        Se descargará una sola vez un modelo de lenguaje ({size}) que se guarda en la memoria de tu navegador. Después
        responde redactando con los pósteres, sin enviar nada a un servidor. Requiere un equipo con tarjeta gráfica
        compatible; si usas datos móviles, la descarga puede consumir tu plan.
      </p>
      <div className="assistant__consent-actions">
        <button ref={acceptRef} type="button" className="btn btn--primary" onClick={onAccept}>
          Descargar y activar
        </button>
        <button type="button" className="btn btn--quiet assistant__consent-cancel" onClick={onCancel}>
          Ahora no
        </button>
      </div>
    </section>
  );
}

/* ---------- Messages ---------- */

export function AssistantMessages() {
  const { state, actions, meta } = useAssistant();
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const { messages } = state;

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const last = messages[messages.length - 1];
    if (last?.role === "user") stickRef.current = true;
    if (!stickRef.current) return;
    const lastElement = element.lastElementChild;
    if (last?.role === "assistant" && last.status !== "streaming" && last.sources?.length && lastElement) {
      // A long reply with sources: show it from its first line, not from its last source.
      const offset = lastElement.getBoundingClientRect().top - element.getBoundingClientRect().top;
      element.scrollTop += offset - 16;
      stickRef.current = false;
      return;
    }
    element.scrollTop = element.scrollHeight;
  }, [messages, state.open]);

  const handleScroll = () => {
    const element = scrollRef.current;
    if (!element) return;
    stickRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 48;
  };

  return (
    <>
      <div
        ref={scrollRef}
        className="assistant__messages"
        role="log"
        aria-live="off"
        aria-label="Conversación con el asistente"
        tabIndex={0}
        onScroll={handleScroll}
      >
        {messages.length === 0 ? (
          <div className="assistant__empty">
            <p className="assistant__greeting">
              Hola, soy el asistente del repositorio. Puedo responder preguntas sobre los pósteres, citar sus fuentes
              y llevarte a una categoría o a un PDF.
            </p>
            <ul className="assistant__chips" aria-label="Preguntas sugeridas">
              {SUGGESTIONS.map((suggestion) => (
                <li key={suggestion}>
                  <button type="button" className="assistant__chip" onClick={() => actions.send(suggestion)}>
                    {suggestion}
                  </button>
                </li>
              ))}
            </ul>
            <p className="assistant__privacy">
              <ShieldCheck size={16} aria-hidden="true" />
              <span>{PRIVACY_NOTE}</span>
            </p>
          </div>
        ) : (
          messages.map((message) => <MessageView key={message.id} message={message} />)
        )}
      </div>
      <div className="visually-hidden" aria-live="polite" aria-atomic="true">
        {meta.liveText}
      </div>
    </>
  );
}

function sourceDomId(messageId: string, n: number): string {
  return `asistente-${messageId}-fuente-${n}`;
}

function withCitations(message: AssistantMessage): ReactNode {
  const sources = message.sources ?? [];
  return message.content.split(/(\[\d{1,2}\])/g).map((part, index) => {
    const match = /^\[(\d{1,2})\]$/.exec(part);
    const n = match ? Number(match[1]) : 0;
    if (!match || !sources.some((source) => source.n === n)) return <Fragment key={index}>{part}</Fragment>;
    return (
      <button
        key={index}
        type="button"
        className="assistant__cite"
        aria-label={`Ir a la fuente ${n}`}
        onClick={() => document.getElementById(sourceDomId(message.id, n))?.focus()}
      >
        [{n}]
      </button>
    );
  });
}

function MessageView({ message }: { message: AssistantMessage }) {
  if (message.role === "user") {
    return (
      <div className="assistant__msg assistant__msg--user">
        <p className="assistant__text">{message.content}</p>
      </div>
    );
  }
  const waiting = message.status === "streaming" && message.content === "";
  const sources = message.sources ?? [];
  return (
    <div className="assistant__msg assistant__msg--bot" data-mode={message.mode}>
      {waiting ? (
        <p className="assistant__text assistant__typing">
          <Loader2 size={16} aria-hidden="true" className="assistant__spin" />
          <span>Buscando en el repositorio…</span>
        </p>
      ) : (
        <p className="assistant__text">{withCitations(message)}</p>
      )}
      {sources.length > 0 ? (
        <ol className="assistant__sources" aria-label="Fuentes">
          {sources.map((source) => (
            <SourceItem key={source.chunk.id} source={source} message={message} />
          ))}
        </ol>
      ) : null}
    </div>
  );
}

const SOURCE_KIND = { pdf: "PDF", catalog: "Catálogo", page: "Guía del sitio" } as const;

function SourceItem({ source, message }: { source: RetrievedSource; message: AssistantMessage }) {
  const { actions } = useAssistant();
  const { chunk } = source;
  const terms = message.terms ?? [];
  const kind = SOURCE_KIND[chunk.source];
  const showSnippet = message.mode === "search";

  return (
    <li id={sourceDomId(message.id, source.n)} className="assistant__source" tabIndex={-1}>
      <p className="assistant__source-title">
        <span className="assistant__source-n">[{source.n}]</span> {chunk.title}
      </p>
      <p className="assistant__source-meta">
        {kind}
        {chunk.page ? ` · página ${chunk.page}` : ""}
      </p>
      {showSnippet ? (
        <p className="assistant__snippet">
          <Highlight text={makeSnippet(chunk.text, terms, 200)} terms={terms} />
        </p>
      ) : null}
      {chunk.posterSlug || chunk.categorySlug ? (
        <div className="assistant__source-actions">
          {chunk.posterSlug ? (
            <button
              type="button"
              className="assistant__link-btn"
              onClick={(event) => actions.openPdf(chunk.posterSlug as string, event.currentTarget)}
            >
              <FileText size={16} aria-hidden="true" />
              Abrir PDF
              <span className="visually-hidden">: {chunk.title}</span>
            </button>
          ) : null}
          {chunk.categorySlug ? (
            <button
              type="button"
              className="assistant__link-btn"
              onClick={() => actions.goToCategory(chunk.categorySlug as string)}
            >
              <FolderOpen size={16} aria-hidden="true" />
              Ir a la categoría
              <span className="visually-hidden">: {chunk.title}</span>
            </button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

/* ---------- Composer ---------- */

export function AssistantComposer() {
  const { state, actions, meta } = useAssistant();
  const fieldId = useId();
  const { registerComposer } = meta;
  const streaming = state.busy && meta.aiActive && state.messages.at(-1)?.status === "streaming";

  // Keep the textarea height in sync with the draft (it resets after a send).
  useEffect(() => {
    const element = document.getElementById(fieldId);
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 128)}px`;
  }, [state.draft, fieldId]);

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (!state.busy) actions.send(state.draft);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <form className="assistant__composer" onSubmit={submit}>
      <label htmlFor={fieldId} className="visually-hidden">
        Tu pregunta
      </label>
      <textarea
        ref={registerComposer}
        id={fieldId}
        className="assistant__input"
        rows={1}
        maxLength={500}
        placeholder="Escribe tu pregunta…"
        value={state.draft}
        onChange={(event) => actions.setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      {streaming ? (
        <button
          type="button"
          className="btn btn--secondary btn--icon"
          aria-label="Detener respuesta"
          onClick={actions.stop}
        >
          <Square size={18} aria-hidden="true" />
        </button>
      ) : (
        <button
          type="submit"
          className="btn btn--primary btn--icon"
          aria-label="Enviar pregunta"
          disabled={state.busy || state.draft.trim() === ""}
        >
          <SendHorizontal size={18} aria-hidden="true" />
        </button>
      )}
    </form>
  );
}
