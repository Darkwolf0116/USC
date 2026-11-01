let locks = 0;

/** Locks page scroll. Safe to call from several overlays at once. */
export function lockScroll(): void {
  locks += 1;
  document.documentElement.setAttribute("data-scroll-locked", "");
}

export function unlockScroll(): void {
  locks = Math.max(0, locks - 1);
  if (locks === 0) {
    document.documentElement.removeAttribute("data-scroll-locked");
  }
}
