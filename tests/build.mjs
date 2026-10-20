import { execFileSync } from 'node:child_process';
import { cp, mkdir, rm, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const site = join(root, '.test-site');

await rm(site, { recursive: true, force: true });
await mkdir(site);
await cp(join(root, 'src'), join(site, 'src'), {
  recursive: true,
  filter: (source) => source !== join(root, 'src/content'),
});
await cp(join(root, 'tests/fixtures/content'), join(site, 'src/content'), {
  recursive: true,
});
for (const path of [
  'astro.config.mjs',
  'package.json',
  'tsconfig.json',
  'public',
]) {
  await cp(join(root, path), join(site, path), { recursive: true });
}
await symlink(join(root, 'node_modules'), join(site, 'node_modules'), 'dir');
execFileSync('pnpm', ['build'], { cwd: site, stdio: 'inherit' });
