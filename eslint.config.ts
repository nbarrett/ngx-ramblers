import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";
import angular from "angular-eslint";

const sharedTypescriptRulesOff: Record<string, "off"> = {
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
};

const typeofRestrictions = [
  {
    "selector": "BinaryExpression[operator='==='][left.operator='typeof'][right.value='string']",
    "message": "Use isString() from es-toolkit/compat instead of typeof checks for better type safety."
  },
  {
    "selector": "BinaryExpression[operator='==='][left.operator='typeof'][right.value='number']",
    "message": "Use isNumber() from es-toolkit/compat instead of typeof checks for better type safety."
  },
  {
    "selector": "BinaryExpression[operator='==='][left.operator='typeof'][right.value='boolean']",
    "message": "Use isBoolean() from es-toolkit/compat instead of typeof checks for better type safety."
  },
  {
    "selector": "BinaryExpression[operator='==='][left.operator='typeof'][right.value='object']",
    "message": "Use isObject() from es-toolkit/compat instead of typeof checks for better type safety."
  },
  {
    "selector": "BinaryExpression[operator='==='][left.operator='typeof'][right.value='undefined']",
    "message": "Use isUndefined() from es-toolkit/compat instead of typeof checks. Note: prefer null over undefined for absence of value."
  },
  {
    "selector": "BinaryExpression[operator='!=='][left.operator='typeof'][right.value='string']",
    "message": "Use !isString() from es-toolkit/compat instead of typeof checks for better type safety."
  },
  {
    "selector": "BinaryExpression[operator='!=='][left.operator='typeof'][right.value='number']",
    "message": "Use !isNumber() from es-toolkit/compat instead of typeof checks for better type safety."
  },
  {
    "selector": "BinaryExpression[operator='!=='][left.operator='typeof'][right.value='boolean']",
    "message": "Use !isBoolean() from es-toolkit/compat instead of typeof checks for better type safety."
  },
  {
    "selector": "BinaryExpression[operator='!=='][left.operator='typeof'][right.value='object']",
    "message": "Use !isObject() from es-toolkit/compat instead of typeof checks for better type safety."
  },
  {
    "selector": "BinaryExpression[operator='!=='][left.operator='typeof'][right.value='undefined']",
    "message": "Use !isUndefined() from es-toolkit/compat instead of typeof checks. Note: prefer null over undefined for absence of value."
  },
  {
    "selector": "BinaryExpression[operator='=='][left.operator='typeof'][right.value='string']",
    "message": "Use isString() from es-toolkit/compat instead of typeof checks for better type safety."
  },
  {
    "selector": "BinaryExpression[operator='=='][left.operator='typeof'][right.value='number']",
    "message": "Use isNumber() from es-toolkit/compat instead of typeof checks for better type safety."
  },
  {
    "selector": "BinaryExpression[operator='=='][left.operator='typeof'][right.value='boolean']",
    "message": "Use isBoolean() from es-toolkit/compat instead of typeof checks for better type safety."
  },
  {
    "selector": "BinaryExpression[operator='=='][left.operator='typeof'][right.value='object']",
    "message": "Use isObject() from es-toolkit/compat instead of typeof checks for better type safety."
  },
  {
    "selector": "BinaryExpression[operator='=='][left.operator='typeof'][right.value='undefined']",
    "message": "Use isUndefined() from es-toolkit/compat instead of typeof checks. Note: prefer null over undefined for absence of value."
  },
  {
    "selector": "BinaryExpression[operator='!='][left.operator='typeof'][right.value='string']",
    "message": "Use !isString() from es-toolkit/compat instead of typeof checks for better type safety."
  },
  {
    "selector": "BinaryExpression[operator='!='][left.operator='typeof'][right.value='number']",
    "message": "Use !isNumber() from es-toolkit/compat instead of typeof checks for better type safety."
  },
  {
    "selector": "BinaryExpression[operator='!='][left.operator='typeof'][right.value='boolean']",
    "message": "Use !isBoolean() from es-toolkit/compat instead of typeof checks for better type safety."
  },
  {
    "selector": "BinaryExpression[operator='!='][left.operator='typeof'][right.value='object']",
    "message": "Use !isObject() from es-toolkit/compat instead of typeof checks for better type safety."
  },
  {
    "selector": "BinaryExpression[operator='!='][left.operator='typeof'][right.value='undefined']",
    "message": "Use !isUndefined() from es-toolkit/compat instead of typeof checks. Note: prefer null over undefined for absence of value."
  }
];

