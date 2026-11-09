"""E2E checks for the institutional access gate (/acceso).

Run against the local fake Supabase started by scripts/dev-e2e.mjs:
  python .agents/skills/webapp-testing/scripts/with_server.py \
    --server "node scripts/dev-e2e.mjs" --port 3000 --timeout 180 -- python tests/e2e_auth.py
"""

import json
import os
import sys
import urllib.request
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

BASE_URL = os.environ.get("BASE_URL", "http://localhost:3000")
FAKE_SUPABASE = os.environ.get("FAKE_SUPABASE_URL", "http://127.0.0.1:54329")
SCREENSHOTS = Path(__file__).parent / "screenshots"
failures: list[str] = []


def check(name: str, condition: bool, detail: str = "") -> None:
    print(("PASS " if condition else "FAIL ") + name + (f" ({detail})" if detail and not condition else ""))
    if not condition:
        failures.append(name)


def fake_calls() -> list[dict]:
    with urllib.request.urlopen(FAKE_SUPABASE + "/__calls") as response:
        return json.loads(response.read())


def wait_visible(locator, timeout: int = 5000) -> bool:
    try:
        locator.wait_for(timeout=timeout)
    except Exception:
        return False
    return locator.is_visible()


def check_redirects(request) -> None:
    for path in ["/", "/posters/README.txt", "/rag/index.json", "/pdfjs/standard_fonts/FoxitSans.pfb"]:
        response = request.get(BASE_URL + path, max_redirects=0)
        location = response.headers.get("location", "")
        check(f"{path} redirects to the access page", response.status in (307, 308) and "/acceso?next=" in location, f"{response.status} {location}")

    response = request.get(BASE_URL + "/x?y=1", max_redirects=0)
    check("redirect keeps the original query in next", "next=%2Fx%3Fy%3D1" in response.headers.get("location", ""))

    response = request.get(BASE_URL + "/", max_redirects=0, headers={"Cookie": "usc_access=not-a-uuid"})
    check("a malformed access cookie is rejected", response.status in (307, 308), str(response.status))

    response = request.get(BASE_URL + "/Info/logo.png", max_redirects=0)
    check("logo stays public for the access page", response.status == 200, str(response.status))

    response = request.get(BASE_URL + "/acceso", max_redirects=0)
    check("access page is reachable without access", response.status == 200, str(response.status))


def check_api(request) -> None:
    before = len(fake_calls())
    for body, field in [
        ({"fullName": "Laura Restrepo", "email": "laura@gmail.com"}, "email"),
        ({"fullName": "Laura Restrepo", "email": "laura@usc.edu.co.evil.com"}, "email"),
        ({"fullName": "Laura", "email": "laura@usc.edu.co"}, "fullName"),
    ]:
        response = request.post(BASE_URL + "/api/access", data=body)
        payload = response.json()
        check(f"API rejects {body['email']} / {body['fullName']}", response.status == 400 and field in payload.get("errors", {}), str(payload))
        check("rejected request sets no access cookie", "usc_access" not in response.headers.get("set-cookie", ""))
    check("invalid input never reaches Supabase", len(fake_calls()) == before)

    response = request.post(BASE_URL + "/api/access", data={"fullName": "Ana Gómez", "email": "falla.servidor@usc.edu.co"})
    check("Supabase failure returns 502 without access", response.status == 502 and "usc_access" not in response.headers.get("set-cookie", ""), str(response.status))


def check_form(page) -> None:
    page.goto(BASE_URL + "/acceso")
    page.wait_for_load_state("networkidle")
    name = page.get_by_label("Nombre completo")
    email = page.get_by_label("Correo institucional")
    submit = page.get_by_role("button", name="Ingresar")

    submit.click()
    check("empty name is rejected", page.get_by_text("Escribe tu nombre completo.").is_visible())
    check("empty email is rejected", page.get_by_text("Escribe tu correo institucional.").is_visible())

    name.fill("Laura")
    email.fill("laura@usc.edu.co")
    submit.click()
    check("single-word name is rejected", page.get_by_text("Escribe tu nombre y apellido").is_visible())

    name.fill("Laura Restrepo")
    for bad in ["laura@gmail.com", "laura@usc.edu.co.evil.com", "laura@notusc.edu.co", "laura@@usc.edu.co"]:
        email.fill(bad)
        submit.click()
        check(f"{bad} is rejected", page.get_by_text("Solo se permiten correos @usc.edu.co.").is_visible())
    check("invalid email is marked aria-invalid", email.get_attribute("aria-invalid") == "true")


