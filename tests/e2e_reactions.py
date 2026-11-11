"""End-to-end checks for poster reactions (Playwright, headless Chromium).

Start the dev server with the fake Supabase in the background (it keeps reactions in memory):

    node scripts/dev-e2e.mjs > dev.log 2>&1 &
    python tests/e2e_reactions.py

Set BASE_URL / FAKE_URL to test other hosts. The fake's `GET /__calls` records every RPC payload, which
proves that invalid requests never reach Supabase.
"""

import json
import os
import re
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
KEYS = ["love", "clap"]
LABELS = {"love": "Me encanta", "clap": "Aplausos"}

failures: list[str] = []
console_errors: list[str] = []


def check(name: str, condition: bool, detail: str = "") -> None:
    status = "PASS" if condition else "FAIL"
    print(f"[{status}] {name}" + (f" ({detail})" if detail and not condition else ""))
    if not condition:
        failures.append(name)


def watch_console(page: Page) -> None:
    page.on("console", lambda msg: console_errors.append(f"console.{msg.type}: {msg.text}") if msg.type == "error" else None)
    page.on("pageerror", lambda err: console_errors.append(f"pageerror: {err}"))


def grant_access(context: BrowserContext, email: str) -> None:
    response = context.request.post(
        BASE_URL + "/api/access",
        data={"fullName": "Prueba Automatizada", "email": email},
        timeout=180000,
    )
    if not response.ok:
        raise RuntimeError(f"Could not get access: {response.status} {response.text()}")


def fake_calls(context: BrowserContext) -> list[dict]:
    return context.request.get(FAKE_URL + "/__calls").json()


def open_axis(page: Page) -> None:
    page.goto(f"{BASE_URL}/eje/{AXIS['slug']}", wait_until="domcontentloaded", timeout=180000)
    page.wait_for_selector(".poster-card:visible", timeout=60000)
    wait_ready(page)


def wait_ready(page: Page) -> None:
    """Buttons are disabled until the totals have loaded."""
    page.wait_for_function(
        "() => { const b = [...document.querySelectorAll('.poster-card .reaction')].filter(e => e.offsetParent); return b.length > 0 && b.every(e => !e.disabled); }",
        timeout=60000,
    )


def card_at(page: Page, index: int) -> Locator:
    return page.locator(".poster-card:visible").nth(index)


def reaction(scope: Locator, key: str) -> Locator:
    return scope.locator(f'.reaction[data-reaction="{key}"]')


def count_of(scope: Locator, key: str) -> int:
    match = re.search(r", (\d+) reacci", reaction(scope, key).get_attribute("aria-label") or "")
    return int(match.group(1)) if match else -1


def counts_of(scope: Locator) -> dict[str, int]:
    return {key: count_of(scope, key) for key in KEYS}


def pressed(scope: Locator, key: str) -> bool:
    return reaction(scope, key).get_attribute("aria-pressed") == "true"


def wait_count(scope: Locator, key: str, expected: int) -> bool:
    try:
        scope.page.wait_for_function(
            "([el, expected]) => { const m = /, (\\d+) reacci/.exec(el.getAttribute('aria-label') || ''); return m && Number(m[1]) === expected; }",
            arg=[reaction(scope, key).element_handle(), expected],
            timeout=8000,
        )
        return True
    except PlaywrightTimeoutError:
        return False


def settle_saved(page: Page) -> None:
    """The live region says the save finished (the optimistic count shows before this)."""
    try:
        page.get_by_role("status").filter(has_text=re.compile("Reacción (guardada|quitada)")).first.wait_for(state="attached", timeout=8000)
    except PlaywrightTimeoutError:
        pass
    page.wait_for_timeout(300)


