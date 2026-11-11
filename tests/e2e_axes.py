"""End-to-end checks for the home page (intro, video, axis buttons) and the axis pages (Playwright, headless Chromium).

Run with the dev server and the fake Supabase managed for you:

    python .agents/skills/webapp-testing/scripts/with_server.py \
        --server "node scripts/dev-e2e.mjs" --port 3000 --timeout 180 -- python tests/e2e_axes.py

Set BASE_URL to test another host. Playwright's Chromium cannot play H.264, so the video is checked
through its element, attributes and HTTP responses, never through playback.
"""

import json
import os
import re
import sys
import unicodedata
from pathlib import Path

from playwright.sync_api import Page, TimeoutError as PlaywrightTimeoutError, sync_playwright

BASE_URL = os.environ.get("BASE_URL", "http://localhost:3000")
ROOT = Path(__file__).resolve().parent.parent
SHOTS = ROOT / "tests" / "screenshots"
CATALOG = json.loads((ROOT / "src" / "data" / "catalog.json").read_text(encoding="utf-8"))
AXES = CATALOG["categories"]
POSTERS = [poster for axis in AXES for poster in axis["posters"]]
FORBIDDEN_TITLE = re.compile(r"_|\.pdf|^\d+[._ -]", re.IGNORECASE)

H1_TEXT = "Investigación en Fisioterapia en Acción."
LEAD_TEXT = (
    "Explora las propuestas de innovación, emprendimiento, podcasts, cartillas y pósters científicos de "
    "nuestros estudiantes. Conoce los proyectos organizados en nuestros cuatro ejes: Innovación y Tecnología, "
    "Discapacidad y Procesos, Actividad Física y Salud, y Desarrollo del Movimiento Humano."
)
SHORT_NAMES = ["Innovación y Tecnología", "Discapacidad y Procesos", "Actividad Física y Salud", "Desarrollo del Movimiento Humano"]
VIDEO_SRC = "/video/introduccion.mp4"

failures: list[str] = []
console_errors: list[str] = []


def check(name: str, condition: bool, detail: str = "") -> None:
    status = "PASS" if condition else "FAIL"
    print(f"[{status}] {name}" + (f" ({detail})" if detail and not condition else ""))
    if not condition:
        failures.append(name)


def squash(text: str) -> str:
    return " ".join(text.split())


def count_text(count: int) -> str:
    return f"{count} documento" + ("" if count == 1 else "s")


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
        timeout=180000,
    )
    if not response.ok:
        raise RuntimeError(f"Could not get access: {response.status} {response.text()}")


def settle(page: Page) -> None:
    """Wait for hydration-time network traffic to calm down, without failing on a chatty dev server."""
    try:
        page.wait_for_load_state("networkidle", timeout=8000)
    except PlaywrightTimeoutError:
        pass


def goto_home(page: Page) -> None:
    grant_access(page)
    page.goto(BASE_URL + "/", wait_until="domcontentloaded", timeout=90000)
    page.wait_for_selector(".axis-button")
    settle(page)


def goto_axis(page: Page, slug: str) -> None:
    grant_access(page)
    page.goto(f"{BASE_URL}/eje/{slug}", wait_until="domcontentloaded", timeout=90000)
    page.wait_for_selector("article.poster-card")
    settle(page)


def wait_path(page: Page, path: str) -> None:
    page.wait_for_function("(p) => location.pathname === p", arg=path)


def strip_accents(text: str) -> str:
    return re.sub(r"[̀-ͯ]", "", unicodedata.normalize("NFD", text)).lower()


def no_overflow(page: Page) -> bool:
    return page.evaluate("document.documentElement.scrollWidth - window.innerWidth") <= 0


