"""E2E checks for the institutional access gate (/acceso).

Run against the fake Supabase project started by scripts/dev-e2e.mjs:
  python .agents/skills/webapp-testing/scripts/with_server.py \
    --server "node scripts/dev-e2e.mjs" --port 3000 --timeout 180 -- python tests/e2e_auth.py

Every call to Supabase is answered by page.route mocks: no email is sent.
"""

import json
import os
import sys
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

BASE_URL = os.environ.get("BASE_URL", "http://localhost:3000")
SUPABASE = "http://supabase.e2e.test"
SCREENSHOTS = Path(__file__).parent / "screenshots"
failures: list[str] = []


def check(name: str, condition: bool, detail: str = "") -> None:
    print(("PASS " if condition else "FAIL ") + name + (f" ({detail})" if detail and not condition else ""))
    if not condition:
        failures.append(name)


def fulfill_json(route, status: int, body: dict) -> None:
    route.fulfill(status=status, content_type="application/json", body=json.dumps(body))


def check_redirects(request) -> None:
    for path in ["/", "/posters/README.txt", "/rag/index.json", "/pdfjs/standard_fonts/FoxitSans.pfb"]:
        response = request.get(BASE_URL + path, max_redirects=0)
        location = response.headers.get("location", "")
        check(f"{path} redirects to the access page", response.status in (307, 308) and "/acceso?next=" in location, f"{response.status} {location}")

    response = request.get(BASE_URL + "/Info/logo.png", max_redirects=0)
    check("logo stays public for the access page", response.status == 200, str(response.status))

    response = request.get(BASE_URL + "/acceso", max_redirects=0)
    check("access page is reachable without a session", response.status == 200, str(response.status))


def check_validation(page) -> None:
    page.goto(BASE_URL + "/acceso")
    page.wait_for_load_state("networkidle")
    name = page.get_by_label("Nombre completo")
    email = page.get_by_label("Correo institucional")
    submit = page.get_by_role("button", name="Enviar código")

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


def check_code_flow(page, otp_requests: list[dict], next_param: str = "https://evil.example/steal") -> None:
    otp_requests.clear()
    page.goto(BASE_URL + "/acceso?next=" + next_param)
    page.wait_for_load_state("networkidle")
    page.get_by_label("Nombre completo").fill("  Laura   Camila Restrepo ")
    page.get_by_label("Correo institucional").fill("Laura.Restrepo@USC.edu.co")
    page.get_by_role("button", name="Enviar código").click()

    code = page.get_by_label("Código de acceso")
    code.wait_for()
    check("code step shows the normalized email", page.get_by_text("laura.restrepo@usc.edu.co").first.is_visible())
    check("code input is focused", page.evaluate("document.activeElement?.getAttribute('autocomplete')") == "one-time-code")
    check("resend button starts in cooldown", page.get_by_role("button", name="Reenviar código en").is_disabled())
    check("one OTP request was sent", len(otp_requests) == 1, str(len(otp_requests)))
    if otp_requests:
        sent = otp_requests[0]
        check("OTP request uses the normalized email", sent.get("email") == "laura.restrepo@usc.edu.co", str(sent))
        check("OTP request carries the full name", sent.get("data", {}).get("full_name") == "Laura Camila Restrepo", str(sent))

    page.get_by_role("button", name="Verificar e ingresar").click()
    check("short code is rejected locally", page.get_by_text("El código tiene 6 dígitos.").is_visible())

    code.fill("12a34")
    check("code input keeps digits only", code.input_value() == "1234", code.input_value())

    code.fill("000000")
    page.get_by_role("button", name="Verificar e ingresar").click()
    friendly = page.get_by_text("El código no es válido o ya venció")
    try:
        friendly.wait_for(timeout=5000)
    except Exception:
        pass
    check("rejected code shows a friendly error", friendly.is_visible())

    code.fill("123456")
    with page.expect_navigation():
        page.get_by_role("button", name="Verificar e ingresar").click()
    page.wait_for_load_state("networkidle")
    host = urlparse(page.url).hostname
    check("post-login redirect never leaves the site", host == urlparse(BASE_URL).hostname, page.url)

    page.set_viewport_size({"width": 1280, "height": 800})
    page.screenshot(path=str(SCREENSHOTS / "auth-desktop.png"), full_page=True)


def install_supabase_mocks(page, otp_requests: list[dict]) -> None:
    def handle(route):
        url = route.request.url
        if "/auth/v1/otp" in url:
            otp_requests.append(route.request.post_data_json or {})
            fulfill_json(route, 200, {})
        elif "/auth/v1/verify" in url:
            body = route.request.post_data_json or {}
            if body.get("token") == "123456":
                fulfill_json(route, 200, {
                    "access_token": "e2e.token.value", "token_type": "bearer", "expires_in": 3600,
                    "expires_at": 4102444800, "refresh_token": "e2e-refresh",
                    "user": {"id": "00000000-0000-0000-0000-000000000001", "aud": "authenticated",
                             "email": "laura.restrepo@usc.edu.co", "user_metadata": {"full_name": "Laura Camila Restrepo"}},
                })
            else:
                fulfill_json(route, 403, {"code": "otp_expired", "error_code": "otp_expired", "msg": "Token has expired or is invalid"})
        elif "/rest/v1/rpc/record_access" in url:
            route.fulfill(status=204, body="")
        else:
            fulfill_json(route, 200, {})

    page.route(f"{SUPABASE}/**", handle)


def main() -> int:
    SCREENSHOTS.mkdir(exist_ok=True)
    console_errors: list[str] = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()
        # "Failed to load resource" lines are the browser logging the 403 this suite mocks on purpose.
        page.on("console", lambda msg: console_errors.append(msg.text)
                if msg.type == "error" and not msg.text.startswith("Failed to load resource") else None)
        otp_requests: list[dict] = []
        install_supabase_mocks(page, otp_requests)

        check_redirects(context.request)
        check_validation(page)
        check_code_flow(page, otp_requests)
        # Regression: browsers strip tab/newline, so "/%09/evil.com" used to become "//evil.com".
        for tricky in ["/%09/evil.example", "/%0A/evil.example", "/%5C%5Cevil.example"]:
            check_code_flow(page, otp_requests, tricky)

        response = context.request.get(BASE_URL + "/x?y=1", max_redirects=0)
        location = response.headers.get("location", "")
        check("redirect keeps the original query in next", "next=%2Fx%3Fy%3D1" in location, location)

        mobile = browser.new_context(viewport={"width": 375, "height": 812})
        mobile_page = mobile.new_page()
        mobile_page.goto(BASE_URL + "/acceso")
        mobile_page.wait_for_load_state("networkidle")
        overflow = mobile_page.evaluate("document.documentElement.scrollWidth - window.innerWidth")
        check("no horizontal overflow on mobile", overflow <= 0, str(overflow))
        mobile_page.screenshot(path=str(SCREENSHOTS / "auth-mobile.png"), full_page=True)
        browser.close()

    check("no console errors", not console_errors, "; ".join(console_errors[:3]))
    print(f"\n{len(failures)} failure(s)")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