def run_card_checks(page: Page) -> None:
    check("axis has posters", len(POSTERS) >= 2)
    cards = page.locator(".poster-card:visible")
    check("every card has exactly 2 reaction buttons plus the comments button", cards.count() == len(POSTERS) and all(
        cards.nth(i).locator(".reaction").count() == 2 and cards.nth(i).locator("[data-comments-toggle]").count() == 1 for i in range(cards.count())
    ))
    check("no insight/inspire buttons are rendered", page.locator('[data-reaction="insight"], [data-reaction="inspire"]').count() == 0)

    card = card_at(page, 0)
    title = POSTERS[0]["title"]
    group = card.get_by_role("group", name=f"Reacciones a {title}")
    check("bar is a labelled group", group.count() == 1)
    check("buttons carry label, count and title", all(
        reaction(card, k).get_attribute("title") == LABELS[k] and (reaction(card, k).get_attribute("aria-label") or "").startswith(LABELS[k] + ", ")
        for k in KEYS
    ))
    check("reaction buttons are 44px+ targets", all(
        (box := reaction(card, k).bounding_box()) is not None and box["height"] >= 44 and box["width"] >= 44 for k in KEYS
    ))
    base = counts_of(card)
    check("nothing is selected at first", not any(pressed(card, k) for k in KEYS))
    other_before = counts_of(card_at(page, 1))

    # React: +1 and pressed.
    reaction(card, "love").click()
    check("react: count +1", wait_count(card, "love", base["love"] + 1))
    check("react: pressed", pressed(card, "love"))
    settle_saved(page)
    check("react: other posters untouched", counts_of(card_at(page, 1)) == other_before)

    # Switch: old -1, new +1, only one pressed.
    reaction(card, "clap").click()
    check("switch: new count +1", wait_count(card, "clap", base["clap"] + 1))
    check("switch: old count -1", wait_count(card, "love", base["love"]))
    check("switch: only the new one is pressed", pressed(card, "clap") and not pressed(card, "love"))
    settle_saved(page)

    # Persists across reloads.
    page.reload(wait_until="domcontentloaded", timeout=120000)
    page.wait_for_selector(".poster-card:visible", timeout=60000)
    wait_ready(page)
    card = card_at(page, 0)
    check("reload: selection persists", pressed(card, "clap") and not pressed(card, "love"))
    check("reload: count persists", count_of(card, "clap") == base["clap"] + 1)

    # Tap again removes it.
    reaction(card, "clap").click()
    check("toggle off: count back", wait_count(card, "clap", base["clap"]))
    check("toggle off: not pressed", not pressed(card, "clap"))
    settle_saved(page)

    # Leave one reaction in place for the multi-visitor and viewer checks.
    reaction(card, "love").click()
    check("love saved", wait_count(card, "love", base["love"] + 1))
    settle_saved(page)


def run_second_visitor(browser: Browser, first_counts: dict[str, int]) -> None:
    context = browser.new_context(viewport={"width": 1280, "height": 900})
    page = context.new_page()
    watch_console(page)
    grant_access(context, f"otro.{int(time.time())}@usc.edu.co")  # new visitor each run, the fake keeps state
    open_axis(page)
    card = card_at(page, 0)
    check("visitor B sees the shared totals", counts_of(card) == first_counts, f"{counts_of(card)} vs {first_counts}")
    check("visitor B has no selection of their own", not any(pressed(card, k) for k in KEYS))
    reaction(card, "love").click()
    check("visitor B adds to the same total", wait_count(card, "love", first_counts["love"] + 1))
    check("visitor B selection is independent", pressed(card, "love"))
    settle_saved(page)
    context.close()


def run_viewer_checks(page: Page) -> None:
    open_axis(page)
    card = card_at(page, 0)
    title = POSTERS[0]["title"]
    card_counts = counts_of(card)
    mine_key = next((k for k in KEYS if pressed(card, k)), None)

    card.get_by_role("button", name=f"Ver PDF: {title}").click()
    dialog = page.locator("dialog.viewer[open]")
    dialog.wait_for(timeout=30000)
    bar = dialog.locator(".reactions--viewer")
    check("viewer shows the bar", bar.count() == 1 and bar.locator(".reaction").count() == 2)
    check("viewer bar is labelled with the poster", dialog.get_by_role("group", name=f"Reacciones a {title}").count() == 1)
    check("viewer bar mirrors the card counts", counts_of(bar) == card_counts, f"{counts_of(bar)} vs {card_counts}")
    check("viewer bar mirrors the card selection", mine_key is not None and pressed(bar, mine_key))
    page.wait_for_timeout(1500)  # let the open animation and the PDF render finish
    page.screenshot(path=str(SHOTS / "reactions-viewer.png"))

    # React from the viewer: the card behind it follows.
    target = "clap"
    before = count_of(bar, target)
    reaction(bar, target).click()
    check("viewer: react updates its own count", wait_count(bar, target, before + 1))
    check("viewer: switching released the previous choice", mine_key is not None and not pressed(bar, mine_key))
    settle_saved(page)
    dialog.get_by_role("button", name="Cerrar visor").click()
    page.locator("dialog.viewer[open]").wait_for(state="detached", timeout=10000)
    card = card_at(page, 0)
    check("card follows the viewer: count", count_of(card, target) == before + 1)
    check("card follows the viewer: pressed", pressed(card, target))
    # Restore the neutral state.
    reaction(card, target).click()
    check("cleanup: reaction removed", wait_count(card, target, before))
    settle_saved(page)