def check_home(page: Page) -> None:
    goto_home(page)
    check("page title mentions the repository", "Repositorio de Proyectos de Aula" in page.title(), page.title())
    check("html lang is es", page.locator("html").get_attribute("lang") == "es")
    check("exactly one h1", page.locator("h1:visible").count() == 1)

    h1 = page.locator("h1:visible")
    check("home h1 is verbatim", squash(h1.inner_text()) == H1_TEXT, squash(h1.inner_text()))
    lead = page.locator(".intro__lead")
    check("home paragraph is verbatim", squash(lead.inner_text()) == LEAD_TEXT, squash(lead.inner_text()))
    lead_box = lead.bounding_box()
    check("h1 and paragraph visible above the fold at 1280x800", lead_box is not None and lead_box["y"] + lead_box["height"] <= 800, str(lead_box))
    check("home no longer renders PDF cards", page.locator("article.poster-card:visible").count() == 0)
    check("skip link target exists and is focusable", page.locator("main#contenido").get_attribute("tabindex") == "-1")

    # Video: element and attributes only (no H.264 in Playwright's Chromium).
    video = page.locator("video")
    check("one video element", video.count() == 1)
    check("video src is /video/introduccion.mp4", video.get_attribute("src") == VIDEO_SRC, str(video.get_attribute("src")))
    check("video has controls and playsinline", video.get_attribute("controls") is not None and video.get_attribute("playsinline") is not None)
    check("video does not autoplay and preloads metadata", video.get_attribute("autoplay") is None and video.get_attribute("preload") == "metadata")
    check("video has an accessible name", bool(video.get_attribute("aria-label")))
    check("video has a download fallback link", page.locator(f'video a[href="{VIDEO_SRC}"]').count() == 1)
    frame = page.locator(".intro-video__frame").bounding_box()
    check("video frame keeps a 16:9 ratio", frame is not None and abs(frame["width"] / frame["height"] - 16 / 9) < 0.02, str(frame))
    lead_bottom = lead_box["y"] + lead_box["height"] if lead_box else 0
    check("video sits below the text", frame is not None and frame["y"] >= lead_bottom)

    # Axis buttons.
    buttons = page.locator(".axis-button:visible")
    check("4 axis buttons", buttons.count() == 4)
    buttons_top = buttons.first.bounding_box()["y"]
    check("axis buttons sit below the video", frame is not None and buttons_top >= frame["y"] + frame["height"])
    for index, axis in enumerate(AXES):
        button = buttons.nth(index)
        label = squash(button.inner_text())
        check(
            f"button {index + 1} shows number, short name, full name and count",
            f"Eje {axis['number']}" in label
            and SHORT_NAMES[index] in label
            and axis["name"] in label
            and count_text(len(axis["posters"])) in label,
            label,
        )
        check(f"button {index + 1} links to /eje/{axis['slug']}", button.get_attribute("href") == f"/eje/{axis['slug']}")
        box = button.bounding_box()
        check(f"button {index + 1} is a 44px+ target", box is not None and box["height"] >= 44 and box["width"] >= 44)
    check("buttons list the 4 short names in order", [squash(t) for t in page.locator(".axis-button__name").all_inner_texts()] == SHORT_NAMES)
    check("no horizontal overflow at 1280px", no_overflow(page))
    page.screenshot(path=str(SHOTS / "home-1280x800.png"))
    page.screenshot(path=str(SHOTS / "home-full-1280.png"), full_page=True)


def check_video_http(page: Page) -> None:
    grant_access(page)
    response = page.request.get(BASE_URL + VIDEO_SRC, headers={"Range": "bytes=0-1023"}, max_redirects=0)
    check("video responds 200/206 with access", response.status in (200, 206), str(response.status))
    check("video content type is mp4", "video/mp4" in (response.headers.get("content-type") or ""), str(response.headers.get("content-type")))
    check("video range request returns bytes", len(response.body()) > 0)

    anonymous = page.context.browser.new_context()
    response = anonymous.request.get(BASE_URL + VIDEO_SRC, max_redirects=0)
    check(
        "video redirects to /acceso without access",
        response.status in (307, 308) and "/acceso" in response.headers.get("location", ""),
        str(response.status),
    )
    anonymous.close()


