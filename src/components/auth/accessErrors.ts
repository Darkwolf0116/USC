import type { AuthError, PostgrestError } from "@supabase/supabase-js";

type SupabaseFailure = Pick<AuthError, "message" | "status"> & { code?: string };

/** Turns Supabase Auth errors into short Spanish messages for the access form. */
export function describeSendError(error: SupabaseFailure): string {
  if (error.code === "over_email_send_rate_limit" || error.status === 429) {
    return "Se enviaron demasiados códigos. Espera unos minutos e inténtalo de nuevo.";
  }
  if (/usc\.edu\.co|database error/i.test(error.message)) {
    return "Solo se permiten correos @usc.edu.co.";
  }
  if (error.code === "email_address_invalid") {
    return "Revisa tu correo institucional: no parece válido.";
  }
  return "No pudimos enviar el código. Revisa tu conexión e inténtalo de nuevo.";
}

export function describeVerifyError(error: SupabaseFailure): string {
  if (error.code === "otp_expired" || error.status === 403 || error.status === 400) {
    return "El código no es válido o ya venció. Revísalo o solicita uno nuevo.";
  }
  if (error.status === 429) {
    return "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.";
  }
  return "No pudimos verificar el código. Revisa tu conexión e inténtalo de nuevo.";
}

export function describeRecordError(error: PostgrestError): string {
  if (/usc\.edu\.co/i.test(error.message)) return "Solo se permiten correos @usc.edu.co.";
  return "No pudimos registrar tu ingreso. Inténtalo de nuevo en unos segundos.";
}
