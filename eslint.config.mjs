import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/coverage/**",
      "**/node_modules/**",
      "**/.venv/**",
      "**/reports/**",
      "**/playwright-report/**",
      "**/test-results/**",
      "codelift_ai_codex_master_prompt_v2_2026.md",
      "codelift_ai_curriculum_seed_v2_2026.json"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.node
      }
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          prefer: "type-imports",
          fixStyle: "inline-type-imports"
        }
      ],
      "@typescript-eslint/no-explicit-any": "error"
    }
  },
  {
    files: ["apps/web/**/*.{ts,tsx}", "packages/ui/**/*.{ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.browser
      }
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        {
          allowConstantExport: true
        }
      ]
    }
  },
  {
    files: ["**/*.config.{js,mjs,ts}", "infra/scripts/**/*.mjs", "infra/selfhost/**/*.mjs"],
    languageOptions: {
      globals: {
        ...globals.node
      }
    }
  },
  {
    files: ["infra/selfhost/mongo-*.js"],
    languageOptions: {
      sourceType: "commonjs",
      globals: {
        ...globals.node,
        db: "readonly",
        quit: "readonly",
        print: "readonly",
        sleep: "readonly",
        Mongo: "readonly"
      }
    },
    rules: { "@typescript-eslint/no-require-imports": "off" }
  }
);
