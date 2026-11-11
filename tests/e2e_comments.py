"""End-to-end checks for poster comments (Playwright, headless Chromium).

Start the dev server with the fake Supabase in the background (it keeps comments in memory and applies the
same rules as the SQL: 1-500 characters, 15 s anti-spam per visitor):

    node scripts/dev-e2e.mjs > dev.log 2>&1 &
    python tests/e2e_comments.py

Set BASE_URL / FAKE_URL to test other hosts. The test visitors are deleted from the fake at the end (their
comments go with them), so the suite can be run again against the same server.
"""

import json
import os
import sys
import time
from pathlib import Path

from playwright.sync_api import Browser, BrowserContext, Locator, Page, TimeoutError as PlaywrightTimeoutError, sync_playwright

BASE_URL = os.environ.get("BASE_URL", "http://localhost:3000")
FAKE_URL = os.environ.get("FAKE_URL", "http://127.0.0.1:54329")
ROOT = Path(__file__).resolve().parent.parent
SHOTS = ROOT / "tests" / "screenshots"
CATALOG = json.loads((ROOT / "src" / "data" / "catalog.json").read_text(encoding="utf-8"))
AXIS = next(axis for axis in CATALOG["categories"] if axis["slug"] == "eje-4")
POSTERS = AXIS["posters"]
STAMP = int(time.time())

NAME_A = "Valeria Ríos Cárdenas"
NAME_B = "Andrés Felipe Mora"
EMPTY_TEXT = "Sé el primero en comentar"

failures: list[str] = []
console_errors: list[str] = []
emails: list[tuple[BrowserContext, str]] = []


def check(name: str, condition: bool, detail: str = "") -> None:
    status = "PASS" if condition else "FAIL"
    print(f"[{status}] {name}" + (f" ({detail})" if detail and not condition else ""))
    if not condition:
        failures.append(name)


def watch_console(page: Page) -> None:
    page.on("console", lambda msg: console_errors.append(f"console.{msg.type}: {msg.text}") if msg.type == "error" else None)
    page.on("pageerror", lambda err: console_errors.append(f"pageerror: {err}"))


def grant_access(context: BrowserContext, email: str, name: str) -> None:
    response = context.request.post(BASE_URL + "/api/access", data={"fullName": name, "email": email}, timeout=180000)
    if not response.ok:
        raise RuntimeError(f"Could not get access: {response.status} {response.text()}")
    emails.append((context, email))


def forget_visitor(context: BrowserContext, email: str) -> None:
    context.request.post(FAKE_URL + "/__forget-visitor", data={"email": email})


def fake_calls(context: BrowserContext, rpc: str) -> list[dict]:
    return [call for call in context.request.get(FAKE_URL + "/__calls").json() if call.get("rpc") == rpc]


def new_visitor(browser: Browser, label: str, name: str, viewport: dict | None = None, mobile: bool = False) -> tuple[BrowserContext, Page]:
    options: dict = {"viewport": viewport or {"width": 1280, "height": 900}}
    if mobile:
        options.update(is_mobile=True, has_touch=True)
    context = browser.new_context(**options)
    page = context.new_page()
    page.set_default_timeout(30000)
    watch_console(page)
    grant_access(context, f"{label}.{STAMP}@usc.edu.co", name)
    return context, page


def wait_ready(page: Page) -> None:
    """Buttons are disabled until the totals have loaded."""
    page.wait_for_function(
        "() => { const b = [...document.querySelectorAll('.poster-card .reaction')].filter(e => e.offsetParent); return b.length > 0 && b.every(e => !e.disabled); }",
        timeout=60000,
    )


def open_axis(page: Page) -> None:
    page.goto(f"{BASE_URL}/eje/{AXIS['slug']}", wait_until="domcontentloaded", timeout=180000)
    page.wait_for_selector(".poster-card:visible", timeout=60000)
    wait_ready(page)


def card_at(page: Page, index: int) -> Locator:
    return page.locator(".poster-card:visible").nth(index)


def toggle_of(scope: Locator) -> Locator:
    return scope.locator("[data-comments-toggle]")


def panel_of(scope: Locator) -> Locator:
    return scope.locator(".comments")


