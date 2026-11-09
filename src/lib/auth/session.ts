/** httpOnly cookie holding the visitor id returned by `register_visit`. */
export const ACCESS_COOKIE = "usc_access";
/** Readable cookie with the visitor's first name, only for the header greeting. */
export const VISITOR_NAME_COOKIE = "usc_visitor_name";
export const ACCESS_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isVisitorId(value: string | null | undefined): boolean {
  return typeof value === "string" && UUID.test(value);
}

export function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? "";
}
