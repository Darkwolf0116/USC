/** Model ids come from `prebuiltAppConfig.model_list` of the installed @mlc-ai/web-llm. */
export interface AssistantModel {
  id: string;
  label: string;
  /** Download size of the language model plus the embedding model, shown to the visitor. */
  sizeLabel: string;
  /** Approximate download in megabytes (language model + embedding model). */
  downloadMB: number;
  description: string;
}

const EMBEDDING_MB = 118;

export const ASSISTANT_MODELS: AssistantModel[] = [
  {
    id: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
    label: "Equilibrado",
    sizeLabel: "≈ 1 GB",
    downloadMB: 880 + EMBEDDING_MB,
    description: "Respuestas más completas. Requiere unos 1,7 GB de memoria de video.",
  },
  {
    id: "Qwen2.5-0.5B-Instruct-q4f16_1-MLC",
    label: "Ligero",
    sizeLabel: "≈ 0,4 GB",
    downloadMB: 290 + EMBEDDING_MB,
    description: "Descarga más pequeña y más rápido en equipos modestos, con respuestas más breves.",
  },
];

export const DEFAULT_MODEL_ID = ASSISTANT_MODELS[0].id;

export function findModel(id: string): AssistantModel {
  return ASSISTANT_MODELS.find((model) => model.id === id) ?? ASSISTANT_MODELS[0];
}
