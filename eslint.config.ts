import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";
import angular from "angular-eslint";

export default defineConfig([
  {
    ignores: ["projects/ngx-ramblers/src/brevo/templates/**"],
  },
  {
    files: ["**/*.ts"],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
    ],
    rules: {
      "@angular-eslint/directive-selector": "off",
      "@angular-eslint/component-selector": "off",
      "@angular-eslint/no-input-rename": "off",
      "@angular-eslint/no-output-native": "off",
      "@angular-eslint/no-empty-lifecycle-method": "off",
      "@angular-eslint/use-lifecycle-interface": "off",
      "@angular-eslint/prefer-inject": "off",
      "@typescript-eslint/consistent-generic-constructors": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-inferrable-types": "off",
      "@typescript-eslint/consistent-indexed-object-style": "off",
      "@typescript-eslint/array-type": "off",
      "@typescript-eslint/consistent-type-definitions": "off",
      "@typescript-eslint/no-empty-function": "off",
      "no-case-declarations": "off",
      "no-dupe-else-if": "off",
      "no-constant-condition": "off",
      "no-empty": "off",
      "no-extra-boolean-cast": "off",
      "no-useless-escape": "off",
    },
  },
  {
    files: ["**/*.html"],
    extends: [
      angular.configs.templateRecommended,
      angular.configs.templateAccessibility,
    ],
    rules: {
      "@angular-eslint/template/alt-text": "off",
      "@angular-eslint/template/eqeqeq": "off",
      "@angular-eslint/template/click-events-have-key-events": "off",
      "@angular-eslint/template/interactive-supports-focus": "off",
      "@angular-eslint/template/label-has-associated-control": "off",
      "@angular-eslint/template/mouse-events-have-key-events": "off",
      "@angular-eslint/template/elements-content": "off",
    },
  }
]);
