import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Architecture §0 rule 4: widget viewers get their content through the
  // WidgetContext (ctx) they receive, never from the site's store singletons
  // or request APIs. That is what lets them move into engine packages.
  {
    files: [
      "src/widgets/**/*.{ts,tsx}",
      "src/components/product-sections.tsx",
      "src/components/board-spec-view.tsx",
      "src/components/board-spec-media.tsx",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "@/lib/content", message: "Viewers read content via the WidgetContext (ctx); see architecture.md §3." },
            { name: "@/lib/preview", message: "Read options arrive as ctx.readOptions; see architecture.md §3." },
            { name: "next/headers", message: "Viewers must not depend on the request; the site builds the WidgetContext." },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
