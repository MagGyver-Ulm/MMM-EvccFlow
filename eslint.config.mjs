import globals from "globals";
export default [{ ignores: ["node_modules/**"] }, {
  files: ["**/*.js", "**/*.cjs", "**/*.mjs"],
  languageOptions: { ecmaVersion: 2022, sourceType: "commonjs", globals: { ...globals.node, ...globals.browser, Module: "readonly", EvccFlowColors: "readonly", config: "readonly" } },
  rules: { "no-unused-vars": ["error", { argsIgnorePattern: "^_" }], "no-undef": "error", "no-unreachable": "error", "no-constant-condition": "error", "constructor-super": "error", "valid-typeof": "error" }
}, { files: ["**/*.mjs"], languageOptions: { sourceType: "module" } }];
