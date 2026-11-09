"""End-to-end checks for the poster catalog (Playwright, headless Chromium).

Run with the dev server managed for you:

    python .agents/skills/webapp-testing/scripts/with_server.py \
        --server "npm run dev" --port 3000 --timeout 120 -- python tests/e2e_catalog.py

Set BASE_URL to test another host (for example a production build on another port).
"""

import json
import os
import re
import sys
from pathlib import Path

from playwright.sync_api import Page, sync_playwright

BASE_URL = os.environ.get("BASE_URL", "http://localhost:3000")
ROOT = Path(__file__).resolve().parent.parent
SHOTS = ROOT / "tests" / "screenshots"
CATALOG = json.loads((ROOT / "src" / "data" / "catalog.json").read_text(encoding="utf-8"))
CATEGORIES = CATALOG["categories"]

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


def check_desktop(page: Page) -> None:
    open_home(page)

    check("page title mentions the repository", "Repositorio de Proyectos de Aula" in page.title(), page.title())
    check("html lang is es", page.locator("html").get_attribute("lang") == "es")
    h1 = page.get_by_role("heading", level=1)
    check("h1 text", h1.inner_text().strip() == "Muestra Académica de Proyectos de Aula", h1.inner_text())
    check("institutional title in header", page.locator(".brand__title").inner_text().startswith("Repositorio de Proyectos de Aula"))

    cta = page.get_by_role("link", name="Explorar Categorías")
    box = cta.bounding_box()
    check("hero CTA visible at 1280x800", box is not None and box["y"] + box["height"] <= 800, str(box))

    tabs = page.get_by_role("tab")
    check("10 category tabs", tabs.count() == 10, str(tabs.count()))
    names = [t.strip() for t in tabs.all_inner_texts()]
    check("tab names follow the brief order", names == [c["name"] for c in CATEGORIES], str(names))

    # Selecting a tab changes the panel heading and the URL.
    tabs.nth(1).click()
    heading = page.locator("#panel-categoria h2")
    check("panel heading follows the tab", heading.inner_text() == CATEGORIES[1]["name"], heading.inner_text())
    check("URL carries ?categoria=", f"categoria={CATEGORIES[1]['slug']}" in page.url, page.url)

    # Keyboard: arrows, Home and End move selection with a roving tabindex.
    tabs.nth(1).focus()
    page.keyboard.press("ArrowDown")
    check("ArrowDown selects next tab", tabs.nth(2).get_attribute("aria-selected") == "true")
    check("roving tabindex on active tab", tabs.nth(2).get_attribute("tabindex") == "0" and tabs.nth(1).get_attribute("tabindex") == "-1")
    page.keyboard.press("End")
    check("End selects last tab", tabs.nth(9).get_attribute("aria-selected") == "true")
    page.keyboard.press("Home")
    check("Home selects first tab", tabs.nth(0).get_attribute("aria-selected") == "true")

    # Every category shows 2 to 4 cards and its download links.
    for index, category in enumerate(CATEGORIES):
        tabs.nth(index).click()
        page.wait_for_function(
            "name => document.querySelector('#panel-categoria h2')?.textContent === name", arg=category["name"]
        )
        count = page.locator("#panel-categoria article.poster-card").count()
        check(f"{category['name']}: 2-4 cards", 2 <= count <= 4 and count == len(category["posters"]), str(count))

    # A shared link opens the right category.
    page.goto(f"{BASE_URL}/?categoria={CATEGORIES[3]['slug']}", wait_until="networkidle")
    page.wait_for_function(
        "name => document.querySelector('#panel-categoria h2')?.textContent === name", arg=CATEGORIES[3]["name"]
    )
    check("deep link selects the category", True)

    # Footer category link selects the category and keeps the URL in sync.
    page.get_by_role("contentinfo").get_by_role("link", name=CATEGORIES[6]["name"]).click()
    page.wait_for_function(
        "name => document.querySelector('#panel-categoria h2')?.textContent === name", arg=CATEGORIES[6]["name"]
    )
    check("footer link selects the category", f"categoria={CATEGORIES[6]['slug']}" in page.url, page.url)

    # Desktop popover menu.
    page.get_by_role("button", name="Categorías", exact=True).click()
    menu = page.locator(".menu-popover")
    check("category menu opens", menu.is_visible())
    check("category menu lists 10 links", menu.get_by_role("link").count() == 10)
    page.keyboard.press("Escape")
    menu.wait_for(state="hidden")
    check("Esc closes the category menu", not menu.is_visible())
    page.get_by_role("button", name="Categorías", exact=True).click()
    menu.get_by_role("link", name=CATEGORIES[2]["name"]).click()
    page.wait_for_function(
        "name => document.querySelector('#panel-categoria h2')?.textContent === name", arg=CATEGORIES[2]["name"]
    )
    menu.wait_for(state="hidden")
    check("menu link selects the category and closes the menu", not menu.is_visible())


