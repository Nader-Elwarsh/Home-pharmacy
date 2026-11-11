import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const UI_DIRS = ['src/app', 'src/components', 'src/modules'];
const FORBIDDEN = /core\/(database|repositories)/;
const IMPORT_RE = /(?:from\s+|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

describe('فصل الطبقات', () => {
  it('الواجهة لا تستورد قاعدة البيانات أو المستودعات مباشرة', () => {
    const violations: string[] = [];
    for (const dir of UI_DIRS) {
      for (const file of walk(dir).filter((f) => /\.(ts|tsx)$/.test(f))) {
        const source = readFileSync(file, 'utf8');
        for (const match of source.matchAll(IMPORT_RE)) {
          if (FORBIDDEN.test(match[1])) violations.push(`${file} -> ${match[1]}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