def enter(page, next_param: str, expected_path: str) -> None:
    page.context.clear_cookies()
    before = len(fake_calls())
    page.goto(BASE_URL + "/acceso?next=" + next_param)
    page.wait_for_load_state("networkidle")
    page.get_by_label("Nombre completo").fill("  Laura   Camila Restrepo ")
    page.get_by_label("Correo institucional").fill("Laura.Restrepo@USC.edu.co")
    with page.expect_navigation():
        page.get_by_role("button", name="Ingresar").click()
    page.wait_for_load_state("networkidle")

    parsed = urlparse(page.url)
    check(f"entry with next={next_param} stays on the site", parsed.hostname == urlparse(BASE_URL).hostname, page.url)
    check(f"entry with next={next_param} lands on {expected_path}", parsed.path == expected_path, page.url)
    calls = fake_calls()[before:]
    check("one visit registered per entry", len(calls) == 1, str(len(calls)))
    if calls:
        check("visit uses the normalized email", calls[0].get("p_email") == "laura.restrepo@usc.edu.co", str(calls[0]))
        check("visit carries the normalized full name", calls[0].get("p_full_name") == "Laura Camila Restrepo", str(calls[0]))

    cookies = {cookie["name"]: cookie for cookie in page.context.cookies()}
    check("access cookie is httpOnly", cookies.get("usc_access", {}).get("httpOnly") is True)


def check_entry_and_exit(page) -> None:
    enter(page, "https://evil.example/steal", "/")
    check("header greets the visitor", wait_visible(page.locator(".site-header__tools").get_by_text("Hola, Laura")))
    check("catalog is visible after entering", wait_visible(page.locator("#categorias .tab").first))
    page.screenshot(path=str(SCREENSHOTS / "auth-entered-desktop.png"))

    response = page.request.get(BASE_URL + "/posters/README.txt", max_redirects=0)
    check("posters are reachable with access", response.status == 200, str(response.status))
    response = page.request.get(BASE_URL + "/acceso", max_redirects=0)
    check("access page redirects home once inside", response.status in (307, 308), str(response.status))

    with page.expect_navigation():
        page.get_by_role("button", name="Salir").first.click()
    page.wait_for_load_state("networkidle")
    check("Salir returns to the access page", urlparse(page.url).path == "/acceso", page.url)
    response = page.request.get(BASE_URL + "/", max_redirects=0)
    check("access is revoked after Salir", response.status in (307, 308), str(response.status))

    # Regression: browsers strip tab/newline, so "/%09/evil.com" used to become "//evil.com".
    for tricky in ["/%09/evil.example", "/%0A/evil.example", "/%5C%5Cevil.example"]:
        enter(page, tricky, "/")
    enter(page, "%2Fposters%2FREADME.txt", "/posters/README.txt")


def main() -> int:
    SCREENSHOTS.mkdir(exist_ok=True)
    console_errors: list[str] = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

        check_redirects(context.request)
        check_api(context.request)
        check_form(page)
        page.screenshot(path=str(SCREENSHOTS / "auth-desktop.png"), full_page=True)
        check_entry_and_exit(page)

        mobile = browser.new_context(viewport={"width": 375, "height": 812})
        mobile_page = mobile.new_page()
        mobile_page.goto(BASE_URL + "/acceso")
        mobile_page.wait_for_load_state("networkidle")
        overflow = mobile_page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
        check("no horizontal overflow on mobile", overflow <= 0, str(overflow))
        mobile_page.screenshot(path=str(SCREENSHOTS / "auth-mobile.png"), full_page=True)
        browser.close()

    check("no console errors", not console_errors, "; ".join(console_errors[:3]))
    print(f"\n{len(failures)} failure(s)")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
