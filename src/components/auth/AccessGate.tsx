"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, KeyRound, Mail, RotateCw } from "lucide-react";
import { BrandLogo } from "@/components/layout/BrandLogo";
import {
  normalizeEmail,
  normalizeFullName,
  validateAccessForm,
  type AccessFormErrors,
} from "@/lib/auth/email";
import { safeNextPath } from "@/lib/auth/redirect";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { describeRecordError, describeSendError, describeVerifyError } from "./accessErrors";

const RESEND_COOLDOWN_SECONDS = 60;
const CODE_PATTERN = /^\d{6}$/;

type Step = "details" | "code";

function readNextPath(): string {
  return safeNextPath(new URLSearchParams(window.location.search).get("next"));
}

/** Two-step access: name + institutional email, then the 6-digit code sent by Supabase. */
export function AccessGate() {
  const supabase = getSupabaseBrowserClient();
  const [step, setStep] = useState<Step>("details");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [fieldErrors, setFieldErrors] = useState<AccessFormErrors>({});
  const [codeError, setCodeError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const codeInputRef = useRef<HTMLInputElement>(null);
  const ids = {
    name: useId(),
    nameError: useId(),
    email: useId(),
    emailError: useId(),
    code: useId(),
    codeHint: useId(),
    codeError: useId(),
    formError: useId(),
  };

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    if (step === "code") codeInputRef.current?.focus();
  }, [step]);

  if (!supabase) {
    return (
      <AccessShell>
        <p className="access__alert" role="alert">
          El acceso no está configurado. Falta definir las variables de Supabase del sitio.
        </p>
      </AccessShell>
    );
  }

  const sendCode = async () => {
    setBusy(true);
    setFormError(null);
    setStatus("Enviando el código…");
    const { error } = await supabase.auth.signInWithOtp({
      email: normalizeEmail(email),
      options: { shouldCreateUser: true, data: { full_name: normalizeFullName(fullName) } },
    });
    setBusy(false);
    if (error) {
      setStatus("");
      setFormError(describeSendError(error));
      return false;
    }
    setCooldown(RESEND_COOLDOWN_SECONDS);
    setStatus(`Enviamos un código a ${normalizeEmail(email)}.`);
    return true;
  };

  const handleDetailsSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const errors = validateAccessForm(fullName, email);
    setFieldErrors(errors);
    if (errors.fullName || errors.email) {
      setStatus("");
      return;
    }
    if (await sendCode()) {
      setCode("");
      setCodeError(null);
      setStep("code");
    }
  };

  const handleCodeSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const token = code.trim();
    if (!CODE_PATTERN.test(token)) {
      setCodeError("El código tiene 6 dígitos.");
      return;
    }
    setBusy(true);
    setCodeError(null);
    setFormError(null);
    setStatus("Verificando el código…");

    const { error } = await supabase.auth.verifyOtp({
      email: normalizeEmail(email),
      token,
      type: "email",
    });
    if (error) {
      setBusy(false);
      setStatus("");
      setCodeError(describeVerifyError(error));
      return;
    }

    const { error: recordError } = await supabase.rpc("record_access", {
      p_full_name: normalizeFullName(fullName),
      p_user_agent: navigator.userAgent,
    });
    if (recordError) {
      // Every entry must be registered: without the record there is no access.
      await supabase.auth.signOut();
      setBusy(false);
      setStatus("");
      setFormError(describeRecordError(recordError));
      return;
    }

    setStatus("Acceso concedido. Abriendo el repositorio…");
    // A full navigation lets src/proxy.ts read the new session cookies.
    window.location.assign(readNextPath());
  };

  const handleChangeEmail = () => {
    setStep("details");
    setCode("");
    setCodeError(null);
    setFormError(null);
    setStatus("");
  };

  return (
    <AccessShell>
      {step === "details" ? (
        <form className="access__form" noValidate onSubmit={handleDetailsSubmit}>
          <p className="access__lead">
            Ingresa con tu nombre completo y tu correo institucional. Te enviaremos un código de
            acceso.
          </p>

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
            <p className="access__alert" id={ids.formError} role="alert">
              {formError}
            </p>
          )}

          <button type="submit" className="btn btn--primary btn--large access__submit" disabled={busy}>
            <Mail size={18} aria-hidden="true" />
            Enviar código
          </button>

          <p className="access__note">
            Guardamos tu nombre y correo para registrar el acceso al repositorio académico del
            Programa de Fisioterapia.
          </p>
        </form>
      ) : (
        <form className="access__form" noValidate onSubmit={handleCodeSubmit}>
          <p className="access__lead">
            Escribe el código de 6 dígitos que enviamos a <strong>{normalizeEmail(email)}</strong>.
          </p>

          <div className="access__field">
            <label className="access__label" htmlFor={ids.code}>
              Código de acceso
            </label>
            <input
              ref={codeInputRef}
              id={ids.code}
              className="access__input access__input--code"
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
              aria-invalid={codeError ? true : undefined}
              aria-describedby={codeError ? `${ids.codeHint} ${ids.codeError}` : ids.codeHint}
              disabled={busy}
              required
            />
            <p className="access__hint" id={ids.codeHint}>
              Si no lo ves, revisa la carpeta de correo no deseado.
            </p>
            {codeError && (
              <p className="access__error" id={ids.codeError}>
                {codeError}
              </p>
            )}
          </div>

          {formError && (
            <p className="access__alert" id={ids.formError} role="alert">
              {formError}
            </p>
          )}

          <button type="submit" className="btn btn--primary btn--large access__submit" disabled={busy}>
            <KeyRound size={18} aria-hidden="true" />
            Verificar e ingresar
          </button>

          <div className="access__actions">
            <button
              type="button"
              className="btn btn--quiet"
              onClick={() => void sendCode()}
              disabled={busy || cooldown > 0}
            >
              <RotateCw size={18} aria-hidden="true" />
              {cooldown > 0 ? `Reenviar código en ${cooldown} s` : "Reenviar código"}
            </button>
            <button type="button" className="btn btn--quiet" onClick={handleChangeEmail} disabled={busy}>
              <ArrowLeft size={18} aria-hidden="true" />
              Cambiar correo
            </button>
          </div>
        </form>
      )}

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