def toggle_count(scope: Locator) -> int:
    label = toggle_of(scope).get_attribute("aria-label") or ""
    return int(label.rsplit(",", 1)[1]) if "," in label else -1


def wait_toggle_count(scope: Locator, expected: int, timeout: float = 8000) -> bool:
    deadline = time.time() + timeout / 1000
    while time.time() < deadline:
        if toggle_count(scope) == expected:
            return True
        scope.page.wait_for_timeout(150)
    return False


def open_panel(scope: Locator) -> None:
    toggle = toggle_of(scope)
    if toggle.get_attribute("aria-expanded") != "true":
        toggle.click()
    panel_of(scope).wait_for(state="visible", timeout=10000)


def wait_loaded(scope: Locator) -> None:
    """The panel has stopped saying 'Cargando comentarios'."""
    panel = panel_of(scope)
    panel.locator(".comments__field").wait_for(state="visible", timeout=10000)
    scope.page.wait_for_function(
        "(el) => !/Cargando comentarios/.test(el.innerText)", arg=panel.element_handle(), timeout=10000
    )


def items_of(scope: Locator) -> Locator:
    return panel_of(scope).locator(".comment")


def field_of(scope: Locator) -> Locator:
    return panel_of(scope).get_by_label("Escribe un comentario")


def publish_button(scope: Locator) -> Locator:
    return panel_of(scope).get_by_role("button", name="Publicar")


def wait_items(scope: Locator, expected: int, timeout: float = 8000) -> bool:
    deadline = time.time() + timeout / 1000
    while time.time() < deadline:
        if items_of(scope).count() == expected:
            return True
        scope.page.wait_for_timeout(150)
    return False


def same_row(a: Locator, b: Locator) -> bool:
    box_a, box_b = a.bounding_box(), b.bounding_box()
    if not box_a or not box_b:
        return False
    return abs((box_a["y"] + box_a["height"] / 2) - (box_b["y"] + box_b["height"] / 2)) <= 4


