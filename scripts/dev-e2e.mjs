// Starts `next dev` against a local fake Supabase for the e2e suites.
// The fake implements `register_visit`, `set_poster_reaction` and `get_poster_reactions`
// (`POST /rest/v1/rpc/<name>`) with the same rules as the real SQL functions, so no real
// project or credentials are needed. State is in memory.
// `GET /__calls` returns the RPC payloads received, for assertions.
// `POST /__forget-visitor` with `{ "email": ... }` or `{ "visitor_id": ... }` deletes that visitor (and its
// reactions), simulating an access cookie that points to a row Supabase no longer has.
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

const FAKE_PORT = Number(process.env.FAKE_SUPABASE_PORT ?? 54329);
const INSTITUTIONAL_EMAIL = /^[a-z0-9._%+-]+@usc\.edu\.co$/;
const calls = [];
const visitorIds = new Map();
const REACTIONS = ["love", "clap", "insight", "inspire"];
const POSTER_KEY = /^eje-[0-9]+\/[a-z0-9-]+$/;
/** poster_key -> Map(visitor_id -> reaction) */
const reactionsByPoster = new Map();

function send(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(body === undefined ? "" : JSON.stringify(body));
}

function countsFor(posterKey) {
  const counts = Object.fromEntries(REACTIONS.map((reaction) => [reaction, 0]));
  for (const reaction of reactionsByPoster.get(posterKey)?.values() ?? []) counts[reaction] += 1;
  return counts;
}

function setPosterReaction(payload, res) {
  const { p_visitor_id: visitorId, p_poster_key: key, p_reaction: reaction } = payload;
  if (typeof key !== "string" || !POSTER_KEY.test(key)) {
    return send(res, 400, { code: "23514", message: "Poster no valido" });
  }
  if (reaction !== null && reaction !== undefined && !REACTIONS.includes(reaction)) {
    return send(res, 400, { code: "23514", message: "Reaccion no valida" });
  }
  if (!visitorId || ![...visitorIds.values()].includes(visitorId)) {
    return send(res, 400, { code: "23514", message: "Visitante no valido" });
  }
  const byVisitor = reactionsByPoster.get(key) ?? new Map();
  if (reaction == null) byVisitor.delete(visitorId);
  else byVisitor.set(visitorId, reaction);
  reactionsByPoster.set(key, byVisitor);
  send(res, 200, countsFor(key));
}

function getPosterReactions(payload, res) {
  const visitorId = payload.p_visitor_id ?? null;
  const known = visitorId && [...visitorIds.values()].includes(visitorId);
  const counts = {};
  const mine = {};
  for (const [key, byVisitor] of reactionsByPoster) {
    if (byVisitor.size > 0) counts[key] = countsFor(key);
    if (known && byVisitor.has(visitorId)) mine[key] = byVisitor.get(visitorId);
  }
  send(res, 200, { visitor: Boolean(known), counts, mine });
}

const fake = createServer((req, res) => {
  if (req.method === "GET" && req.url === "/__calls") return send(res, 200, calls);

  if (req.method === "POST" && req.url === "/__forget-visitor") {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      const payload = JSON.parse(raw || "{}");
      const email = String(payload.email ?? "").trim().toLowerCase();
      const id = payload.visitor_id ?? visitorIds.get(email);
      let removed = false;
      for (const [key, value] of visitorIds) {
        if (value === id) removed = visitorIds.delete(key);
      }
      for (const byVisitor of reactionsByPoster.values()) byVisitor.delete(id);
      send(res, 200, { removed });
    });
    return;
  }

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

  const rpc = req.method === "POST" ? req.url?.match(/^\/rest\/v1\/rpc\/(set_poster_reaction|get_poster_reactions)/) : null;
  if (rpc) {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      const payload = JSON.parse(raw || "{}");
      calls.push({ rpc: rpc[1], ...payload });
      if (rpc[1] === "set_poster_reaction") setPosterReaction(payload, res);
      else getPosterReactions(payload, res);
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