def check_search(page: Page) -> None:
    open_home(page)
    box = page.get_by_role("searchbox", name="Buscar proyectos")

    box.fill("marcha")
    page.wait_for_selector("#categorias mark")
    cards = page.locator("#categorias article.poster-card")
    expected = sum(1 for c in CATEGORIES for p in c["posters"] if "marcha" in p["title"].lower())
    check("search 'marcha' filters cards", cards.count() == expected and expected >= 2, f"{cards.count()} vs {expected}")
    check("search wraps matches in <mark>", page.locator("#categorias mark").count() >= 2)
    check("tabs are hidden while searching", page.get_by_role("tab").count() == 0)
    status = page.locator('#categorias [role="status"]').inner_text()
    check("live region announces the count", re.fullmatch(r"\d+ resultados?", status.strip()) is not None, status)
    check("results grouped by category", page.locator(".results__group").count() == 2)

    # Accent and case insensitive: "ANALISIS" finds "Análisis".
    box.fill("ANALISIS")
    page.wait_for_function("document.querySelectorAll('#categorias mark').length > 0")
    check("accent-insensitive search", page.locator("#categorias article.poster-card").count() >= 2)

    # Advisors and students are searchable.
    box.fill("quintero")
    page.wait_for_selector("#categorias mark")
    check("search by advisor", page.locator("#categorias article.poster-card").count() >= 1)

    # Clear button inside the field.
    page.get_by_role("button", name="Borrar búsqueda").click()
    page.wait_for_selector("#categorias .tab")
    check("clear button restores tabs", page.get_by_role("tab").count() == 10)

    # Empty state and recovery.
    box.fill("zzxqwv")
    page.get_by_role("heading", name=re.compile("No encontramos")).wait_for()
    check("empty state shown", True)
    page.get_by_role("button", name="Limpiar búsqueda").click()
    page.wait_for_selector("#categorias .tab")
    check("Limpiar búsqueda restores tabs", page.get_by_role("tab").count() == 10)
    check("search field is emptied", box.input_value() == "")


def check_viewer(page: Page) -> None:
    open_home(page)
    page.locator("#panel-categoria").scroll_into_view_if_needed()
    trigger = page.get_by_role("button", name=re.compile("^Ver PDF completo")).first
    label = trigger.get_attribute("aria-label")
    trigger.click()

    dialog = page.locator("dialog.viewer[open]")
    dialog.wait_for()
    check("viewer dialog opens", dialog.is_visible())
    check("body scroll is locked", page.evaluate("document.documentElement.hasAttribute('data-scroll-locked')"))
    page.wait_for_selector(".react-pdf__Page canvas", timeout=30000)
    check("PDF canvas renders", page.locator(".react-pdf__Page canvas").count() >= 1)
    check("page status shown", "Página 1 de 1" in page.locator(".viewer__status").inner_text(), page.locator(".viewer__status").inner_text())
    check("close button is labelled", page.get_by_role("button", name="Cerrar visor").is_visible())
    page.screenshot(path=str(SHOTS / "viewer-1280x800.png"))

    page.get_by_role("button", name="Aumentar zoom").click()
    check("zoom in updates the level", page.locator(".viewer__zoom").inner_text() == "125%", page.locator(".viewer__zoom").inner_text())
    page.get_by_role("button", name="Ajustar al ancho").click()
    check("fit width resets zoom", page.locator(".viewer__zoom").inner_text() == "100%")

    page.keyboard.press("Escape")
    page.wait_for_selector("dialog.viewer", state="detached")
    check("Esc closes the viewer", page.locator("dialog.viewer").count() == 0)
    focused = page.evaluate("document.activeElement?.getAttribute('aria-label')")
    check("focus returns to the trigger", focused == label, str(focused))
    check("scroll lock released", not page.evaluate("document.documentElement.hasAttribute('data-scroll-locked')"))

    # Backdrop click closes the viewer too.
    trigger.click()
    dialog.wait_for()
    page.mouse.click(8, 400)
    page.wait_for_selector("dialog.viewer", state="detached")
    check("backdrop click closes the viewer", True)

    # Close button.
    trigger.click()
    dialog.wait_for()
    page.get_by_role("button", name="Cerrar visor").click()
    page.wait_for_selector("dialog.viewer", state="detached")
    check("close button closes the viewer", True)


