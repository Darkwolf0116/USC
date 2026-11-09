// Starts `next dev` against a fake Supabase project for the auth e2e suite.
// The browser calls to it are answered by Playwright route mocks, so no real
// email is ever sent and no real credentials are needed.
import { spawn } from "node:child_process";

const child = spawn("npx", ["next", "dev", "--port", process.env.PORT ?? "3000"], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: "http://supabase.e2e.test",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_e2e_placeholder",
  },
});

const stop = () => child.kill();
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
child.on("exit", (code) => process.exit(code ?? 0));
