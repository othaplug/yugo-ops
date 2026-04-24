import { createRequire } from "module";

const require = createRequire(import.meta.url);
/** @type {import("eslint").Linter.Config[]} */
const nextCoreWebVitals = require("eslint-config-next/core-web-vitals");

// PR 1 (design tokens): warn on raw hex color literals inside `.tsx` files
// in the two directories we're migrating onto the token system. This does
// not block CI — it surfaces the baseline audit in editor/lint output so
// refactors in PR 2-6 can drive the count to zero.
//
// Matches:
//   "#66143D"               // plain string literal
//   "bg-[#66143D]"          // Tailwind arbitrary-value class
//   `style ${"#0A0A0B"}`    // template literal chunk
const HEX_WARN_MESSAGE =
  "Raw hex color literal. Use a design token from src/styles/tokens.css (e.g. var(--color-wine), var(--color-text-primary)) or a .t-* utility class. See /docs/design-tokens.md.";

export default [
  ...nextCoreWebVitals,
  {
    ignores: [".claude/**"],
  },
  // Brownfield: React Compiler rules are valuable but block CI until refactors; keep as warnings.
  {
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/immutability": "warn",
      "react/no-unescaped-entities": "warn",
      "react/display-name": "warn",
      "@next/next/no-html-link-for-pages": "warn",
    },
  },
  {
    files: ["src/app/admin/**/*.tsx", "src/components/**/*.tsx"],
    rules: {
      "no-restricted-syntax": [
        "warn",
        {
          selector:
            "Literal[value=/#[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?([0-9A-Fa-f]{2})?(?![0-9A-Fa-f])/]",
          message: HEX_WARN_MESSAGE,
        },
        {
          selector:
            "TemplateElement[value.raw=/#[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?([0-9A-Fa-f]{2})?(?![0-9A-Fa-f])/]",
          message: HEX_WARN_MESSAGE,
        },
      ],
    },
  },
];