def check_axis_pages(page: Page) -> None:
    for index, axis in enumerate(AXES):
        goto_home(page)
        page.locator(".axis-button:visible").nth(index).click()
        wait_path(page, f"/eje/{axis['slug']}")
        page.wait_for_selector("article.poster-card")
        slug = axis["slug"]
        expected = len(axis["posters"])

        heading = squash(page.locator("h1:visible").inner_text())
        check(f"{slug}: h1 shows number and name", heading == f"Eje {axis['number']} {axis['name']}", heading)
        check(f"{slug}: document count", squash(page.locator(".axis__count").inner_text()) == count_text(expected))
        check(f"{slug}: title tag mentions the axis", f"Eje {axis['number']}" in page.title() and "Fisioterapia USC" in page.title(), page.title())
        cards = page.locator("article.poster-card:visible")
        check(f"{slug}: renders {expected} cards", cards.count() == expected, str(cards.count()))

        bad = []
        for card_index, poster in enumerate(axis["posters"]):
            card = cards.nth(card_index)
            title = card.locator(".poster-card__title").inner_text().strip()
            image = card.locator(".poster-card__preview img").bounding_box()
            title_box = card.locator(".poster-card__title").bounding_box()
            if title != poster["title"] or FORBIDDEN_TITLE.search(title):
                bad.append(f"title {poster['slug']}: {title!r}")
            elif not image or not title_box or title_box["y"] < image["y"] + image["height"] - 1:
                bad.append(f"order {poster['slug']}")
        check(f"{slug}: titles are clean, equal the catalog and sit below the preview", not bad, "; ".join(bad[:2]))
        check(f"{slug}: Ver PDF and Descargar PDF per card", page.locator("button.btn--primary:visible").filter(has_text="Ver PDF").count() == expected and page.locator("a[download]:visible").count() == expected)
        check(f"{slug}: no horizontal overflow", no_overflow(page))
        if index in (0, 3):
            page.screenshot(path=str(SHOTS / f"axis-{slug}-1280x800.png"))

    # Thumbnail decodes and declares its size.
    img = page.locator("article.poster-card img").first
    img.scroll_into_view_if_needed()
    page.wait_for_function("document.querySelector('article.poster-card img').complete && document.querySelector('article.poster-card img').naturalWidth > 0")
    check("thumbnail decodes", True)
    check("thumbnail has descriptive alt and lazy loading", (img.get_attribute("alt") or "").startswith("Vista previa de ") and img.get_attribute("loading") == "lazy")

    goto_axis(page, "eje-4")
    multi = page.locator("article.poster-card", has=page.get_by_role("heading", name="Neurodetectives", exact=True))
    check("multi-page card shows page count", "13 páginas" in multi.inner_text(), multi.inner_text())
    clamped = page.locator(".poster-card__title:visible").evaluate_all(
        "els => els.every(e => e.getBoundingClientRect().height <= 3 * parseFloat(getComputedStyle(e).lineHeight) + 2)"
    )
    check("titles clamp to 3 lines", clamped)


