"""End-to-end checks for the research-axis sections and titled PDF cards (Playwright, headless Chromium).

Run with the dev server and the fake Supabase managed for you:

    python .agents/skills/webapp-testing/scripts/with_server.py \
        --server "node scripts/dev-e2e.mjs" --port 3000 --timeout 180 -- python tests/e2e_axes.py

Set BASE_URL to test another host.
"""

import json
import os
import re
import re
import sys
import unicodedata
from pathlib import Path

from playwright.sync_api import Page, sync_playwright

BASE_URL = os.environ.get("BASE_URL", "http://localhost:3000")
ROOT = Path(__file__).resolve().parent.parent
SHOTS = ROOT / "tests" / "screenshots"
CATALOG = json.loads((ROOT / "src" / "data" / "catalog.json").read_text(encoding="utf-8"))
AXES = CATALOG["categories"]
POSTERS = [poster for axis in AXES for poster in axis["posters"]]
FORBIDDEN_TITLE = re.compile(r"_|\.pdf|^\d+[._ -]", re.IGNORECASE)

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


def goto_home(page: Page, path: str = "/") -> None:
    grant_access(page)
    page.goto(BASE_URL + path, wait_until="networkidle", timeout=90000)
    page.wait_for_selector("#eje-1 article.poster-card")


def strip_accents(text: str) -> str:
    return re.sub(r"[̀-ͯ]", "", unicodedata.normalize("NFD", text)).lower()


def near_top(page: Page, selector: str) -> bool:
    top = page.evaluate(f"document.querySelector('{selector}').getBoundingClientRect().top")
    return -2 <= top <= 200


def wait_near_top(page: Page, selector: str) -> None:
    page.wait_for_function(
        f"(() => {{ const t = document.querySelector('{selector}').getBoundingClientRect().top; return t >= -2 && t <= 200; }})()"
    )


def check_sections(page: Page) -> None:
    goto_home(page)
    check("page title mentions the repository", "Repositorio de Proyectos de Aula" in page.title(), page.title())
    check("html lang is es", page.locator("html").get_attribute("lang") == "es")
    check("catalog wrapper keeps id categorias", page.locator("section#categorias").count() == 1)
    check(
        "wrapper heading shows axes and total",
        page.locator("#catalog-title").inner_text().strip() == "Ejes de investigación"
        and f"{len(AXES)} ejes y {len(POSTERS)} documentos" in page.locator(".catalog__intro").inner_text(),
    )

    cta = page.get_by_role("link", name="Explorar los ejes")
    box = cta.bounding_box()
    check("hero CTA visible at 1280x800", box is not None and box["y"] + box["height"] <= 800, str(box))
    check("hero CTA targets #categorias", cta.get_attribute("href") == "#categorias")

    ids = page.eval_on_selector_all("#categorias .axis", "els => els.map(e => e.id)")
    check("4 sections eje-1..eje-4 in order", ids == [a["slug"] for a in AXES] == ["eje-1", "eje-2", "eje-3", "eje-4"], str(ids))
    check("no tabs remain", page.get_by_role("tab").count() == 0)

    for axis in AXES:
        section = page.locator(f"section#{axis['slug']}")
        heading = section.locator("h2").inner_text()
        count_text = section.locator(".axis__count").inner_text().strip()
        expected = len(axis["posters"])
        expected_text = f"{expected} documento" + ("" if expected == 1 else "s")
        check(
            f"{axis['slug']} heading and count",
            f"Eje {axis['number']}" in heading and axis["name"] in heading and count_text == expected_text,
            f"{heading!r} / {count_text!r}",
        )
        labelled = section.get_attribute("aria-labelledby")
        check(f"{axis['slug']} is labelled by its heading", labelled is not None and page.locator(f"#{labelled}").count() == 1)
        cards = section.locator("article.poster-card")
        check(f"{axis['slug']} renders {expected} cards", cards.count() == expected, str(cards.count()))


