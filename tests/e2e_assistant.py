"""End-to-end checks for the virtual assistant (Playwright, headless Chromium).

Headless Chromium has no WebGPU, so this exercises the "modo búsqueda" path: BM25 retrieval over
public/rag/index.json, intent routing and the source actions. The local-AI path needs a real GPU.

Run with the dev server managed for you:

    python .agents/skills/webapp-testing/scripts/with_server.py \
        --server "npm run dev" --port 3000 --timeout 180 -- python tests/e2e_assistant.py

Set BASE_URL to test another host (for example a production build on another port).
"""

import json
import os
import sys
from pathlib import Path

from playwright.sync_api import Page, sync_playwright

BASE_URL = os.environ.get("BASE_URL", "http://localhost:3000")
ROOT = Path(__file__).resolve().parent.parent
SHOTS = ROOT / "tests" / "screenshots"
CATALOG = json.loads((ROOT / "src" / "data" / "catalog.json").read_text(encoding="utf-8"))
CATEGORIES = CATALOG["categories"]
POSTERS = [poster for category in CATEGORIES for poster in category["posters"]]

failures: list[str] = []
console_errors: list[str] = []


def check(name: str, condition: bool, detail: str = "") -> None:
    status = "PASS" if condition else "FAIL"
    print(f"[{status}] {name}" + (f" ({detail})" if detail and not condition else ""))
    if not condition:
        failures.append(name)


def watch_console(page: Page, sink: list[str]) -> None:
    page.on("console", lambda msg: sink.append(f"console.{msg.type}: {msg.text}") if msg.type == "error" else None)
    page.on("pageerror", lambda err: sink.append(f"pageerror: {err}"))


def grant_access(page: Page) -> None:
    """The site is gated: register a test visit (fake Supabase from scripts/dev-e2e.mjs) once per context."""
    if any(cookie["name"] == "usc_access" for cookie in page.context.cookies()):
        return
    response = page.request.post(
        BASE_URL + "/api/access",
        data={"fullName": "Prueba Automatizada", "email": "e2e@usc.edu.co"},
    )
    if not response.ok:
        raise RuntimeError(f"Could not get access: {response.status} {response.text()}")


def open_home(page: Page) -> None:
    grant_access(page)
    page.goto(BASE_URL, wait_until="networkidle")
    page.wait_for_selector("#categorias .tab")


def launcher(page: Page):
    return page.get_by_role("button", name="Asistente virtual")


def active_in_panel(page: Page, selector: str) -> bool:
    return page.evaluate(
        "(sel) => { const el = document.activeElement; return !!el && el.matches(sel) && !!el.closest('#asistente-panel'); }",
        selector,
    )


def ask(page: Page, text: str) -> None:
    box = page.get_by_label("Tu pregunta")
    box.fill(text)
    box.press("Enter")


