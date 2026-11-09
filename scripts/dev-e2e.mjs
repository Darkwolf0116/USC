// Starts `next dev` against a local fake Supabase for the e2e suites.
// The fake only implements `POST /rest/v1/rpc/register_visit` with the same
// rules as the real SQL function, so no real project or credentials are needed.
// `GET /__calls` returns the RPC payloads received, for assertions.
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

const FAKE_PORT = Number(process.env.FAKE_SUPABASE_PORT ?? 54329);
const INSTITUTIONAL_EMAIL = /^[a-z0-9._%+-]+@usc\.edu\.co$/;
const calls = [];
const visitorIds = new Map();

function send(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(body === undefined ? "" : JSON.stringify(body));
}

const fake = createServer((req, res) => {
  if (req.method === "GET" && req.url === "/__calls") return send(res, 200, calls);

  if (req.method === "POST" && req.url?.startsWith("/rest/v1/rpc/register_visit")) {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      const payload = JSON.parse(raw || "{}");
      calls.push(payload);
      const email = String(payload.p_email ?? "").trim().toLowerCase();
      const name = String(payload.p_full_name ?? "").trim();
      if (!INSTITUTIONAL_EMAIL.test(email)) {
        return send(res, 400, { code: "23514", message: "Solo se permiten correos @usc.edu.co" });
      }
      if (name.length < 3 || !name.includes(" ")) {
        return send(res, 400, { code: "23514", message: "Nombre completo no valido" });
      }
      if (email === "falla.servidor@usc.edu.co") {
        return send(res, 500, { code: "XX000", message: "simulated outage" });
      }
      if (!visitorIds.has(email)) visitorIds.set(email, randomUUID());
      send(res, 200, visitorIds.get(email));
    });
    return;
  }

  send(res, 404, { message: "not implemented in fake" });
});

fake.listen(FAKE_PORT, "127.0.0.1", () => {
  const child = spawn("npx", ["next", "dev", "--port", process.env.PORT ?? "3000"], {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${FAKE_PORT}`,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_e2e_placeholder",
    },
  });

  const stop = () => {
    child.kill();
    fake.close();
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  child.on("exit", (code) => {
    fake.close();
    process.exit(code ?? 0);
  });
});