def run_api_checks(context: BrowserContext, anonymous: BrowserContext) -> None:
    calls_before = len(fake_calls(context))
    key = f"{AXIS['slug']}/{POSTERS[0]['slug']}"

    unknown = context.request.post(BASE_URL + "/api/reactions", data={"poster": "eje-4/no-existe", "reaction": "love"})
    check("API: unknown poster -> 400", unknown.status == 400, str(unknown.status))
    traversal = context.request.post(BASE_URL + "/api/reactions", data={"poster": "../../etc", "reaction": "love"})
    check("API: malformed poster key -> 400", traversal.status == 400, str(traversal.status))
    invalid = context.request.post(BASE_URL + "/api/reactions", data={"poster": key, "reaction": "dislike"})
    check("API: invalid reaction -> 400", invalid.status == 400, str(invalid.status))
    missing = context.request.post(BASE_URL + "/api/reactions", data={"poster": key})
    for retired in ("insight", "inspire"):
        gone = context.request.post(BASE_URL + "/api/reactions", data={"poster": key, "reaction": retired})
        check(f"API: retired reaction {retired} -> 400", gone.status == 400, str(gone.status))
    check("API: missing reaction -> 400", missing.status == 400, str(missing.status))
    garbage = context.request.post(BASE_URL + "/api/reactions", data="not json", headers={"Content-Type": "application/json"})
    check("API: malformed body -> 400", garbage.status == 400, str(garbage.status))
    check("API: errors are JSON and not cached", "no-store" in (invalid.headers.get("cache-control") or "") and invalid.json().get("ok") is False)

    post_anon = anonymous.request.post(BASE_URL + "/api/reactions", data={"poster": key, "reaction": "love"}, max_redirects=0)
    check("API: POST without the cookie -> 401 or redirect", post_anon.status in (401, 307, 308, 302, 303), str(post_anon.status))
    get_anon = anonymous.request.get(BASE_URL + "/api/reactions", max_redirects=0)
    check("API: GET without the cookie -> 401 or redirect", get_anon.status in (401, 307, 308, 302, 303), str(get_anon.status))

    forged = anonymous.request.post(
        BASE_URL + "/api/reactions",
        data={"poster": key, "reaction": "love"},
        headers={"Cookie": "usc_access=not-a-uuid"},
        max_redirects=0,
    )
    check("API: forged cookie is rejected", forged.status in (401, 307, 308, 302, 303), str(forged.status))

    check("API: rejected requests never reached Supabase", len(fake_calls(context)) == calls_before, f"{calls_before} -> {len(fake_calls(context))}")

    ok = context.request.get(BASE_URL + "/api/reactions")
    body = ok.json()
    check("API: GET returns counts and mine", ok.ok and isinstance(body.get("counts"), dict) and isinstance(body.get("mine"), dict))
    check("API: GET is not cached", "no-store" in (ok.headers.get("cache-control") or ""))
    posted = context.request.post(BASE_URL + "/api/reactions", data={"poster": key, "reaction": None})
    check("API: null reaction is accepted and returns counts", posted.ok and set(posted.json().get("counts", {})) == set(KEYS), str(posted.status))