def check_downloads(page: Page) -> None:
    open_home(page)
    links = page.locator("#panel-categoria a[download]")
    hrefs = [links.nth(i).get_attribute("href") for i in range(links.count())]
    check("download links in the active panel", len(hrefs) == len(CATEGORIES[0]["posters"]), str(hrefs))
    label = links.first.get_attribute("aria-label") or ""
    check("download link label contains the title", label.startswith("Descargar PDF: "), label)

    all_pdfs = [p["pdf"] for c in CATEGORIES for p in c["posters"]]
    bad = []
    for href in all_pdfs:
        response = page.request.get(BASE_URL + href)
        if response.status != 200 or "pdf" not in (response.headers.get("content-type") or ""):
            bad.append(f"{href} -> {response.status}")
    check(f"all {len(all_pdfs)} PDF downloads return 200", not bad, "; ".join(bad[:3]))


def check_logo_fallback(browser) -> None:
    context = browser.new_context(viewport={"width": 1280, "height": 800})
    page = context.new_page()
    page.route("**/Info/logo.png", lambda route: route.fulfill(status=404, body="not found"))
    grant_access(page)
    page.goto(BASE_URL, wait_until="networkidle")
    page.wait_for_selector('[data-fallback="true"]')
    count = page.locator('[data-fallback="true"]').count()
    check("logo fallback monogram renders when logo.png is 404", count >= 1, str(count))
    check("fallback tile shows USC", "USC" in page.locator('[data-fallback="true"]').first.inner_text())
    context.close()


def check_mobile(browser) -> None:
    context = browser.new_context(
        viewport={"width": 375, "height": 812}, is_mobile=True, has_touch=True, device_scale_factor=2
    )
    page = context.new_page()
    watch_console(page, console_errors)
    open_home(page)

    overflow = page.evaluate("document.documentElement.scrollWidth - window.innerWidth")
    check("no horizontal overflow at 375px", overflow <= 0, str(overflow))
    check("desktop search is hidden on mobile", not page.get_by_role("button", name="Categorías", exact=True).is_visible())

    page.get_by_role("button", name="Abrir menú de categorías y búsqueda").click()
    drawer = page.locator("dialog.drawer[open]")
    drawer.wait_for()
    check("mobile drawer opens", drawer.is_visible())
    check("drawer lists 10 categories", drawer.get_by_role("link").count() == 10)
    page.keyboard.press("Escape")
    page.wait_for_selector("dialog.drawer[open]", state="detached")

    page.get_by_role("button", name="Abrir menú de categorías y búsqueda").click()
    drawer.wait_for()
    drawer.get_by_role("link", name=CATEGORIES[4]["name"]).click()
    page.wait_for_function(
        "name => document.querySelector('#panel-categoria h2')?.textContent === name", arg=CATEGORIES[4]["name"]
    )
    check("drawer link selects category and closes", not drawer.is_visible())

    page.get_by_role("button", name="Abrir menú de categorías y búsqueda").click()
    drawer.wait_for()
    drawer.get_by_role("searchbox").fill("marcha")
    page.keyboard.press("Enter")
    page.wait_for_selector("#categorias mark")
    check("mobile search shows results", page.locator("#categorias article.poster-card").count() >= 2)
    page.get_by_role("button", name="Limpiar búsqueda").last.click()
    page.wait_for_selector("#categorias .tab")

    page.goto(BASE_URL, wait_until="networkidle")
    page.wait_for_selector("#categorias .tab")
    page.screenshot(path=str(SHOTS / "home-375x812.png"), full_page=True)

    page.get_by_role("button", name=re.compile("^Ver PDF completo")).first.click()
    page.wait_for_selector(".react-pdf__Page canvas", timeout=30000)
    page.screenshot(path=str(SHOTS / "viewer-375x812.png"))
    page.get_by_role("button", name="Cerrar visor").click()
    page.wait_for_selector("dialog.viewer", state="detached")
    context.close()


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    SHOTS.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()
        watch_console(page, console_errors)

        check_desktop(page)
        page.goto(BASE_URL, wait_until="networkidle")
        page.screenshot(path=str(SHOTS / "home-1280x800.png"), full_page=True)
        page.screenshot(path=str(SHOTS / "hero-1280x800.png"))
        overflow = page.evaluate("document.documentElement.scrollWidth - window.innerWidth")
        check("no horizontal overflow at 1280px", overflow <= 0, str(overflow))

        check_search(page)
        check_viewer(page)
        check_downloads(page)
        context.close()

        check_logo_fallback(browser)
        check_mobile(browser)
        browser.close()

    check("no console errors", not console_errors, " | ".join(console_errors[:5]))

    print()
    if failures:
        print(f"{len(failures)} check(s) failed:")
        for name in failures:
            print(f"  - {name}")
        return 1
    print("All checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
