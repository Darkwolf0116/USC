"use client";

import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { ACCESS_PATH } from "@/lib/auth/redirect";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type UserMenuVariant = "header" | "drawer";

const VARIANT_CLASS: Record<UserMenuVariant, string> = {
  header: "user-menu",
  drawer: "user-menu user-menu--drawer",
};

function firstName(fullName: unknown, email: string | undefined): string {
  if (typeof fullName === "string" && fullName.trim()) return fullName.trim().split(/\s+/)[0];
  return email?.split("@")[0] ?? "";
}

/** Signed-in visitor's first name and the "Salir" action. */
export function UserMenu({ variant }: { variant: UserMenuVariant }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (active && data.user) setName(firstName(data.user.user_metadata?.full_name, data.user.email));
    });
    return () => {
      active = false;
    };
  }, []);

  const signOut = async () => {
    setBusy(true);
    await getSupabaseBrowserClient()?.auth.signOut();
    window.location.assign(ACCESS_PATH);
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