def run_mobile_checks(browser: Browser) -> None:
    context = browser.new_context(viewport={"width": 375, "height": 812}, is_mobile=True, has_touch=True)
    page = context.new_page()
    watch_console(page)
    grant_access(context, f"movil.{int(time.time())}@usc.edu.co")
    open_axis(page)
    overflow = page.evaluate("() => document.documentElement.scrollWidth - document.documentElement.clientWidth")
    check("mobile 375: no horizontal overflow", overflow <= 0, str(overflow))
    card = card_at(page, 0)
    boxes = [reaction(card, k).bounding_box() for k in KEYS]
    check("mobile: reaction buttons stay 44px+", all(b and b["height"] >= 44 and b["width"] >= 44 for b in boxes))
    card_box = card.bounding_box()
    check("mobile: bar stays inside the card", all(b and card_box and b["x"] >= card_box["x"] - 1 and b["x"] + b["width"] <= card_box["x"] + card_box["width"] + 1 for b in boxes))
    base_love = count_of(card, "love")
    reaction(card, "love").click()
    check("mobile: tap reacts", wait_count(card, "love", base_love + 1) and pressed(card, "love"))
    settle_saved(page)
    card.scroll_into_view_if_needed()
    card.screenshot(path=str(SHOTS / "reactions-card-mobile.png"))
    page.screenshot(path=str(SHOTS / "reactions-axis-mobile.png"))
    reaction(card, "love").click()
    wait_count(card, "love", base_love)
    settle_saved(page)
    context.close()


def forget_visitor(context: BrowserContext, email: str) -> None:
    """Deletes the visitor in the fake Supabase, so the browser keeps a cookie for a row that no longer exists."""
    response = context.request.post(FAKE_URL + "/__forget-visitor", data={"email": email})
    if not response.ok:
        raise RuntimeError(f"Could not forget the visitor: {response.status}")


def run_stale_api_checks(browser: Browser) -> None:
    key = f"{AXIS['slug']}/{POSTERS[0]['slug']}"
    stamp = int(time.time())

    context = browser.new_context()
    email = f"api.viejo.{stamp}@usc.edu.co"
    grant_access(context, email)
    forget_visitor(context, email)
    post = context.request.post(BASE_URL + "/api/reactions", data={"poster": key, "reaction": "love"})
    body = post.json()
    cleared = " ".join(h["value"] for h in post.headers_array if h["name"].lower() == "set-cookie")
    check("stale API: POST -> 401 visitor_not_found", post.status == 401 and body.get("code") == "visitor_not_found", f"{post.status} {body}")
    check("stale API: both cookies are cleared", "usc_access=;" in cleared and "usc_visitor_name=;" in cleared, cleared)
    check("stale API: the cookie jar no longer has the visitor", not any(c["name"] == "usc_access" for c in context.cookies()))
    context.close()

    context = browser.new_context()
    email = f"api.viejo.get.{stamp}@usc.edu.co"
    grant_access(context, email)
    forget_visitor(context, email)
    get = context.request.get(BASE_URL + "/api/reactions")
    check("stale API: GET -> 401 visitor_not_found", get.status == 401 and get.json().get("code") == "visitor_not_found", str(get.status))
    check("stale API: GET clears the cookie", not any(c["name"] == "usc_access" for c in context.cookies()))
    context.close()

    # A valid visitor with no reactions is not mistaken for a stale one.
    context = browser.new_context()
    grant_access(context, f"api.vigente.{stamp}@usc.edu.co")
    fresh = context.request.get(BASE_URL + "/api/reactions")
    check("stale API: a known visitor still gets 200", fresh.status == 200 and fresh.json().get("ok") is True, str(fresh.status))
    check("stale API: a known visitor keeps the cookie", any(c["name"] == "usc_access" for c in context.cookies()))
    context.close()


