import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { zipSync } from 'fflate';

const root = resolve('dist');
const files = {};
async function collect(directory) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, item.name);
    if (item.isDirectory()) await collect(path);
    else files[relative(root, path).replaceAll('\\', '/')] = new Uint8Array(await readFile(path));
  }
}
await collect(root);
if (!files['index.html']) throw new Error('Build output is missing index.html.');
await mkdir('artifacts', { recursive: true });
const archive = zipSync(files, { level: 9 });
await writeFile('artifacts/apex-horizon-yandex.zip', archive);
console.log(
  `Created artifacts/apex-horizon-yandex.zip (${Math.round(archive.length / 1024)} KiB), with index.html at archive root.`,
);
