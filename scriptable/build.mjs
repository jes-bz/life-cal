import { readFile, mkdir, writeFile } from 'node:fs/promises';

const logic = await readFile(new URL('../calendar-logic.js', import.meta.url), 'utf8');
const design = await readFile(new URL('../calendar-design.js', import.meta.url), 'utf8');
const renderer = await readFile(new URL('./render.js', import.meta.url), 'utf8');
const interactive = await readFile(new URL('./interactive.js', import.meta.url), 'utf8');
const release = JSON.parse(await readFile(new URL('../release.json', import.meta.url), 'utf8'));
// Scriptable uses JavaScriptCore without ES modules. Bundle the shared geometry.
const source = '// Life Calendar — offline Scriptable renderer\n' +
    `const LIFE_CALENDAR_VERSION = ${JSON.stringify(release.version)};\n` +
    `const LIFE_CALENDAR_SITE_URL = ${JSON.stringify(release.siteUrl)};\n` +
    logic.replace(/^export /gm, '').replace(
        'Object.hasOwn(DEVICES, name)',
        'Object.prototype.hasOwnProperty.call(DEVICES, name)'
    ) + '\n' + design.replace(/^import .*$/gm, '').replace(/^export /gm, '') + '\n' + renderer;
const output = new URL('../dist/', import.meta.url);
await mkdir(output, { recursive: true });
await writeFile(new URL('life-calendar-scriptable.js', output), source);
await writeFile(new URL('life-calendar-interactive.js', output), source + '\n' + interactive);
console.log('Built dist/life-calendar-scriptable.js');
