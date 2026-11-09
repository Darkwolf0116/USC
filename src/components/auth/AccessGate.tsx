"use client";

import { useId, useState, type FormEvent, type ReactNode } from "react";
import { LogIn } from "lucide-react";
import type { AccessResponseBody } from "@/app/api/access/route";
import { BrandLogo } from "@/components/layout/BrandLogo";
import { validateAccessForm, type AccessFormErrors } from "@/lib/auth/email";
import { safeNextPath } from "@/lib/auth/redirect";

const NETWORK_ERROR = "No pudimos registrar tu ingreso. Revisa tu conexión e inténtalo de nuevo.";

function readNextPath(): string {
  return safeNextPath(new URLSearchParams(window.location.search).get("next"));
}

/** Full name + institutional email; the server registers the visit and grants access. */
export function AccessGate() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [fieldErrors, setFieldErrors] = useState<AccessFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const ids = {
    name: useId(),
    nameError: useId(),
    email: useId(),
    emailError: useId(),
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    const errors = validateAccessForm(fullName, email);
    setFieldErrors(errors);
    if (errors.fullName || errors.email) {
      setStatus("");
      return;
    }

    setBusy(true);
    setStatus("Registrando tu ingreso…");
    let body: AccessResponseBody | null = null;
    try {
      const response = await fetch("/api/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email }),
      });
      body = (await response.json()) as AccessResponseBody;
    } catch {
      body = null;
    }

    if (!body?.ok) {
      setBusy(false);
      setStatus("");
      setFieldErrors(body?.errors ?? {});
      if (!body?.errors) setFormError(body?.message ?? NETWORK_ERROR);
      return;
    }

    setStatus("Ingreso registrado. Abriendo el repositorio…");
    // A full navigation lets src/proxy.ts read the new access cookie.
    window.location.assign(readNextPath());
  };

  return (
    <AccessShell>
      <form className="access__form" noValidate onSubmit={handleSubmit}>
        <p className="access__lead">Ingresa con tu nombre completo y tu correo institucional.</p>

        <div className="access__field">
          <label className="access__label" htmlFor={ids.name}>
            Nombre completo
          </label>
          <input
            id={ids.name}
            className="access__input"
            name="fullName"
            type="text"
            autoComplete="name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            aria-invalid={fieldErrors.fullName ? true : undefined}
            aria-describedby={fieldErrors.fullName ? ids.nameError : undefined}
            disabled={busy}
            required
          />
          {fieldErrors.fullName && (
            <p className="access__error" id={ids.nameError}>
              {fieldErrors.fullName}
            </p>
          )}
        </div>

        <div className="access__field">
          <label className="access__label" htmlFor={ids.email}>
            Correo institucional
          </label>
          <input
            id={ids.email}
            className="access__input"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="usuario@usc.edu.co"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={fieldErrors.email ? true : undefined}
            aria-describedby={fieldErrors.email ? ids.emailError : undefined}
            disabled={busy}
            required
          />
          {fieldErrors.email && (
            <p className="access__error" id={ids.emailError}>
              {fieldErrors.email}
            </p>
          )}
        </div>

        {formError && (
          <p className="access__alert" role="alert">
            {formError}
          </p>
        )}

        <button type="submit" className="btn btn--primary btn--large access__submit" disabled={busy}>
          <LogIn size={18} aria-hidden="true" />
          Ingresar
        </button>

        <p className="access__note">
          Guardamos tu nombre y correo para registrar el acceso al repositorio académico del
          Programa de Fisioterapia.
        </p>
      </form>

      <p className="visually-hidden" role="status" aria-live="polite">
        {status}
      </p>
    </AccessShell>
  );
}

function AccessShell({ children }: { children: ReactNode }) {
  const titleId = useId();
  return (
    <section className="access__card" aria-labelledby={titleId}>
      <header className="access__brand">
        <BrandLogo variant="footer" />
        <div>
          <h1 className="access__title" id={titleId}>
            Acceso al repositorio
          </h1>
          <p className="access__subtitle">Proyectos de Aula · Programa de Fisioterapia USC</p>
        </div>
      </header>
      <div className="access__body">{children}</div>
    </section>
  );
}
