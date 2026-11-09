"use client";

import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { ACCESS_PATH } from "@/lib/auth/redirect";
import { VISITOR_NAME_COOKIE } from "@/lib/auth/session";

type UserMenuVariant = "header" | "drawer";

const VARIANT_CLASS: Record<UserMenuVariant, string> = {
  header: "user-menu",
  drawer: "user-menu user-menu--drawer",
};

function readVisitorName(): string {
  const entry = document.cookie.split("; ").find((cookie) => cookie.startsWith(`${VISITOR_NAME_COOKIE}=`));
  if (!entry) return "";
  try {
    return decodeURIComponent(entry.slice(VISITOR_NAME_COOKIE.length + 1));
  } catch {
    return "";
  }
}

/** Visitor's first name and the "Salir" action. */
export function UserMenu({ variant }: { variant: UserMenuVariant }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // The cookie only exists in the browser, so it is read after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(readVisitorName());
  }, []);

  const signOut = async () => {
    setBusy(true);
    try {
      await fetch("/api/access", { method: "DELETE" });
    } finally {
      window.location.assign(ACCESS_PATH);
    }
  };

  return (
    <div className={VARIANT_CLASS[variant]}>
      {name && <span className="user-menu__name">Hola, {name}</span>}
      <button type="button" className="btn btn--secondary" onClick={signOut} disabled={busy}>
        <LogOut size={18} aria-hidden="true" />
        Salir
      </button>
    </div>
  );
}
