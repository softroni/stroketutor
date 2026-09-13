#!/usr/bin/env node
// Assembles docs/ios-design/index.html, v2.html and v3.html from src/. No dependencies.
//   node docs/ios-design/build.mjs          build every document
//   node docs/ios-design/build.mjs --check  validate fragments only
//   node docs/ios-design/build.mjs --lax    build even with problems (work in progress)
// index.html and v2.html share the v1 fragments, design system and handbook and differ only in
// the shell. v3.html uses the v2 shell around the v3 design system, fragments and handbook (src/v3/).
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, 'src');
const check = process.argv.includes('--check');
const lax = process.argv.includes('--lax');   // report problems but still write (for work in progress)

const docs = [
  { shell: 'shell.html',    out: 'index.html', css: 'design-system.css',    handbook: 'handbook.html',    screens: 'screens',    edition: 'Design specification · iOS' },
  { shell: 'shell-v2.html', out: 'v2.html',    css: 'design-system.css',    handbook: 'handbook.html',    screens: 'screens',    edition: 'Design specification · iOS' },
  { shell: 'shell-v2.html', out: 'v3.html',    css: 'v3/design-system.css', handbook: 'v3/handbook.html', screens: 'v3/screens', edition: 'Design specification · iOS · v3' },
];
const symbols = readFileSync(join(src, 'symbols.svg.html'), 'utf8');
const symbolIds = new Set([...symbols.matchAll(/<symbol id="([^"]+)"/g)].map(m => m[1]));
const roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
const date = new Date().toISOString().slice(0, 10);
let failed = false;

function assemble(doc) {
  const dir = join(src, doc.screens);
  const files = readdirSync(dir).filter(f => f.endsWith('.html') && !f.startsWith('_')).sort();
  let screens = '';
  const seen = new Map();
  const problems = [];
  const nav = new Map(); // group -> [{id,title}]
  let n = 0;
  for (const f of files) {
    const html = readFileSync(join(dir, f), 'utf8');
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
  for (const m of screens.matchAll(/data-goto="([^"]+)"/g)) {
    if (!seen.has(m[1]) && m[1] !== 'handbook') problems.push(`data-goto="${m[1]}" points at no screen`);
  }
  const localIds = new Set([...screens.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
  for (const m of screens.matchAll(/href="#([^"]+)"/g)) {
    if (!symbolIds.has(m[1]) && !localIds.has(m[1]) && !seen.has(m[1]) && m[1] !== 'handbook') problems.push(`href="#${m[1]}" refers to nothing`);
  }

  let navHtml = '';
  let navV2 = '';
  let g = 0;
  for (const [group, items] of nav) {
    navHtml += `<div class="group"><b>${group}</b>\n` +
      items.map(i => `  <a class="item" href="#${i.id}" data-target="${i.id}"><span class="n">${String(i.n).padStart(2, '0')}</span><span>${i.title}</span></a>`).join('\n') +
      `\n</div>\n`;
    navV2 += `<section class="ix-group"><h3><span class="ix-roman">${roman[g++] || ''}</span>${group}<span class="ix-count">${items.length}</span></h3>\n` +
      items.map(i => `  <a class="ix-item" href="#${i.id}" data-target="${i.id}"><span class="ix-n">${String(i.n).padStart(2, '0')}</span><span class="ix-t">${i.title}</span></a>`).join('\n') +
      `\n</section>\n`;
  }

  if (problems.length) {
    console.error(`${doc.out}: problems:\n - ` + problems.join('\n - '));
    failed = true;
    if (!lax) return;
  }
  console.log(`${doc.out}: ${files.length} fragment file(s), ${seen.size} screen(s), ${nav.size} group(s)`);
  if (check) return;

  const shell = readFileSync(join(src, doc.shell), 'utf8');
  const css = readFileSync(join(src, doc.css), 'utf8');
  const handbook = readFileSync(join(src, doc.handbook), 'utf8');
  const out = shell
    .replace('{{DESIGN_SYSTEM_CSS}}', () => css)
    .replace('{{SYMBOLS}}', () => symbols)
    .replace('{{HANDBOOK}}', () => handbook)
    .replace('{{NAV}}', () => navHtml)
    .replace('{{NAV_V2}}', () => navV2)
    .replace('{{SCREENS}}', () => screens)
    .replace('{{TOTAL}}', () => String(seen.size))
    .replace('{{EDITION}}', () => doc.edition)
    .replace('{{DATE}}', () => date);
  writeFileSync(join(here, doc.out), out);
  console.log(`wrote ${join(here, doc.out)} (${(out.length / 1024).toFixed(0)} KB)`);
}

for (const doc of docs) assemble(doc);
if (failed) process.exit(1);
