"use client";

import { useId, type FormEvent, type KeyboardEvent } from "react";
import { Search, X } from "lucide-react";
import { useCatalog } from "@/components/catalog/CatalogProvider";

type SearchFieldVariant = "header" | "drawer";

interface SearchFieldProps {
  variant: SearchFieldVariant;
  /** Runs when the form is submitted (Enter), for example to close the mobile drawer. */
  onSubmit?: () => void;
}

export function SearchField({ variant, onSubmit }: SearchFieldProps) {
  const { state, actions } = useCatalog();
  const inputId = useId();
  const hasValue = state.query.length > 0;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit?.();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape" && hasValue) {
      event.preventDefault();
      event.stopPropagation();
      actions.clearQuery();
    }
  };

  return (
    <form
      className={variant === "drawer" ? "search search--wide" : "search"}
      role="search"
      onSubmit={handleSubmit}
    >
      <label className="visually-hidden" htmlFor={inputId}>
        Buscar documentos
      </label>
      <Search className="search__icon" size={18} aria-hidden="true" />
      <input
        id={inputId}
        className="search__input"
        type="search"
        name="q"
        value={state.query}
        placeholder="Título o eje"
        autoComplete="off"
        enterKeyHint="search"
        spellCheck={false}
        onChange={(event) => actions.setQuery(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      {hasValue ? (
        <button
          type="button"
          className="btn btn--quiet btn--icon search__clear"
          aria-label="Borrar búsqueda"
          onClick={() => actions.clearQuery()}
        >
          <X size={18} aria-hidden="true" />
        </button>
      ) : null}
    </form>
  );
}
