"use client";

import { Sparkles } from "lucide-react";
import { useAssistant } from "./AssistantProvider";

/** Floating button, bottom right, that opens and closes the assistant panel. */
export function AssistantLauncher() {
  const { state, actions, meta } = useAssistant();
  const { registerLauncher, panelId } = meta;
  return (
    <button
      ref={registerLauncher}
      type="button"
      className="assistant-launcher"
      aria-label="Asistente virtual"
      aria-expanded={state.open}
      aria-controls={panelId}
      onClick={actions.toggle}
    >
      <Sparkles size={20} aria-hidden="true" className="assistant-launcher__icon" />
      <span className="assistant-launcher__label" aria-hidden="true">
        Asistente
      </span>
    </button>
  );
}
