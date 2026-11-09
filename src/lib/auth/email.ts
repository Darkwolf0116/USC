export const INSTITUTIONAL_DOMAIN = "usc.edu.co";

const INSTITUTIONAL_EMAIL = /^[a-z0-9._%+-]+@usc\.edu\.co$/;
const NAME_WORD = /^[\p{L}][\p{L}'’-]*$/u;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Mirrors `public.is_institutional_email` in the Supabase migration. */
export function isInstitutionalEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return INSTITUTIONAL_EMAIL.test(normalizeEmail(email));
}

export function normalizeFullName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

/** At least two words of letters (accents and ñ included), 3 to 120 characters. */
export function isValidFullName(name: string): boolean {
  const normalized = normalizeFullName(name);
  if (normalized.length < 3 || normalized.length > 120) return false;
  const words = normalized.split(" ");
  return words.length >= 2 && words.every((word) => NAME_WORD.test(word));
}

export interface AccessFormErrors {
  fullName?: string;
  email?: string;
}

export function validateAccessForm(fullName: string, email: string): AccessFormErrors {
  const errors: AccessFormErrors = {};

  if (!normalizeFullName(fullName)) {
    errors.fullName = "Escribe tu nombre completo.";
  } else if (!isValidFullName(fullName)) {
    errors.fullName = "Escribe tu nombre y apellido, solo con letras.";
  }

  if (!normalizeEmail(email)) {
    errors.email = "Escribe tu correo institucional.";
  } else if (!isInstitutionalEmail(email)) {
    errors.email = `Solo se permiten correos @${INSTITUTIONAL_DOMAIN}.`;
  }

  return errors;
}
