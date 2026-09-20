// Index only published posts; an empty blog still builds and searches cleanly.
import { rm, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { globSync } from 'node:fs';

const site = 'dist';
const output = `${site}/pagefind`;
await rm(output, { recursive: true, force: true });

const posts = globSync(`${site}/posts/*/index.html`);
if (posts.length === 0) {
  // Pagefind fails on an empty corpus; ship a stub that returns nothing.
  await mkdir(output, { recursive: true });
  await writeFile(
    `${output}/pagefind.js`,
    'export async function search() { return { results: [] }; }\n',
  );
  console.log('[search] no published posts; wrote empty index stub');
  process.exit(0);
}

const result = spawnSync(
  'pnpm',
  ['exec', 'pagefind', '--site', site, '--glob', 'posts/*/index.html'],
  { stdio: 'inherit' },
);
if (result.error) {
  console.error('[search] failed to run pagefind:', result.error);
  process.exit(1);
}
if (!existsSync(`${output}/pagefind.js`)) {
  console.error('[search] pagefind did not produce an index');
  process.exit(1);
}
process.exit(result.status ?? 1);