const sharedSyntaxRestrictions = [
  {
    "selector": "CallExpression[callee.object.name='console'][callee.property.name='log']",
    "message": "console.log is not allowed. Use Logger (frontend) or debugLog (backend) instead."
  },
  {
    "selector": "ForStatement",
    "message": "Imperative for loops are not allowed. Use declarative array operations (map, reduce, filter, etc.) instead for side-effect free code."
  },
  {
    "selector": "WhileStatement",
    "message": "Imperative while loops are not allowed. Use declarative array operations (map, reduce, filter, etc.) instead for side-effect free code."
  },
  {
    "selector": "DoWhileStatement",
    "message": "Imperative do-while loops are not allowed. Use declarative array operations (map, reduce, filter, etc.) instead for side-effect free code."
  },
  {
    "selector": "ForInStatement",
    "message": "for...in loops are not allowed. Use keys() from es-toolkit/compat with forEach/map, or declarative operations instead."
  },
  {
    "selector": "MemberExpression[object.name='Object'][property.name='keys']",
    "message": "Use keys() from es-toolkit/compat instead of Object.keys() for better type safety."
  },
  {
    "selector": "MemberExpression[object.name='Object'][property.name='values']",
    "message": "Use values() from es-toolkit/compat instead of Object.values() for better type safety."
  },
  {
    "selector": "MemberExpression[object.name='Object'][property.name='entries']",
    "message": "Use entries() from es-toolkit/compat instead of Object.entries() for better type safety."
  },
  {
    "selector": "CallExpression[callee.object.name='Array'][callee.property.name='isArray']",
    "message": "Use isArray() from es-toolkit/compat instead of Array.isArray() for consistency."
  },
  ...typeofRestrictions
];

export default defineConfig([
  {
    ignores: ["projects/ngx-ramblers/src/brevo/templates/**"],
  },
  {
    files: ["server/**/*.js"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          "selector": "Program",
          "message": "JavaScript files are not allowed in the server directory. Convert to TypeScript (.ts) instead."
        }
      ],
    },
  },
  {
    files: ["server/**/*.ts"],
    ignores: ["server/lib/shared/dates.ts"],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
    ],
    rules: {
      ...sharedTypescriptRulesOff,
      "no-inline-comments": "error",
      "no-restricted-syntax": [
        "error",
        ...sharedSyntaxRestrictions,
        {
          "selector": "NewExpression[callee.name='Date']",
          "message": "Direct use of 'new Date()' is not allowed. Use dateTimeNow() from server/lib/shared/dates.ts instead."
        },
        {
          "selector": "CallExpression[callee.object.name='DateTime'][callee.property.name='now']",
          "message": "Direct use of 'DateTime.now()' is not allowed. Use dateTimeNow() from server/lib/shared/dates.ts instead."
        }
      ],
    },
  },
  {
    files: ["projects/ngx-ramblers/**/*.ts", "!projects/ngx-ramblers/**/*.spec.ts"],
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
      ...sharedTypescriptRulesOff,
      "no-inline-comments": "error",
      "no-restricted-syntax": [
        "error",
        ...sharedSyntaxRestrictions,
        {
          "selector": "NewExpression[callee.name='Date']",
          "message": "Direct use of 'new Date()' is not allowed. Use this.dateUtils.dateTimeNow() from DateUtilsService (frontend) instead."
        }
      ],
    },
  },
  {
    files: ["**/*.spec.ts", "**/*.test.ts"],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
    ],
    rules: {
      ...sharedTypescriptRulesOff,
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
  },
  {
    files: ["**/*.html"],
    rules: {
      "@typescript-eslint/adjacent-overload-signatures": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-empty-function": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  }
]);
