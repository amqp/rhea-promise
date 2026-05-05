import js from "@eslint/js";
import tseslint from "typescript-eslint";
import jsdoc from "eslint-plugin-jsdoc";

export default tseslint.config(
  {
    ignores: ["test/**", "dist/**"],
  },
  {
    files: ["lib/**/*.ts", "examples/**/*.ts", "test/**/*.ts"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    plugins: {
      jsdoc,
    },
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        sourceType: "module",
      },
    },
    rules: {
      "jsdoc/check-alignment": "error",
      "jsdoc/check-indentation": "error",
      "@typescript-eslint/no-duplicate-enum-values": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-unsafe-declaration-merging": "warn",
    },
  },
);
