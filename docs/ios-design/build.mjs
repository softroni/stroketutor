#!/usr/bin/env node
// Assembles docs/ios-design/index.html from src/. No dependencies.
//   node docs/ios-design/build.mjs          build
//   node docs/ios-design/build.mjs --check  validate fragments only
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, 'src');
const check = process.argv.includes('--check');

const shell = readFileSync(join(src, 'shell.html'), 'utf8');
const css = readFileSync(join(src, 'design-system.css'), 'utf8');
const symbols = readFileSync(join(src, 'symbols.svg.html'), 'utf8');
const handbook = readFileSync(join(src, 'handbook.html'), 'utf8');

const files = readdirSync(join(src, 'screens')).filter(f => f.endsWith('.html') && !f.startsWith('_')).sort();
let screens = '';
const seen = new Map();
const problems = [];
const nav = new Map(); // group -> [{id,title}]
let n = 0;
for (const f of files) {
  const html = readFileSync(join(src, 'screens', f), 'utf8');
  const articleRe = /<article\b([^>]*)>/g;
  let m;
  let count = 0;
  while ((m = articleRe.exec(html))) {
    count += 1;
    const attrs = m[1];
    const id = /\bid="([^"]+)"/.exec(attrs)?.[1];
    const title = /\bdata-title="([^"]+)"/.exec(attrs)?.[1];
    const group = /\bdata-group="([^"]+)"/.exec(attrs)?.[1];
    if (!id || !title || !group) problems.push(`${f}: <article> needs id, data-title and data-group (${attrs.trim()})`);
    if (!/\bclass="[^"]*\bscreen\b/.test(attrs)) problems.push(`${f}: <article id="${id}"> must have class="screen"`);
    if (id && seen.has(id)) problems.push(`${f}: duplicate id "${id}" (also in ${seen.get(id)})`);
    if (id) seen.set(id, f);
    if (group) { if (!nav.has(group)) nav.set(group, []); nav.get(group).push({ id, title, n: ++n }); }
  }
  if (count === 0) problems.push(`${f}: no <article> found`);
  if (/<!doctype|<html\b|<head\b|<body\b/i.test(html)) problems.push(`${f}: fragments must not contain doctype/html/head/body`);
  if (/\bid="(lina-|i-)/.test(html)) problems.push(`${f}: do not redefine shared symbol ids (lina-*, i-*)`);
  screens += `\n<!-- ${f} -->\n${html}\n`;
}
// every data-goto target must exist
for (const m of screens.matchAll(/data-goto="([^"]+)"/g)) {
  if (!seen.has(m[1]) && m[1] !== 'handbook') problems.push(`data-goto="${m[1]}" points at no screen`);
}
// every <use href="#x"> must be a known symbol or a local id
const symbolIds = new Set([...symbols.matchAll(/<symbol id="([^"]+)"/g)].map(m => m[1]));
const localIds = new Set([...screens.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
for (const m of screens.matchAll(/href="#([^"]+)"/g)) {
  if (!symbolIds.has(m[1]) && !localIds.has(m[1]) && !seen.has(m[1]) && m[1] !== 'handbook') problems.push(`href="#${m[1]}" refers to nothing`);
}

let navHtml = '';
for (const [group, items] of nav) {
  navHtml += `<div class="group"><b>${group}</b>\n` +
    items.map(i => `  <a class="item" href="#${i.id}" data-target="${i.id}"><span class="n">${String(i.n).padStart(2, '0')}</span><span>${i.title}</span></a>`).join('\n') +
    `\n</div>\n`;
}

if (problems.length) {
  console.error('Problems:\n - ' + problems.join('\n - '));
  process.exit(1);
}
console.log(`${files.length} fragment file(s), ${seen.size} screen(s), ${nav.size} group(s)`);
if (check) process.exit(0);

const out = shell
  .replace('{{DESIGN_SYSTEM_CSS}}', () => css)
  .replace('{{SYMBOLS}}', () => symbols)
  .replace('{{HANDBOOK}}', () => handbook)
  .replace('{{NAV}}', () => navHtml)
  .replace('{{SCREENS}}', () => screens)
  .replace('{{DATE}}', () => new Date().toISOString().slice(0, 10));
writeFileSync(join(here, 'index.html'), out);
console.log(`wrote ${join(here, 'index.html')} (${(out.length / 1024).toFixed(0)} KB)`);