def check_axis_navigation(page: Page) -> None:
    goto_axis(page, "eje-2")
    breadcrumbs = page.get_by_role("navigation", name="Ruta de navegación")
    check("breadcrumbs show Inicio and the current axis", breadcrumbs.get_by_role("link", name="Inicio").is_visible() and breadcrumbs.locator('[aria-current="page"]').inner_text().strip() == "Eje 2")
    back_buttons = page.get_by_role("link", name="Volver al inicio")
    check("two 'Volver al inicio' links (top and bottom)", back_buttons.count() == 2, str(back_buttons.count()))

    nav = page.get_by_role("navigation", name="Navegación entre ejes")
    all_links = nav.locator(".axis-nav__all a")
    check("bottom nav lists the 4 axes", all_links.count() == 4)
    current = nav.locator('.axis-nav__all a[aria-current="page"]')
    check("current axis is marked in the bottom nav", current.count() == 1 and current.inner_text().strip() == "Eje 2")

    nav.get_by_role("link", name="Eje siguiente").click()
    wait_path(page, "/eje/eje-3")
    check("Eje siguiente goes to eje-3", page.locator("h1:visible").inner_text().startswith("Eje 3"))
    page.get_by_role("navigation", name="Navegación entre ejes").get_by_role("link", name="Eje anterior").click()
    wait_path(page, "/eje/eje-2")
    check("Eje anterior goes back to eje-2", True)

    goto_axis(page, "eje-1")
    first_nav = page.get_by_role("navigation", name="Navegación entre ejes")
    check("first axis has no previous link", first_nav.get_by_role("link", name="Eje anterior").count() == 0 and first_nav.get_by_text("Eje anterior").get_attribute("aria-disabled") == "true")
    goto_axis(page, "eje-4")
    last_nav = page.get_by_role("navigation", name="Navegación entre ejes")
    check("last axis has no next link", last_nav.get_by_role("link", name="Eje siguiente").count() == 0 and last_nav.get_by_text("Eje siguiente").get_attribute("aria-disabled") == "true")

    last_nav.locator(".axis-nav__all").get_by_role("link", name="Eje 1").click()
    wait_path(page, "/eje/eje-1")
    check("axis row link navigates", True)

    page.get_by_role("link", name="Volver al inicio").first.click()
    wait_path(page, "/")
    page.wait_for_selector(".axis-button")
    check("top 'Volver al inicio' returns home", True)

    goto_axis(page, "eje-3")
    page.get_by_role("link", name="Volver al inicio").last.click()
    wait_path(page, "/")
    check("bottom 'Volver al inicio' returns home", True)

    goto_axis(page, "eje-3")
    page.get_by_role("navigation", name="Ruta de navegación").get_by_role("link", name="Inicio").click()
    wait_path(page, "/")
    check("breadcrumb Inicio returns home", True)

    goto_axis(page, "eje-3")
    page.locator("a.brand").click()
    wait_path(page, "/")
    check("header logo returns home", True)

    # Header "Ejes" menu.
    page.get_by_role("button", name="Ejes", exact=True).click()
    menu = page.locator(".menu-popover")
    check("Ejes menu opens", menu.is_visible())
    links = menu.get_by_role("link")
    check("Ejes menu lists 4 axes", links.count() == 4)
    texts = [squash(t) for t in links.all_inner_texts()]
    check("menu labels are 'Eje N: name'", texts == [f"Eje {a['number']}: {a['name']}" for a in AXES], str(texts))
    page.keyboard.press("Escape")
    menu.wait_for(state="hidden")
    check("Esc closes the Ejes menu", not menu.is_visible())
    page.get_by_role("button", name="Ejes", exact=True).click()
    links.nth(2).click()
    wait_path(page, "/eje/eje-3")
    check("menu link opens the axis page", True)
    page.get_by_role("button", name="Ejes", exact=True).click()
    check("current axis is marked in the menu", menu.locator('a[aria-current="page"]').count() == 1)
    page.keyboard.press("Escape")

    page.get_by_role("contentinfo").get_by_role("link", name=re.compile("^Eje 1:")).click()
    wait_path(page, "/eje/eje-1")
    check("footer axis link opens the axis page", True)
    page.get_by_role("contentinfo").get_by_role("link", name="Inicio").click()
    wait_path(page, "/")
    check("footer Inicio link returns home", True)

    # `params` is read inside <Suspense> (instant navigation), so the not-found UI streams after a 200 shell.
    page.goto(f"{BASE_URL}/eje/eje-9", wait_until="domcontentloaded", timeout=90000)
    page.get_by_text("This page could not be found").wait_for()
    check("unknown axis shows the not-found page and no axis content", page.locator("article.poster-card:visible").count() == 0 and page.locator("h1:visible", has_text="Eje").count() == 0)
    check("unknown axis page is marked noindex", (page.locator('meta[name="robots"]').first.get_attribute("content") or "").find("noindex") >= 0)

    page.goto(f"{BASE_URL}/?categoria=eje-3", wait_until="commit", timeout=90000)
    wait_path(page, "/eje/eje-3")
    check("legacy /?categoria=eje-3 lands on the axis page", page.locator("h1:visible").inner_text().startswith("Eje 3"))
    page.goto("about:blank")
    page.goto(f"{BASE_URL}/#eje-2", wait_until="domcontentloaded", timeout=90000)
    wait_path(page, "/eje/eje-2")
    check("legacy /#eje-2 lands on the axis page", page.locator("h1:visible").inner_text().startswith("Eje 2"))


def check_files(page: Page) -> None:
    grant_access(page)
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
    card = page.locator("article.poster-card", has=page.get_by_role("heading", name=title, exact=True))
    card.scroll_into_view_if_needed()
    card.get_by_role("button", name=f"Ver PDF: {title}").click()
    page.locator("dialog.viewer[open]").wait_for()