def check_desktop(page: Page) -> None:
    open_home(page)

    button = launcher(page)
    check("launcher visible", button.is_visible())
    check("launcher collapsed by default", button.get_attribute("aria-expanded") == "false")
    check("launcher controls the panel", button.get_attribute("aria-controls") == "asistente-panel")
    check("panel hidden before opening", not page.locator("#asistente-panel").is_visible())

    button.click()
    panel = page.locator("#asistente-panel")
    panel.wait_for(state="visible")
    check("panel opens", panel.is_visible())
    check("launcher reports expanded", button.get_attribute("aria-expanded") == "true")
    check("composer focused on open", active_in_panel(page, "textarea"))
    check("panel title", panel.get_by_role("heading", name="Asistente virtual").is_visible())
    check("privacy note shown", "no se envían a ningún servidor" in panel.inner_text())
    check("three suggestion chips", panel.locator(".assistant__chip").count() == 3)
    page.wait_for_selector(".assistant__status")
    check("search mode subtitle", "Modo búsqueda" in panel.locator(".assistant__subtitle").inner_text())
    page.screenshot(path=str(SHOTS / "assistant-desktop-empty.png"))

    # Suggestion -> retrieval in search mode with sources.
    panel.get_by_role("button", name="¿Qué pósteres hay sobre la marcha?").click()
    sources = panel.locator(".assistant__msg--bot .assistant__source")
    sources.first.wait_for(timeout=20000)
    titles = [t.lower() for t in sources.locator(".assistant__source-title").all_inner_texts()]
    marcha_titles = [p["title"].lower() for p in POSTERS if "marcha" in p["title"].lower()]
    check("search reply lists sources", len(titles) >= 1, str(titles))
    check(
        "sources include a marcha poster",
        any(any(m in t for t in titles) for m in marcha_titles),
        str(titles),
    )
    check("snippets mark matched terms", panel.locator(".assistant__snippet mark").count() >= 1)
    page.screenshot(path=str(SHOTS / "assistant-desktop-search.png"))

    # Source action: open the PDF viewer on top of the non-modal panel.
    open_pdf = panel.get_by_role("button", name="Abrir PDF").first
    open_pdf.click()
    dialog = page.locator("dialog.viewer[open]")
    dialog.wait_for()
    viewer_title = dialog.locator(".viewer__title").inner_text().lower()
    check("viewer opens from a source", any(viewer_title.startswith(m[:30]) for m in marcha_titles) or any(m in viewer_title for m in marcha_titles), viewer_title)
    page.keyboard.press("Escape")
    page.wait_for_selector("dialog.viewer", state="detached")
    check("Esc closes the viewer", page.locator("dialog.viewer").count() == 0)
    check("panel still open after the viewer", panel.is_visible())

    # Navigation intent: executes the action and confirms it.
    ask(page, "Llévame a Práctica Infancia")
    page.wait_for_function("location.search.includes('categoria=practica-infancia')")
    check("intent selects the category in the URL", "categoria=practica-infancia" in page.url, page.url)
    heading = page.locator("#panel-categoria h2").inner_text()
    check("category panel heading matches", heading.strip() == "Práctica Infancia", heading)
    last_reply = panel.locator(".assistant__msg--bot").last.inner_text()
    check("assistant confirms the action", "Práctica Infancia" in last_reply, last_reply)

    # Other intents: category by name, poster by title, and catalog search.
    ask(page, "Abre la categoría Administración y Gestión")
    page.wait_for_function("location.search.includes('categoria=administracion-y-gestion-en-ft')")
    check("category intent by name", True)
    poster = next(p for p in POSTERS if "ergonom" in p["title"].lower())
    ask(page, f"Abre el póster {poster['title']}")
    dialog = page.locator("dialog.viewer[open]")
    dialog.wait_for()
    check("poster intent opens the viewer", poster["title"].lower() in dialog.locator(".viewer__title").inner_text().lower())
    page.keyboard.press("Escape")
    page.wait_for_selector("dialog.viewer", state="detached")
    ask(page, "buscar ergonomía")
    page.wait_for_function("document.querySelector('input[type=search]')?.value === 'ergonomia'")
    check("search intent fills the catalog search", True)

    # A question without matches degrades to the not-found message.
    ask(page, "zzzxqwv")
    panel.locator(".assistant__msg--bot .assistant__text", has_text="No encontré esa información en el repositorio.").last.wait_for()
    check("no-match question gets the not-found message", True)
    check("live region announces the final reply", "No encontré" in panel.locator("[aria-live='polite']").inner_text())
    page.screenshot(path=str(SHOTS / "assistant-desktop-conversation.png"))

    # Esc closes the panel and focus returns to the launcher.
    page.get_by_label("Tu pregunta").focus()
    page.keyboard.press("Escape")
    page.wait_for_selector("#asistente-panel", state="hidden")
    check("Esc closes the panel", not panel.is_visible())
    check("focus returns to the launcher", page.evaluate("document.activeElement?.getAttribute('aria-controls')") == "asistente-panel")

    # The conversation survives minimizing.
    button.click()
    panel.wait_for(state="visible")
    check("conversation kept after reopening", panel.locator(".assistant__msg").count() >= 4)


def check_mobile(page: Page) -> None:
    page.set_viewport_size({"width": 375, "height": 812})
    open_home(page)
    button = launcher(page)
    box = button.bounding_box()
    check("mobile launcher is a 44px+ target", box is not None and box["width"] >= 44 and box["height"] >= 44, str(box))
    button.click()
    panel = page.locator("#asistente-panel")
    panel.wait_for(state="visible")
    page.wait_for_timeout(400)
    rect = panel.bounding_box()
    # Headless Chromium reserves a 15px classic scrollbar gutter (real phones use overlay scrollbars).
    client_width = 375
    check(
        "panel is a full-screen sheet",
        rect is not None and rect["x"] == 0 and rect["y"] == 0 and client_width - 15 <= rect["width"] <= client_width and rect["height"] == 812,
        f"{rect} client_width={client_width}",
    )
    check("page scroll is locked", page.evaluate("document.documentElement.hasAttribute('data-scroll-locked')"))
    check(
        "no horizontal overflow",
        page.evaluate("document.documentElement.scrollWidth <= window.innerWidth"),
    )
    page.screenshot(path=str(SHOTS / "assistant-mobile-empty.png"))

    panel.get_by_role("button", name="¿Qué pósteres hay sobre la marcha?").click()
    panel.locator(".assistant__source").first.wait_for(timeout=20000)
    check(
        "no horizontal overflow with sources",
        page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
        and page.evaluate("(() => { const m = document.querySelector('.assistant__messages'); return m.scrollWidth <= m.clientWidth; })()"),
    )
    page.screenshot(path=str(SHOTS / "assistant-mobile-search.png"))

    # Opening a PDF minimizes the sheet first so the viewer is the only layer.
    panel.get_by_role("button", name="Abrir PDF").first.click()
    page.locator("dialog.viewer[open]").wait_for()
    check("sheet minimized when a PDF opens", not panel.is_visible())
    page.keyboard.press("Escape")
    page.wait_for_selector("dialog.viewer", state="detached")
    check("page scroll unlocked after closing everything", not page.evaluate("document.documentElement.hasAttribute('data-scroll-locked')"))


def main() -> int:
    SHOTS.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()
        watch_console(page, console_errors)
        check_desktop(page)
        check_mobile(page)
        browser.close()

    check("no console errors", not console_errors, "; ".join(console_errors[:3]))
    print(f"\n{len(failures)} failure(s)")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