def run_stale_visitor_flow(browser: Browser) -> None:
    context = browser.new_context(viewport={"width": 1280, "height": 900})
    page = context.new_page()
    page.set_default_timeout(30000)
    errors_before = len(console_errors)
    watch_console(page)
    email = f"viejo.{int(time.time())}@usc.edu.co"
    grant_access(context, email)
    open_axis(page)
    card = card_at(page, 0)
    base_love = count_of(card, "love")
    reaction(card, "love").click()
    check("stale flow: reaction works before the visitor disappears", wait_count(card, "love", base_love + 1))
    settle_saved(page)

    forget_visitor(context, email)
    page.reload(wait_until="domcontentloaded", timeout=120000)
    notice = page.locator(".reactions-notice--expired:visible")
    try:
        notice.first.wait_for(state="visible", timeout=30000)
    except PlaywrightTimeoutError:
        pass
    check("stale flow: a visible notice appears on load", notice.count() == 1 and "Tu sesión expiró" in notice.first.inner_text(), str(notice.count()))
    check("stale flow: the cookies were cleared", not any(c["name"] in ("usc_access", "usc_visitor_name") for c in context.cookies()))
    check("stale flow: the buttons are disabled", reaction(card_at(page, 0), "love").is_disabled())
    page.wait_for_timeout(600)  # let the entrance animation finish
    page.screenshot(path=str(SHOTS / "reactions-stale.png"))

    link = notice.first.get_by_role("link", name="Ingresar de nuevo")
    href = link.get_attribute("href") or ""
    check("stale flow: the link returns to this page after signing in", href == f"/acceso?next=%2Feje%2F{AXIS['slug']}", href)
    box = link.bounding_box()
    check("stale flow: the link is a 44px+ target", box is not None and box["height"] >= 44, str(box))
    link.click()
    page.wait_for_url("**/acceso**", timeout=60000)
    check("stale flow: the link opens the access page", "/acceso" in page.url and "next=" in page.url, page.url)

    # Sign in again (registers the visitor anew) and react: it now sticks.
    grant_access(context, email)
    open_axis(page)
    card = card_at(page, 0)
    check("stale flow: no notice after signing in again", page.locator(".reactions-notice:visible").count() == 0)
    base = count_of(card, "clap")
    reaction(card, "clap").click()
    check("stale flow: reaction works after signing in again", wait_count(card, "clap", base + 1) and pressed(card, "clap"))
    settle_saved(page)
    page.reload(wait_until="domcontentloaded", timeout=120000)
    page.wait_for_selector(".poster-card:visible", timeout=60000)
    wait_ready(page)
    card = card_at(page, 0)
    check("stale flow: the reaction persisted after a reload", pressed(card, "clap") and count_of(card, "clap") == base + 1)
    reaction(card, "clap").click()
    wait_count(card, "clap", base)
    settle_saved(page)
    del console_errors[errors_before:]  # the expected 401 is logged by the browser as a console error
    context.close()


def run_failed_save_notice(browser: Browser) -> None:
    context = browser.new_context(viewport={"width": 1280, "height": 900})
    page = context.new_page()
    page.set_default_timeout(30000)
    grant_access(context, f"falla.guardar.{int(time.time())}@usc.edu.co")
    open_axis(page)
    page.route(
        "**/api/reactions",
        lambda route: route.fulfill(status=502, content_type="application/json", body=json.dumps({"ok": False, "message": "No pudimos guardar tu reacción."}))
        if route.request.method == "POST"
        else route.continue_(),
    )
    card = card_at(page, 0)
    base = count_of(card, "love")
    reaction(card, "love").click()
    notice = card.locator(".reactions-notice--error")
    try:
        notice.wait_for(state="visible", timeout=10000)
    except PlaywrightTimeoutError:
        pass
    check("failed save: a visible message appears under the card", notice.count() == 1 and "No pudimos guardar" in notice.inner_text())
    check("failed save: the optimistic change was reverted", wait_count(card, "love", base) and not pressed(card, "love"))
    check("failed save: other cards show no message", page.locator(".reactions-notice:visible").count() == 1)
    try:
        notice.wait_for(state="detached", timeout=12000)
        gone = True
    except PlaywrightTimeoutError:
        gone = False
    check("failed save: the message goes away by itself", gone)
    context.close()


def main() -> int:
    SHOTS.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 900})
        context.request.get(BASE_URL + "/acceso", timeout=180000)  # warm-up: first compile is slow
        page = context.new_page()
        page.set_default_timeout(30000)
        watch_console(page)
        grant_access(context, "e2e@usc.edu.co")

        open_axis(page)
        run_card_checks(page)
        card = card_at(page, 0)
        card.screenshot(path=str(SHOTS / "reactions-card-desktop.png"))
        page.screenshot(path=str(SHOTS / "reactions-axis-desktop.png"))
        first_counts = counts_of(card)

        run_second_visitor(browser, first_counts)
        run_viewer_checks(page)

        anonymous = browser.new_context()
        run_api_checks(context, anonymous)
        anonymous.close()

        run_mobile_checks(browser)
        run_stale_api_checks(browser)
        run_stale_visitor_flow(browser)
        run_failed_save_notice(browser)

        check("no console errors", not console_errors, "; ".join(console_errors[:5]))
        browser.close()

    print()
    print(f"{len(failures)} failure(s)" if failures else "All reaction checks passed.")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