def check_cards(page: Page) -> None:
    goto_home(page)
    matched = 0
    for axis in AXES:
        cards = page.locator(f"section#{axis['slug']} article.poster-card")
        for index, poster in enumerate(axis["posters"]):
            card = cards.nth(index)
            title = card.locator(".poster-card__title").inner_text().strip()
            if title != poster["title"]:
                check(f"card title equals catalog title ({poster['slug']})", False, f"{title!r} != {poster['title']!r}")
                continue
            if FORBIDDEN_TITLE.search(title):
                check(f"title has no artefacts ({poster['slug']})", False, title)
                continue
            image = card.locator(".poster-card__preview img").bounding_box()
            title_box = card.locator(".poster-card__title").bounding_box()
            if not image or not title_box or title_box["y"] < image["y"] + image["height"] - 1:
                check(f"title is below the preview ({poster['slug']})", False, f"{image} {title_box}")
                continue
            matched += 1
    check(f"all {len(POSTERS)} titles equal the catalog, are clean and sit below their preview", matched == len(POSTERS), str(matched))

    first = page.locator("#eje-1 article.poster-card").first
    img = first.locator("img")
    check("thumbnail has descriptive alt", (img.get_attribute("alt") or "").startswith("Vista previa de "))
    check(
        "thumbnail declares width and height (no layout shift)",
        img.get_attribute("width") == str(POSTERS[0]["thumbnailWidth"]) and img.get_attribute("height") == str(POSTERS[0]["thumbnailHeight"]),
    )
    check("thumbnail is lazy", img.get_attribute("loading") == "lazy")
    img.scroll_into_view_if_needed()
    page.wait_for_function("document.querySelector('#eje-1 img').complete && document.querySelector('#eje-1 img').naturalWidth > 0")
    check("thumbnail decodes", True)

    check("Ver PDF button per card", page.locator("#categorias article.poster-card button.btn--primary").count() == len(POSTERS))
    labels = page.locator("#categorias a[download]").evaluate_all("els => els.map(e => e.getAttribute('aria-label'))")
    check("download link per card with title in label", len(labels) == len(POSTERS) and all(label.startswith("Descargar PDF: ") for label in labels))

    multi = page.locator("#eje-4 article.poster-card", has=page.get_by_role("heading", name="Neurodetectives", exact=True))
    check("multi-page card shows page count", "13 páginas" in multi.inner_text(), multi.inner_text())
    check("single-page card hides page count", page.locator("#eje-1 .poster-card__pages").count() < len(AXES[0]["posters"]))

    clamped = page.locator(".poster-card__title").evaluate_all(
        "els => els.every(e => e.getBoundingClientRect().height <= 3 * parseFloat(getComputedStyle(e).lineHeight) + 2)"
    )
    check("titles clamp to 3 lines", clamped)

    page.locator("#eje-1").scroll_into_view_if_needed()
    page.screenshot(path=str(SHOTS / "axes-eje1-1280x800.png"))
    page.goto(BASE_URL, wait_until="networkidle")
    page.screenshot(path=str(SHOTS / "axes-home-1280x800.png"), full_page=True)
    overflow = page.evaluate("document.documentElement.scrollWidth - window.innerWidth")
    check("no horizontal overflow at 1280px", overflow <= 0, str(overflow))


def check_files(page: Page) -> None:
    goto_home(page)
    bad = []
    for poster in POSTERS:
        for key, kind in (("pdf", "pdf"), ("thumbnail", "image")):
            response = page.request.get(BASE_URL + poster[key], max_redirects=0)
            if response.status != 200 or kind not in (response.headers.get("content-type") or ""):
                bad.append(f"{poster[key]} -> {response.status}")
    check(f"all {len(POSTERS)} PDFs and thumbnails return 200 with access", not bad, "; ".join(bad[:3]))

    anonymous = page.context.browser.new_context()
    for path in (POSTERS[0]["pdf"], POSTERS[0]["thumbnail"]):
        response = anonymous.request.get(BASE_URL + path, max_redirects=0)
        check(
            f"{path} redirects without access",
            response.status in (307, 308) and "/acceso" in response.headers.get("location", ""),
            str(response.status),
        )
    anonymous.close()


def open_viewer_for(page: Page, title: str) -> None:
    card = page.locator("#categorias article.poster-card", has=page.get_by_role("heading", name=title, exact=True))
    card.scroll_into_view_if_needed()
    card.get_by_role("button", name=f"Ver PDF: {title}").click()
    page.locator("dialog.viewer[open]").wait_for()