def check_viewer(page: Page) -> None:
    axis1 = AXES[0]
    single = next(p for p in axis1["posters"] if p["pages"] == 1)
    goto_axis(page, "eje-1")
    open_viewer_for(page, single["title"])
    dialog = page.locator("dialog.viewer[open]")
    check("viewer dialog opens on an axis page", dialog.is_visible())
    check("viewer title equals card title", dialog.locator(".viewer__title").inner_text().strip().startswith(single["title"]))
    check(
        "viewer subtitle shows axis and pages",
        f"Eje {axis1['number']}: {axis1['name']}" in dialog.inner_text() and "1 página" in dialog.inner_text(),
        dialog.inner_text()[:200],
    )
    page.wait_for_selector(".react-pdf__Page canvas", timeout=45000)
    check("1-page PDF renders a canvas", page.locator(".react-pdf__Page canvas").count() >= 1)
    status = page.locator(".viewer__status").inner_text()
    check("page status 'de 1'", "de 1" in status, status)
    page.screenshot(path=str(SHOTS / "axis-viewer-1280x800.png"))
    page.keyboard.press("Escape")
    page.wait_for_selector("dialog.viewer", state="detached")
    label = page.evaluate("document.activeElement?.getAttribute('aria-label')")
    check("Esc closes the viewer and focus returns to the trigger", label == f"Ver PDF: {single['title']}", str(label))
    check("scroll lock released", not page.evaluate("document.documentElement.hasAttribute('data-scroll-locked')"))

    goto_axis(page, "eje-4")
    open_viewer_for(page, "Neurodetectives")
    page.wait_for_selector(".react-pdf__Page canvas", timeout=45000)
    status = page.locator(".viewer__status").inner_text()
    check("multi-page PDF paginates 'de 13'", "de 13" in status, status)
    page.get_by_role("button", name="Cerrar visor").click()
    page.wait_for_selector("dialog.viewer", state="detached")
    check("close button closes the viewer", True)

    card = page.locator("article.poster-card:visible").first
    card.scroll_into_view_if_needed()
    card.locator(".poster-card__preview").click()
    page.locator("dialog.viewer[open]").wait_for()
    opened = page.locator("dialog.viewer .viewer__title").inner_text().strip()
    check("thumbnail click opens the viewer", opened.startswith(AXES[3]["posters"][0]["title"]), opened)
    page.mouse.click(8, 400)
    page.wait_for_selector("dialog.viewer", state="detached")
    check("backdrop click closes the viewer", True)