def run_visitor_a(browser: Browser) -> None:
    context, page = new_visitor(browser, "comentarista.a", NAME_A)
    open_axis(page)
    card = card_at(page, 0)
    title = POSTERS[0]["title"]
    toggle, panel = toggle_of(card), panel_of(card)

    # S3/S4: the toggle sits in the same row as both reactions and the panel starts hidden.
    check("S3: the comments panel is hidden by default", not panel.is_visible())
    check("S3: aria-expanded is false at first", toggle.get_attribute("aria-expanded") == "false")
    check("S4: the card toggle is named Comentarios", "Comentarios" in (toggle.get_attribute("aria-label") or ""))
    check("S4: the toggle is in the same row as the heart and the applause", same_row(toggle, card.locator('[data-reaction="love"]')) and same_row(toggle, card.locator('[data-reaction="clap"]')))
    box = toggle.bounding_box()
    check("S4: the toggle is a 44px+ target", box is not None and box["height"] >= 44 and box["width"] >= 44, str(box))
    check("S3: the toggle starts with 0 comments", toggle_count(card) == 0)
    check("S3: card toggle shows the word Comentarios", "Comentarios" in toggle.inner_text(), toggle.inner_text())

    toggle.click()
    panel.wait_for(state="visible", timeout=10000)
    check("S3: the toggle opens the panel (aria-expanded true)", toggle.get_attribute("aria-expanded") == "true")
    check("S3: aria-controls points to the panel", toggle.get_attribute("aria-controls") == panel.get_attribute("id"))
    wait_loaded(card)
    check("empty poster: shows the invitation to comment", EMPTY_TEXT in panel.inner_text(), panel.inner_text())

    # Empty and whitespace-only text cannot be published.
    check("empty text: Publicar is disabled", publish_button(card).is_disabled())
    field_of(card).fill("   \n  ")
    check("whitespace only: Publicar is disabled", publish_button(card).is_disabled())

    # Publish with Ctrl+Enter.
    text = "Primera línea\nSegunda línea"
    field_of(card).fill(text)
    check("counter shows the length out of 500", panel.locator(".comments__counter").inner_text().strip() == f"{len(text)}/500", panel.locator(".comments__counter").inner_text())
    check("typed text enables Publicar", publish_button(card).is_enabled())
    field_of(card).press("Control+Enter")
    check("publish (Ctrl+Enter): the comment appears", wait_items(card, 1))
    first = items_of(card).first
    check("S2: the comment shows the full name used to sign in", first.locator(".comment__author").inner_text() == NAME_A, first.inner_text())
    check("S2: the comment shows its text with the line break", first.locator(".comment__body").inner_text() == text, repr(first.locator(".comment__body").inner_text()))
    check("line breaks are preserved by CSS", first.locator(".comment__body").evaluate("el => getComputedStyle(el).whiteSpace") == "pre-wrap")
    date = first.locator("time.comment__date")
    check("the relative date is shown and the full date is in the title", date.inner_text().startswith("hace") and len(date.get_attribute("title") or "") > 10, date.inner_text())
    check("publish: the toggle counter goes up", wait_toggle_count(card, 1))
    check("publish: the textarea is cleared", field_of(card).input_value() == "")
    try:
        page.get_by_role("status").filter(has_text="Comentario publicado").first.wait_for(state="attached", timeout=5000)
        announced = True
    except PlaywrightTimeoutError:
        announced = False
    check("publish: the live region announces it", announced)
    check("the e-mail is never shown", "@usc.edu.co" not in panel.inner_text())

    # Anti-spam: a second comment right away is refused with a visible message (HTTP 429 from the API).
    field_of(card).fill("Otro comentario enseguida")
    publish_button(card).click()
    alert = panel.locator(".comments__error")
    try:
        alert.first.wait_for(state="visible", timeout=8000)
    except PlaywrightTimeoutError:
        pass
    check("anti-spam: a visible message explains the wait", alert.count() >= 1 and "Espera unos segundos" in alert.first.inner_text(), alert.first.inner_text() if alert.count() else "no alert")
    check("anti-spam: nothing was added", items_of(card).count() == 1 and toggle_count(card) == 1)
    check("anti-spam: the draft is kept", field_of(card).input_value() == "Otro comentario enseguida")
    api = context.request.post(BASE_URL + "/api/comments", data={"poster": f"{AXIS['slug']}/{POSTERS[0]['slug']}", "body": "tercero"})
    check("anti-spam API: HTTP 429", api.status == 429 and api.json().get("ok") is False and "Espera unos segundos" in api.json().get("message", ""), str(api.status))
    field_of(card).fill("")
    # The browser logs the expected 429 as a console error.
    console_errors[:] = [error for error in console_errors if "429" not in error]

    get = context.request.get(BASE_URL + f"/api/comments?poster={AXIS['slug']}/{POSTERS[0]['slug']}")
    body = get.json()
    check("API: GET returns the comments without the e-mail", get.ok and len(body.get("comments", [])) == 1 and "@" not in json.dumps(body), str(body)[:200])
    check("API: GET is not cached", "no-store" in (get.headers.get("cache-control") or ""))

    # Desktop screenshots with the panel open.
    page.evaluate("() => window.scrollTo(0, 0)")
    card.scroll_into_view_if_needed()
    card.screenshot(path=str(SHOTS / "comments-card-desktop.png"))

    # It persists across reloads; the counter shows before opening the panel.
    page.reload(wait_until="domcontentloaded", timeout=120000)
    page.wait_for_selector(".poster-card:visible", timeout=60000)
    wait_ready(page)
    card = card_at(page, 0)
    check("reload: the counter is shown without opening the panel", wait_toggle_count(card, 1))
    check("reload: the panel is hidden again", not panel_of(card).is_visible())
    open_panel(card)
    wait_loaded(card)
    check("reload: the comment is still there with the author's name", items_of(card).count() == 1 and items_of(card).first.locator(".comment__author").inner_text() == NAME_A)

    # Viewer: same row, shares the same list.
    card.get_by_role("button", name=f"Ver PDF: {title}").click()
    dialog = page.locator("dialog.viewer[open]")
    dialog.wait_for(timeout=30000)
    vtoggle = toggle_of(dialog)
    check("viewer: the toggle sits with the heart and the applause", same_row(vtoggle, dialog.locator('[data-reaction="love"]')) and same_row(vtoggle, dialog.locator('[data-reaction="clap"]')))
    check("viewer: the panel is hidden by default", not panel_of(dialog).is_visible() and vtoggle.get_attribute("aria-expanded") == "false")
    check("viewer: the counter matches the card", toggle_count(dialog) == 1)
    vtoggle.click()
    panel_of(dialog).wait_for(state="visible", timeout=10000)
    wait_loaded(dialog)
    check("viewer: shows the same comment with the author's name", items_of(dialog).count() == 1 and items_of(dialog).first.locator(".comment__author").inner_text() == NAME_A)
    page.wait_for_timeout(1500)
    page.screenshot(path=str(SHOTS / "comments-viewer-desktop.png"))
    dialog.get_by_role("button", name="Cerrar visor").click()
    page.locator("dialog.viewer[open]").wait_for(state="detached", timeout=10000)
    context.close()


