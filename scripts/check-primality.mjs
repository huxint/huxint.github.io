import assert from 'node:assert/strict';
import { mkdtemp, open, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const article = await readFile(
  new URL('../src/content/posts/miller-rabin/index.md', import.meta.url),
  'utf8',
);
const source = article.match(
  /~~~cpp title="miller-rabin\.cpp"\n([\s\S]*?)\n~~~/,
)?.[1];
assert.ok(
  source,
  'The article must contain its runnable miller-rabin.cpp program.',
);

const limit = 50000;
const sieve = Array(limit + 1).fill(true);
sieve[0] = sieve[1] = false;
for (let prime = 2; prime * prime <= limit; prime++) {
  if (!sieve[prime]) continue;
  for (let multiple = prime * prime; multiple <= limit; multiple += prime)
    sieve[multiple] = false;
}

const cases = sieve.map((prime, value) => [String(value), prime]);
cases.push(
  ['3215031751', false],
  ['341550071728321', false],
  ['3825123056546413051', false],
  ['9223372036854775783', true],
  ['9223372036854775807', false],
  ['18446744073709551556', false],
  ['18446744073709551557', true],
  ['18446744073709551558', false],
  ['18446744073709551615', false],
);

const directory = await mkdtemp(join(tmpdir(), 'blog-primality-'));
try {
  const sourcePath = join(directory, 'miller-rabin.cpp');
  const executable = join(directory, 'miller-rabin');
  await writeFile(sourcePath, source);
  const compile = spawnSync(
    'g++',
    ['-std=c++20', '-O2', '-Wall', '-Wextra', sourcePath, '-o', executable],
    { encoding: 'utf8' },
  );
  assert.equal(compile.status, 0, compile.error?.message ?? compile.stderr);

  const inputPath = join(directory, 'cases.txt');
  await writeFile(inputPath, cases.map(([value]) => value).join('\n') + '\n');
  const inputFile = await open(inputPath, 'r');
  let execution;
  try {
    execution = spawnSync(executable, [], {
      stdio: [inputFile.fd, 'pipe', 'pipe'],
      encoding: 'utf8',
      maxBuffer: 8 * 1024 * 1024,
      timeout: 30000,
    });
  } finally {
    await inputFile.close();
  }
  assert.equal(
    execution.status,
    0,
    execution.error?.message ?? execution.stderr,
  );
  const output = execution.stdout.trim().split('\n');
  assert.equal(
    output.length,
    cases.length,
    'Every input must receive exactly one verdict.',
  );
  cases.forEach(([value, prime], index) => {
    assert.equal(
      output[index],
      prime ? 'Prime' : 'Composite',
      `Wrong primality verdict for ${value}`,
    );
  });
  console.log(
    `Article code verified: 0…${limit} against a sieve, plus ${cases.length - sieve.length} large boundary cases.`,
  );
} finally {
  await rm(directory, { recursive: true, force: true });
}
