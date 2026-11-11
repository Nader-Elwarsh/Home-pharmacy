// يعيد بناء المجلدات من الأسماء المسطحة: src__core__db.ts -> src/core/db.ts
import { readdirSync, mkdirSync, renameSync } from 'node:fs';
import { dirname } from 'node:path';

for (const name of readdirSync('.')) {
  if (name === 'restore.mjs') continue;
  const target = name === 'gitignore.txt' ? '.gitignore' : name.split('__').join('/');
  if (target === name) continue;
  mkdirSync(dirname(target), { recursive: true });
  renameSync(name, target);
  console.log(name, '->', target);
}
for (const d of ['sync', 'firebase', 'security', 'backup', 'notifications']) {
  mkdirSync(`src/core/${d}`, { recursive: true });
}
mkdirSync('src/utils', { recursive: true });
console.log('تم. الآن: npm install');