def check_viewer(page: Page) -> None:
    goto_home(page)
    single = next(p for p in POSTERS if p["pages"] == 1)
    open_viewer_for(page, single["title"])
    dialog = page.locator("dialog.viewer[open]")
    check("viewer dialog opens", dialog.is_visible())
    check("viewer title equals card title", dialog.locator(".viewer__title").inner_text().strip().startswith(single["title"]))
    axis = next(a for a in AXES if single in a["posters"])
    check(
        "viewer subtitle shows axis and pages",
        f"Eje {axis['number']}: {axis['name']}" in dialog.inner_text() and "1 página" in dialog.inner_text(),
        dialog.inner_text()[:200],
    )
    page.wait_for_selector(".react-pdf__Page canvas", timeout=45000)
    check("1-page PDF renders a canvas", page.locator(".react-pdf__Page canvas").count() >= 1)
    status = page.locator(".viewer__status").inner_text()
    check("page status 'de 1'", "de 1" in status, status)
    page.screenshot(path=str(SHOTS / "axes-viewer-1280x800.png"))
    page.keyboard.press("Escape")
    page.wait_for_selector("dialog.viewer", state="detached")
    label = page.evaluate("document.activeElement?.getAttribute('aria-label')")
    check("Esc closes the viewer and focus returns to the trigger", label == f"Ver PDF: {single['title']}", str(label))
    check("scroll lock released", not page.evaluate("document.documentElement.hasAttribute('data-scroll-locked')"))

    open_viewer_for(page, "Neurodetectives")
    page.wait_for_selector(".react-pdf__Page canvas", timeout=45000)
    status = page.locator(".viewer__status").inner_text()
    check("multi-page PDF paginates 'de 13'", "de 13" in status, status)
    check("multi-page PDF renders a canvas", page.locator(".react-pdf__Page canvas").count() >= 1)
    page.get_by_role("button", name="Cerrar visor").click()
    page.wait_for_selector("dialog.viewer", state="detached")
    check("close button closes the viewer", True)

    # Clicking the thumbnail opens the viewer too.
    card = page.locator("#eje-2 article.poster-card").first
    card.scroll_into_view_if_needed()
    card.locator(".poster-card__preview").click()
    page.locator("dialog.viewer[open]").wait_for()
    opened = page.locator("dialog.viewer .viewer__title").inner_text().strip()
    check("thumbnail click opens the viewer", opened.startswith(AXES[1]["posters"][0]["title"]), opened)
    page.mouse.click(8, 400)
    page.wait_for_selector("dialog.viewer", state="detached")
    check("backdrop click closes the viewer", True)


def check_navigation(page: Page) -> None:
    goto_home(page)
    page.get_by_role("button", name="Ejes", exact=True).click()
    menu = page.locator(".menu-popover")
    check("Ejes menu opens", menu.is_visible())
    links = menu.get_by_role("link")
    check("Ejes menu lists 4 axes", links.count() == 4)
    texts = [" ".join(t.split()) for t in links.all_inner_texts()]
    check("menu labels are 'Eje N: name'", texts == [f"Eje {a['number']}: {a['name']}" for a in AXES], str(texts))
    page.keyboard.press("Escape")
    menu.wait_for(state="hidden")
    check("Esc closes the Ejes menu", not menu.is_visible())

    page.get_by_role("button", name="Ejes", exact=True).click()
    links.nth(2).click()
    menu.wait_for(state="hidden")
    wait_near_top(page, "#eje-3")
    check("menu link scrolls to #eje-3", near_top(page, "#eje-3") and page.url.endswith("#eje-3"), page.url)

    page.get_by_role("contentinfo").get_by_role("link", name=re.compile("^Eje 1:")).click()
    wait_near_top(page, "#eje-1")
    check("footer link scrolls to #eje-1", near_top(page, "#eje-1"))

    page.goto(f"{BASE_URL}/?categoria=eje-4", wait_until="networkidle", timeout=90000)
    wait_near_top(page, "#eje-4")
    check("deep link ?categoria=eje-4 scrolls to the axis", near_top(page, "#eje-4"))

    page.goto(f"{BASE_URL}/#eje-2", wait_until="networkidle", timeout=90000)
    wait_near_top(page, "#eje-2")
    check("deep link #eje-2 scrolls to the axis", near_top(page, "#eje-2"))


def check_search(page: Page) -> None:
    goto_home(page)
    box = page.get_by_role("searchbox", name="Buscar documentos")
    box.fill("caídas")
    page.wait_for_selector("#categorias mark")
    cards = page.locator("#categorias article.poster-card")
    expected = sum(1 for p in POSTERS if "caidas" in strip_accents(p["title"]))
    check("search 'caídas' shows matching cards", cards.count() == expected and expected >= 2, f"{cards.count()} vs {expected}")
    check("search wraps matches in <mark>", page.locator("#categorias mark").count() >= 2)
    check("axis sections are hidden while searching", page.locator("#categorias .axis").count() == 0)
    groups = page.locator(".results__group")
    check("results grouped by axis", groups.count() >= 2 and "Eje" in groups.first.locator("h2").inner_text())
    status = page.locator('#categorias [role="status"]').inner_text()
    check("live region announces the count", re.fullmatch(r"\d+ resultados?", status.strip()) is not None, status)
    page.screenshot(path=str(SHOTS / "axes-search-1280x800.png"))

    box.fill("ACTIVIDAD FISICA")
    page.wait_for_function("document.querySelectorAll('#categorias mark').length > 0")
    check("accent- and case-insensitive axis-name search", page.locator("#categorias article.poster-card").count() >= 1)

    page.get_by_role("button", name="Borrar búsqueda").click()
    page.wait_for_selector("#eje-1 article.poster-card")
    check("clear button restores the 4 sections", page.locator("#categorias .axis").count() == 4)

    box.fill("zzxqwv")
    page.get_by_role("heading", name=re.compile("No encontramos")).wait_for()
    check("empty state shown", True)
    page.get_by_role("button", name="Limpiar búsqueda").click()
    page.wait_for_selector("#eje-1 article.poster-card")
    check("Limpiar búsqueda restores the sections", page.locator("#categorias .axis").count() == 4 and box.input_value() == "")


