import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Tooling, reference assets and generated output that are not part of the app.
    ".agents/**",
    ".claude/**",
    "Info/**",
    "design-system/**",
    "public/**",
    "tests/**",
  ]),
]);

export default eslintConfig;