def check_search(page: Page) -> None:
    expected = sum(1 for p in POSTERS if "caidas" in strip_accents(p["title"]))
    for where, opener in (("home", goto_home), ("axis page", lambda pg: goto_axis(pg, "eje-1"))):
        opener(page)
        box = page.get_by_role("searchbox", name="Buscar documentos")
        box.fill("caídas")
        page.wait_for_selector("#categorias mark")
        cards = page.locator("#categorias article.poster-card")
        check(f"search on {where} shows matching cards", cards.count() == expected and expected >= 2, f"{cards.count()} vs {expected}")
        check(f"search on {where} wraps matches in <mark>", page.locator("#categorias mark").count() >= 2)
        groups = page.locator(".results__group")
        check(f"results on {where} grouped by axis", groups.count() >= 2 and "Eje" in groups.first.locator("h2").inner_text())
        status = page.locator('[role="status"]').first.inner_text()
        check(f"live region on {where} announces the count", re.fullmatch(r"\d+ resultados?", status.strip()) is not None, status)
        if where == "home":
            page.screenshot(path=str(SHOTS / "home-search-1280x800.png"))

        box.fill("ACTIVIDAD FISICA")
        page.wait_for_function("document.querySelectorAll('#categorias mark').length > 0")
        check(f"accent- and case-insensitive axis-name search on {where}", page.locator("#categorias article.poster-card").count() >= 1)

        page.get_by_role("button", name="Borrar búsqueda").click()
        if where == "home":
            page.wait_for_selector(".axis-button")
            check("clear button restores the home content", page.locator(".axis-button:visible").count() == 4)
        else:
            page.wait_for_selector("article.poster-card")
            check("clear button restores the axis page", page.locator("h1:visible").inner_text().startswith("Eje 1") and page.locator("article.poster-card:visible").count() == len(AXES[0]["posters"]))

        box.fill("zzxqwv")
        page.get_by_role("heading", name=re.compile("No encontramos")).wait_for()
        check(f"empty state shown on {where}", True)
        page.get_by_role("button", name="Limpiar búsqueda").click()
        page.wait_for_function("document.querySelector('#categorias') === null")
        check(f"Limpiar búsqueda restores {where}", box.input_value() == "")

    # Selecting an axis from the menu while a search is active leaves search mode on the new page.
    goto_home(page)
    page.get_by_role("searchbox", name="Buscar documentos").fill("caídas")
    page.wait_for_selector("#categorias mark")
    page.get_by_role("button", name="Ejes", exact=True).click()
    page.locator(".menu-popover").get_by_role("link").nth(1).click()
    wait_path(page, "/eje/eje-2")
    page.wait_for_selector("h1")
    check("axis link during a search shows the axis page, not results", page.locator("h1:visible").inner_text().startswith("Eje 2") and page.locator("#categorias").count() == 0)


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

    check("no horizontal overflow on home at 375px", no_overflow(page))
    check("desktop Ejes menu is hidden on mobile", not page.get_by_role("button", name="Ejes", exact=True).is_visible())
    boxes = [page.locator(".axis-button:visible").nth(i).bounding_box() for i in range(4)]
    check("axis buttons stack in one column on mobile", all(b is not None for b in boxes) and len({round(b["x"]) for b in boxes}) == 1)
    frame = page.locator(".intro-video__frame").bounding_box()
    check("video frame fits the viewport", frame is not None and frame["x"] >= 0 and frame["x"] + frame["width"] <= 375)
    page.screenshot(path=str(SHOTS / "home-375x812.png"))
    page.screenshot(path=str(SHOTS / "home-full-375.png"), full_page=True)

    page.get_by_role("button", name="Abrir menú de ejes y búsqueda").click()
    drawer = page.locator("dialog.drawer[open]")
    drawer.wait_for()
    check("drawer lists 4 axes", drawer.get_by_role("link").count() == 4)
    check("drawer links point to axis pages", [l.get_attribute("href") for l in drawer.get_by_role("link").all()] == [f"/eje/{a['slug']}" for a in AXES])
    page.keyboard.press("Escape")
    page.wait_for_selector("dialog.drawer[open]", state="detached")

    page.get_by_role("button", name="Abrir menú de ejes y búsqueda").click()
    drawer.wait_for()
    drawer.get_by_role("link", name=re.compile("^Eje 3:")).click()
    wait_path(page, "/eje/eje-3")
    page.wait_for_selector("article.poster-card")
    check("drawer link opens the axis page and closes", not drawer.is_visible())
    check("no horizontal overflow on an axis page at 375px", no_overflow(page))
    title = page.locator(".poster-card__title:visible").first.bounding_box()
    image = page.locator(".poster-card__preview:visible").first.bounding_box()
    check("title below preview on mobile", title is not None and image is not None and title["y"] >= image["y"] + image["height"] - 1)
    page.screenshot(path=str(SHOTS / "axis-eje-3-375x812.png"))
    page.screenshot(path=str(SHOTS / "axis-eje-3-full-375.png"), full_page=True)

    page.get_by_role("button", name="Abrir menú de ejes y búsqueda").click()
    drawer.wait_for()
    drawer.get_by_role("searchbox").fill("caídas")
    page.keyboard.press("Enter")
    page.wait_for_selector("#categorias mark")
    check("mobile search shows grouped results", page.locator("#categorias article.poster-card").count() >= 2)
    check("no horizontal overflow with results", no_overflow(page))
    page.get_by_role("button", name="Limpiar búsqueda").last.click()
    page.wait_for_selector("article.poster-card")

    page.get_by_role("button", name=re.compile("^Ver PDF: ")).first.click()
    page.wait_for_selector(".react-pdf__Page canvas", timeout=45000)
    page.screenshot(path=str(SHOTS / "axis-viewer-375x812.png"))
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

        # Cold `next dev` compiles each route on the first request: warm them up before the checks.
        grant_access(page)
        page.goto(BASE_URL, wait_until="load", timeout=180000)
        page.goto(f"{BASE_URL}/eje/eje-1", wait_until="load", timeout=180000)

        check_home(page)
        check_video_http(page)
        check_axis_pages(page)
        check_axis_navigation(page)
        check_files(page)
        check_viewer(page)
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