def run_visitor_b(browser: Browser) -> None:
    context, page = new_visitor(browser, "comentarista.b", NAME_B)
    open_axis(page)
    card = card_at(page, 0)
    check("other visitor: sees the existing count before opening", wait_toggle_count(card, 1))
    open_panel(card)
    wait_loaded(card)
    check("other visitor: sees the first comment with the first visitor's name", items_of(card).count() == 1 and items_of(card).first.locator(".comment__author").inner_text() == NAME_A)

    # Text that looks like HTML is shown literally and never executed.
    nasty = "<script>window.__pwned = 1</script><img src=x onerror=\"window.__pwned = 2\"><b>negrita</b>"
    field_of(card).fill(nasty)
    publish_button(card).click()
    check("other visitor: the new comment appears", wait_items(card, 2))
    top = items_of(card).first
    check("newest comment goes first and shows its author's own name", top.locator(".comment__author").inner_text() == NAME_B, top.inner_text())
    check("HTML in a comment is displayed literally", top.locator(".comment__body").inner_text() == nasty, top.locator(".comment__body").inner_text())
    check("HTML in a comment creates no elements", top.locator(".comment__body *").count() == 0 and panel_of(card).locator("script, img").count() == 0)
    page.wait_for_timeout(500)
    check("HTML in a comment is never executed", page.evaluate("() => window.__pwned === undefined"))
    check("the counter shows 2", wait_toggle_count(card, 2))
    page.reload(wait_until="domcontentloaded", timeout=120000)
    page.wait_for_selector(".poster-card:visible", timeout=60000)
    wait_ready(page)
    card = card_at(page, 0)
    open_panel(card)
    wait_loaded(card)
    authors = [items_of(card).nth(i).locator(".comment__author").inner_text() for i in range(items_of(card).count())]
    check("after reload the order is newest first", authors == [NAME_B, NAME_A], str(authors))
    context.close()


