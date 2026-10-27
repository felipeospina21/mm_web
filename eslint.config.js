import nextPlugin from "eslint-config-next/core-web-vitals";
import tseslint from "typescript-eslint";
// @ts-ignore -- no types for this plugin
import drizzle from "eslint-plugin-drizzle";

export default tseslint.config(
  {
    ignores: [".next", "*.config.js", "*.config.mjs", "*.config.cjs"],
  },
  // eslint-config-next 16 ships a native flat config array.
  ...nextPlugin,
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      drizzle,
    },
    extends: [
      ...tseslint.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
    ],
    rules: {
      "@typescript-eslint/array-type": "off",
      "@typescript-eslint/consistent-type-definitions": "off",
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/require-await": "off",
      // The recommendedTypeChecked preset turns this on as an error. For
      // boolean operands `||` is the correct, intended operator (`??` only
      // falls back on null/undefined) — autofixing `||`→`??` here silently
      // changes logic. Exempt booleans so the rule stops nudging toward bugs.
      "@typescript-eslint/prefer-nullish-coalescing": [
        "error",
        { ignorePrimitives: { boolean: true } },
      ],
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { attributes: false } },
      ],
      "drizzle/enforce-delete-with-where": [
        "error",
        { drizzleObjectName: ["db", "ctx.db"] },
      ],
      "drizzle/enforce-update-with-where": [
        "error",
        { drizzleObjectName: ["db", "ctx.db"] },
      ],
      // eslint-config-next 16 newly enables these React Compiler correctness
      // rules as errors. They flag pre-existing patterns in the editor
      // components; surface them as warnings (guidance) rather than blocking
      // lint/CI. Revisit and refactor these separately.
      //
      // TEMPORARY: re-upgrade `react-hooks/refs` back to "error" after the root
      // cause is fixed — see docs/editor-improvements-plan.md, Task 4.1 /
      // finding 3.7 (quotation-canvas.tsx reads ref-bundled values during
      // render). Do NOT leave as warn permanently.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/refs": "warn",
    },
  },
  {
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
  },
);
