import astro from 'eslint-plugin-astro'
import vue from 'eslint-plugin-vue'
import tsParser from '@typescript-eslint/parser'
import globals from 'globals'

export default [
  {
    ignores: [
      'dist/**',
      '.astro/**',
      '.wrangler/**',
      'node_modules/**',
      'public/**',
      'src/assets/**',
      '**/*.ts', // 类型由 npm run check（astro check）把关
    ],
  },
  ...astro.configs['flat/recommended'],
  // .astro 文件内 TS（frontmatter / <script lang='ts'>）
  {
    files: ['**/*.astro'],
    languageOptions: { parserOptions: { parser: tsParser } },
  },
  ...vue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: { parserOptions: { parser: tsParser } },
  },
  {
    files: ['**/*.astro', '**/*.vue', '**/*.js', '**/*.mjs', '**/*.cjs'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2021,
        ...globals.worker,
        Astro: 'readonly',
        PIXI: 'readonly',
      },
    },
    rules: {
      // 排版类规则交给代码风格，不在这里卡门禁
      'vue/multi-word-component-names': 'off',
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/html-self-closing': 'off',
      'vue/attributes-order': 'off',
      'vue/no-v-html': 'off',
      'astro/no-unused-css-selector': 'off',
      // 明显的遗留死代码要清，但允许吞掉首参（_）与 catch 参数
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
    },
  },
]