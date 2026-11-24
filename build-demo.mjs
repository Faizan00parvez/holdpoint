import { mkdir, readFile, writeFile } from 'node:fs/promises';

const here = name => new URL(name, import.meta.url);
const evidence = JSON.parse(await readFile(here('evidence/run.json'), 'utf8'));
const template = await readFile(here('demo.template.html'), 'utf8');
const replay = template.replace('/* RUN_DATA */', () =>
  JSON.stringify(evidence).replaceAll('<', '\\u003c'));

await mkdir(here('docs/'), { recursive: true });
await Promise.all([
  writeFile(here('holdpoint.html'), replay),
  writeFile(here('docs/index.html'), replay),
]);