def check_logo_fallback(browser) -> None:
    context = browser.new_context(viewport={"width": 1280, "height": 800})
    page = context.new_page()
    page.route("**/Info/logo.png", lambda route: route.fulfill(status=404, body="not found"))
    grant_access(page)
    page.goto(BASE_URL, wait_until="networkidle", timeout=90000)
    page.wait_for_selector('[data-fallback="true"]')
    check("logo fallback monogram renders when logo.png is 404", page.locator('[data-fallback="true"]').count() >= 1)
    check("fallback tile shows USC", "USC" in page.locator('[data-fallback="true"]').first.inner_text())
    context.close()


def check_mobile(browser) -> None:
    context = browser.new_context(
        viewport={"width": 375, "height": 812}, is_mobile=True, has_touch=True, device_scale_factor=2
    )
    context.set_default_timeout(45000)
    page = context.new_page()
    watch_console(page, console_errors)
    goto_home(page)

    overflow = page.evaluate("document.documentElement.scrollWidth - window.innerWidth")
    check("no horizontal overflow at 375px", overflow <= 0, str(overflow))
    check("desktop Ejes menu is hidden on mobile", not page.get_by_role("button", name="Ejes", exact=True).is_visible())

    page.get_by_role("button", name="Abrir menú de ejes y búsqueda").click()
    drawer = page.locator("dialog.drawer[open]")
    drawer.wait_for()
    check("drawer lists 4 axes", drawer.get_by_role("link").count() == 4)
    page.keyboard.press("Escape")
    page.wait_for_selector("dialog.drawer[open]", state="detached")

    page.get_by_role("button", name="Abrir menú de ejes y búsqueda").click()
    drawer.wait_for()
    drawer.get_by_role("link", name=re.compile("^Eje 3:")).click()
    wait_near_top(page, "#eje-3")
    check("drawer link scrolls to the axis and closes", near_top(page, "#eje-3") and not drawer.is_visible())

    page.get_by_role("button", name="Abrir menú de ejes y búsqueda").click()
    drawer.wait_for()
    drawer.get_by_role("searchbox").fill("caídas")
    page.keyboard.press("Enter")
    page.wait_for_selector("#categorias mark")
    check("mobile search shows grouped results", page.locator("#categorias article.poster-card").count() >= 2)
    overflow = page.evaluate("document.documentElement.scrollWidth - window.innerWidth")
    check("no horizontal overflow with results", overflow <= 0, str(overflow))
    page.get_by_role("button", name="Limpiar búsqueda").last.click()
    page.wait_for_selector("#eje-1 article.poster-card")

    page.goto(BASE_URL, wait_until="networkidle")
    page.wait_for_selector("#eje-1 article.poster-card")
    page.locator("#eje-1").scroll_into_view_if_needed()
    page.screenshot(path=str(SHOTS / "axes-eje1-375x812.png"))
    page.screenshot(path=str(SHOTS / "axes-home-375x812.png"), full_page=True)
    title = page.locator("#eje-1 .poster-card__title").first.bounding_box()
    image = page.locator("#eje-1 .poster-card__preview").first.bounding_box()
    check("title below preview on mobile", title is not None and image is not None and title["y"] >= image["y"] + image["height"] - 1)

    page.get_by_role("button", name=re.compile("^Ver PDF: ")).first.click()
    page.wait_for_selector(".react-pdf__Page canvas", timeout=45000)
    page.screenshot(path=str(SHOTS / "axes-viewer-375x812.png"))
    page.get_by_role("button", name="Cerrar visor").click()
    page.wait_for_selector("dialog.viewer", state="detached")
    context.close()


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    SHOTS.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        context = browser.new_context(viewport={"width": 1280, "height": 800})
        context.set_default_timeout(45000)
        page = context.new_page()
        watch_console(page, console_errors)

        # Cold `next dev` compiles the page on the first request: warm it up before the checks.
        grant_access(page)
        page.goto(BASE_URL, wait_until="load", timeout=180000)

        check_sections(page)
        check_cards(page)
        check_files(page)
        check_viewer(page)
        check_navigation(page)
        check_search(page)
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
