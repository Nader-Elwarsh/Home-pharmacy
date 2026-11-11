import js from '@eslint/js';
import tseslint from 'typescript-eslint';

// قاعدة الفصل بين الطبقات: الواجهة لا تستورد قاعدة البيانات أو المستودعات مباشرة.
// المسار الصحيح: ui -> core/services -> core/repositories -> core/database
const forbiddenInUi = {
  patterns: [
    {
      group: ['**/core/database', '**/core/database/**', '**/core/repositories', '**/core/repositories/**'],
      message: 'الواجهة لا تصل إلى قاعدة البيانات أو المستودعات مباشرة. استخدم core/services.',
    },
  ],
};

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'dev-dist'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/app/**/*.{ts,tsx}', 'src/components/**/*.{ts,tsx}', 'src/modules/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', forbiddenInUi] },
  },
);