def run_validation(browser: Browser) -> None:
    context, page = new_visitor(browser, "validacion", "Camila Torres Ruiz")
    key = f"{AXIS['slug']}/{POSTERS[0]['slug']}"
    before = len(fake_calls(context, "add_poster_comment"))

    blank = context.request.post(BASE_URL + "/api/comments", data={"poster": key, "body": "   "})
    check("API: blank comment -> 400", blank.status == 400, str(blank.status))
    long = context.request.post(BASE_URL + "/api/comments", data={"poster": key, "body": "x" * 501})
    check("API: 501 characters -> 400", long.status == 400, str(long.status))
    not_text = context.request.post(BASE_URL + "/api/comments", data={"poster": key, "body": 42})
    check("API: non-text body -> 400", not_text.status == 400, str(not_text.status))
    unknown = context.request.post(BASE_URL + "/api/comments", data={"poster": "eje-4/no-existe", "body": "hola"})
    check("API: unknown poster -> 400", unknown.status == 400, str(unknown.status))
    traversal = context.request.post(BASE_URL + "/api/comments", data={"poster": "../../etc", "body": "hola"})
    check("API: malformed poster -> 400", traversal.status == 400, str(traversal.status))
    garbage = context.request.post(BASE_URL + "/api/comments", data="not json", headers={"Content-Type": "application/json"})
    check("API: malformed body -> 400", garbage.status == 400, str(garbage.status))
    bad_get = context.request.get(BASE_URL + "/api/comments?poster=eje-4/no-existe")
    check("API: GET unknown poster -> 400", bad_get.status == 400, str(bad_get.status))
    no_get = context.request.get(BASE_URL + "/api/comments")
    check("API: GET without poster -> 400", no_get.status == 400, str(no_get.status))
    check("API: errors are JSON and not cached", "no-store" in (long.headers.get("cache-control") or "") and long.json().get("ok") is False)

    anonymous = browser.new_context()
    post_anon = anonymous.request.post(BASE_URL + "/api/comments", data={"poster": key, "body": "hola"}, max_redirects=0)
    check("API: POST without the cookie -> 401 or redirect", post_anon.status in (401, 307, 308, 302, 303), str(post_anon.status))
    get_anon = anonymous.request.get(BASE_URL + f"/api/comments?poster={key}", max_redirects=0)
    check("API: GET without the cookie -> 401 or redirect", get_anon.status in (401, 307, 308, 302, 303), str(get_anon.status))
    forged = anonymous.request.post(BASE_URL + "/api/comments", data={"poster": key, "body": "hola"}, headers={"Cookie": "usc_access=not-a-uuid"}, max_redirects=0)
    check("API: forged cookie is rejected", forged.status in (401, 307, 308, 302, 303), str(forged.status))
    anonymous.close()
    check("API: rejected requests never reached Supabase", len(fake_calls(context, "add_poster_comment")) == before, f"{before} -> {len(fake_calls(context, 'add_poster_comment'))}")

    # The UI blocks a 501-character comment before it is sent.
    open_axis(page)
    card = card_at(page, 1)
    open_panel(card)
    wait_loaded(card)
    field_of(card).fill("y" * 501)
    check("501 characters: Publicar is disabled", publish_button(card).is_disabled())
    check("501 characters: a visible message explains the limit", "500" in panel_of(card).locator(".comments__error").first.inner_text())
    check("501 characters: the counter is marked as over", panel_of(card).locator(".comments__counter--over").count() == 1)
    field_of(card).fill("z" * 500)
    check("500 characters: Publicar is enabled", publish_button(card).is_enabled())
    check("nothing was sent by the UI", len(fake_calls(context, "add_poster_comment")) == before)
    context.close()


def run_sync(browser: Browser) -> None:
    context, page = new_visitor(browser, "sincronia", "Diego Alejandro Pardo")
    open_axis(page)
    index = 1
    card = card_at(page, index)
    title = POSTERS[index]["title"]
    open_panel(card)
    wait_loaded(card)
    check("sync: another poster starts empty", EMPTY_TEXT in panel_of(card).inner_text() and toggle_count(card) == 0)

    card.get_by_role("button", name=f"Ver PDF: {title}").click()
    dialog = page.locator("dialog.viewer[open]")
    dialog.wait_for(timeout=30000)
    open_panel(dialog)
    wait_loaded(dialog)
    field_of(dialog).fill("Comentario escrito desde el visor")
    publish_button(dialog).click()
    check("sync: the comment appears in the viewer", wait_items(dialog, 1))
    check("sync: the viewer counter goes up", wait_toggle_count(dialog, 1))
    dialog.get_by_role("button", name="Cerrar visor").click()
    page.locator("dialog.viewer[open]").wait_for(state="detached", timeout=10000)
    card = card_at(page, index)
    check("sync: the card counter followed the viewer", wait_toggle_count(card, 1))
    check("sync: the card list followed the viewer", wait_items(card, 1) and "Comentario escrito desde el visor" in items_of(card).first.inner_text())
    check("sync: the other cards are untouched", toggle_count(card_at(page, 0)) == 2)
    context.close()


