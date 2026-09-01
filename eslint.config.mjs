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

// Brand rule: NO em dashes (—) or en dashes (–) in user-facing text, admin or
// client. This blocks them in string literals, JSX text, and template literals
// across the app so a new one can never reach the UI again (comments are not
// matched — they never render). Dynamic DB/catalog text is normalized at
// runtime via src/lib/text/dedash.ts. Use a comma, "to" for ranges, a colon,
// parentheses, or restructure the sentence instead.
const DASH_MESSAGE =
  "No em/en dashes (— –) in user-facing text (brand rule). Use a comma, 'to' for a range, a colon, parentheses, or restructure. Dynamic text is normalized via src/lib/text/dedash.ts.";
const DASH_SELECTORS = [
  // :not([regex]) so functional regex literals (e.g. /[—–]/ in the dedash
  // sanitizer and inventory parser) are not flagged — only string literals.
  { selector: "Literal:not([regex])[value=/[—–]/]", message: DASH_MESSAGE },
  { selector: "JSXText[value=/[—–]/]", message: DASH_MESSAGE },
  { selector: "TemplateElement[value.raw=/[—–]/]", message: DASH_MESSAGE },
];

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
    // Admin + shared components: hex-literal WARN (non-blocking design-token
    // migration aid). The no-dash ERROR block below is last and also matches
    // these files, so within admin/components the enforced rule is the dash
    // block; this hex warn is superseded there but kept for intent.
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
  // No em/en dashes anywhere in user-facing text — ERROR. Placed LAST so it wins
  // for admin + components too. This is the permanent guardrail: a new dash in a
  // string, JSX, or template literal fails the build.
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": ["error", ...DASH_SELECTORS],
    },
  },
];
