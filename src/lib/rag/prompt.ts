import type { LlmMessage, RetrievedSource } from "./types";

export const NOT_FOUND_ANSWER = "No encontré esa información en el repositorio.";

const MAX_SOURCE_CHARS = 700;
const MAX_HISTORY_CHARS = 400;
const HISTORY_TURNS = 4;

export const SYSTEM_PROMPT = [
  'Eres el asistente del "Repositorio de Proyectos de Aula - Fisioterapia USC", un sitio con pósteres académicos del Programa de Fisioterapia de la Universidad Santiago de Cali.',
  "Responde SIEMPRE en español, de forma clara y concisa (máximo 120 palabras).",
  "Responde ÚNICAMENTE con la información del CONTEXTO numerado que recibes. No uses conocimiento externo ni inventes datos, nombres o cifras.",
  "Cita las fuentes que uses con su número entre corchetes, por ejemplo [1] o [2].",
  `Si el contexto no contiene la respuesta, responde exactamente: "${NOT_FOUND_ANSWER}"`,
  "No des consejos clínicos, diagnósticos ni tratamientos más allá de lo que digan los documentos; para eso, recomienda consultar a un profesional de la salud.",
].join("\n");

function sourceLabel(source: RetrievedSource): string {
  const { chunk } = source;
  if (chunk.source === "pdf") return `${chunk.title} (PDF${chunk.page ? `, p. ${chunk.page}` : ""})`;
  if (chunk.source === "catalog") return `${chunk.title} (catálogo)`;
  return `${chunk.title} (guía del sitio)`;
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max).trimEnd()}…`;
}

export function formatContext(sources: RetrievedSource[]): string {
  if (sources.length === 0) return "(sin resultados)";
  return sources
    .map((source) => `[${source.n}] ${sourceLabel(source)}\n${truncate(source.chunk.text, MAX_SOURCE_CHARS)}`)
    .join("\n\n");
}

export interface HistoryTurn {
  role: "user" | "assistant";
  content: string;
}

/** Builds the chat request: system prompt, the last turns, and the question with its context. */
export function buildMessages(
  question: string,
  sources: RetrievedSource[],
  history: HistoryTurn[],
): LlmMessage[] {
  const recent = history
    .filter((turn) => turn.content.trim() !== "")
    .slice(-HISTORY_TURNS)
    .map<LlmMessage>((turn) => ({ role: turn.role, content: truncate(turn.content, MAX_HISTORY_CHARS) }));

  return [
    { role: "system", content: SYSTEM_PROMPT },
    ...recent,
    {
      role: "user",
      content: `CONTEXTO:\n${formatContext(sources)}\n\nPREGUNTA: ${question}`,
    },
  ];
}