def run_stale_visitor(browser: Browser) -> None:
    context, page = new_visitor(browser, "viejo", "Laura Marcela Vélez")
    errors_before = len(console_errors)
    open_axis(page)
    card = card_at(page, 2)
    open_panel(card)
    wait_loaded(card)
    email = f"viejo.{STAMP}@usc.edu.co"
    forget_visitor(context, email)
    field_of(card).fill("Mi sesión ya no existe")
    publish_button(card).click()
    notice = page.locator(".reactions-notice--expired:visible")
    try:
        notice.first.wait_for(state="visible", timeout=15000)
    except PlaywrightTimeoutError:
        pass
    check("stale visitor: the re-login notice appears", notice.count() == 1 and "Tu sesión expiró" in notice.first.inner_text(), str(notice.count()))
    check("stale visitor: the notice offers to sign in again", notice.first.get_by_role("link", name="Ingresar de nuevo").count() == 1)
    check("stale visitor: the cookies were cleared", not any(c["name"] in ("usc_access", "usc_visitor_name") for c in context.cookies()))
    check("stale visitor: nothing was added", items_of(card).count() == 0)
    context.close()

    api_context = browser.new_context()
    email = f"viejo.api.{STAMP}@usc.edu.co"
    grant_access(api_context, email, "Mateo Ortiz Ramos")
    forget_visitor(api_context, email)
    post = api_context.request.post(BASE_URL + "/api/comments", data={"poster": f"{AXIS['slug']}/{POSTERS[0]['slug']}", "body": "hola"})
    check("stale API: POST -> 401 visitor_not_found", post.status == 401 and post.json().get("code") == "visitor_not_found", str(post.status))
    check("stale API: the cookie is cleared", not any(c["name"] == "usc_access" for c in api_context.cookies()))
    api_context.close()
    del console_errors[errors_before:]  # the expected 401 is logged by the browser as a console error


def run_mobile(browser: Browser) -> None:
    context, page = new_visitor(browser, "movil", "Natalia Gómez Prieto", viewport={"width": 375, "height": 812}, mobile=True)
    open_axis(page)
    card = card_at(page, 2)
    toggle = toggle_of(card)
    check("mobile: the toggle sits with the reactions", same_row(toggle, card.locator('[data-reaction="love"]')))
    box = toggle.bounding_box()
    check("mobile: the toggle is a 44px+ target", box is not None and box["height"] >= 44 and box["width"] >= 44, str(box))
    open_panel(card)
    wait_loaded(card)
    field_of(card).fill("Comentario desde el celular con una palabra muy larga: " + "a" * 120)
    publish_button(card).click()
    check("mobile: the comment is published", wait_items(card, 1))
    overflow = page.evaluate("() => document.documentElement.scrollWidth - document.documentElement.clientWidth")
    check("mobile 375: no horizontal overflow with the panel open", overflow <= 0, str(overflow))
    card_box, panel_box = card.bounding_box(), panel_of(card).bounding_box()
    check("mobile: the panel stays inside the card", bool(card_box and panel_box and panel_box["x"] >= card_box["x"] - 1 and panel_box["x"] + panel_box["width"] <= card_box["x"] + card_box["width"] + 1))
    card.scroll_into_view_if_needed()
    card.screenshot(path=str(SHOTS / "comments-card-mobile.png"))

    card.get_by_role("button", name=f"Ver PDF: {POSTERS[2]['title']}").click()
    dialog = page.locator("dialog.viewer[open]")
    dialog.wait_for(timeout=30000)
    open_panel(dialog)
    wait_loaded(dialog)
    overflow = page.evaluate("() => document.documentElement.scrollWidth - document.documentElement.clientWidth")
    dbox = dialog.bounding_box()
    check("mobile viewer: no horizontal overflow with the panel open", overflow <= 0 and dialog.evaluate("el => el.scrollWidth <= el.clientWidth + 1"), str(overflow))
    check("mobile viewer: the dialog fits the screen", bool(dbox and dbox["width"] <= 376))
    page.wait_for_timeout(1000)
    page.screenshot(path=str(SHOTS / "comments-viewer-mobile.png"))
    context.close()


def main() -> int:
    SHOTS.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        warm = browser.new_context()
        warm.request.get(BASE_URL + "/acceso", timeout=180000)  # warm-up: first compile is slow
        warm.close()
        try:
            run_visitor_a(browser)
            run_visitor_b(browser)
            run_validation(browser)
            run_sync(browser)
            run_stale_visitor(browser)
            run_mobile(browser)
        finally:
            cleaner = browser.new_context()
            for _context, email in emails:
                forget_visitor(cleaner, email)
            cleaner.close()
        check("no console errors", not console_errors, "; ".join(console_errors[:5]))
        browser.close()

    print()
    print(f"{len(failures)} failure(s)" if failures else "All comment checks passed.")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
