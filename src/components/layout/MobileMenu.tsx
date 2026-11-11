"use client";

import { useId, useRef, type MouseEvent } from "react";
import { Menu, X } from "lucide-react";
import { UserMenu } from "@/components/auth/UserMenu";
import { useCatalog } from "@/components/catalog/CatalogProvider";
import { CategoryLink } from "@/components/catalog/CategoryLink";
import { lockScroll, unlockScroll } from "@/lib/scroll-lock";
import { SearchField } from "./SearchField";

/** Small-screen menu: a native dialog drawer with the search field and the axis list. */
export function MobileMenu() {
  const { meta } = useCatalog();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  const open = () => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      lockScroll();
      dialog.showModal();
    }
  };

  const close = () => dialogRef.current?.close();

  const handleBackdropClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) close();
  };

  return (
    <>
      <button
        type="button"
        className="btn btn--quiet btn--icon site-header__menu"
        aria-label="Abrir menú de ejes y búsqueda"
        aria-haspopup="dialog"
        onClick={open}
      >
        <Menu size={24} aria-hidden="true" />
      </button>

      <dialog
        ref={dialogRef}
        className="drawer keep-motion"
        aria-labelledby={titleId}
        onClose={unlockScroll}
        onClick={handleBackdropClick}
      >
        <div className="drawer__head">
          <h2 className="drawer__title" id={titleId}>
            Ejes y búsqueda
          </h2>
          <button
            type="button"
            className="btn btn--quiet btn--icon"
            aria-label="Cerrar menú"
            onClick={close}
          >
            <X size={24} aria-hidden="true" />
          </button>
        </div>
        <div className="drawer__body">
          <SearchField variant="drawer" onSubmit={close} />
          <ul className="menu-list">
            {meta.categories.map((category) => (
              <li key={category.slug}>
                <CategoryLink slug={category.slug} className="menu-link" onSelect={close}>
                  Eje {category.number}: {category.name}
                </CategoryLink>
              </li>
            ))}
          </ul>
          <UserMenu variant="drawer" />
        </div>
      </dialog>
    </>
  );
}
