import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  DOC_PARTS,
  DOC_TASKS,
  DOC_TOOLS,
  commandParts,
  copyText,
  filterTools,
  searchWords,
  studioCliGroups,
  type DocTool,
} from './docs'
import studioCli from './studioCli.json'

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url))
const studioTool = DOC_TOOLS.find((tool) => tool.id === 'studio-cli') as DocTool

/** Every line the page shows: the tools' commands and the jobs' steps. */
const allLines = [
  ...DOC_TOOLS.flatMap((tool) => tool.groups.flatMap((group) => group.commands.map((command) => copyText(tool, command)))),
  ...DOC_TASKS.flatMap((task) => task.steps.filter((step) => !step.ask).map((step) => step.run)),
]

describe('the Docs page', () => {
  it('files every tool under one part, with an id of its own', () => {
    const ids = DOC_TOOLS.map((tool) => tool.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const tool of DOC_TOOLS) expect(DOC_PARTS.filter((part) => part.kinds.includes(tool.kind))).toHaveLength(1)
    for (const task of DOC_TASKS) expect(ids).toContain(task.tool)
  })

  it('lists every command of the Studio command line once, each under a group with a name', () => {
    const groups = studioCliGroups()
    expect(groups.map((group) => group.title)).not.toContain('More')
    // Grouped by first word, as `studio --help` groups them, so `lessons video` joins the other lessons.
    expect(groups.flatMap((group) => group.commands.map((command) => command.run)).sort()).toEqual(
      studioCli.commands.map((command) => command.usage).sort(),
    )
    expect(groups.find((group) => group.title === 'Lessons')?.commands.map((command) => command.run)).toContain('lessons video <id>')
  })

  it('copies a Studio command as the whole line, ready to paste in web/', () => {
    const status = studioTool.groups[0].commands[0]
    expect(copyText(studioTool, status)).toBe('npm run studio -- status')
  })

  it('writes every Studio command line of a job with a real command and real options', () => {
    const names = studioCli.commands.map((command) => command.name).sort((a, b) => b.length - a.length)
    const global = studioCli.global.flatMap((option) => option.flag.match(/--[\w-]+/g) ?? [])
    const lines = allLines.filter((line) => line.startsWith('npm run studio -- '))
    expect(lines.length).toBeGreaterThan(10)
    for (const line of lines) {
      const rest = line.slice('npm run studio -- '.length)
      const name = names.find((candidate) => rest === candidate || rest.startsWith(`${candidate} `))
      expect(name, line).toBeDefined()
      const command = studioCli.commands.find((candidate) => candidate.name === name)
      const known = [...global, ...(command?.options ?? []).flatMap((option) => option.flag.match(/--[\w-]+/g) ?? [])]
      for (const flag of rest.match(/(?<=\s)--[\w-]+/g) ?? []) expect(known, `${flag} in ${line}`).toContain(flag)
    }
  })

  it('names only scripts that exist, with the commands and options they take', () => {
    const scripts = new Set(allLines.flatMap((line) => line.match(/\bdocs\/[\w./-]+\.(?:py|sh|mjs|plist)\b/g) ?? []))
    expect(scripts.size).toBeGreaterThan(5)
    for (const script of scripts) expect(existsSync(repoRoot + script), script).toBe(true)

    const today = readFileSync(`${repoRoot}docs/ops/today.py`, 'utf8')
    for (const line of allLines.filter((line) => line.startsWith('python3 docs/ops/today.py '))) {
      expect(today, line).toContain(`command == "${line.split(' ')[2]}"`)
    }
    const upload = readFileSync(`${repoRoot}docs/app-store/marketing/upload.py`, 'utf8')
    for (const line of allLines.filter((line) => line.includes('upload.py '))) {
      for (const flag of line.match(/--[\w-]+/g) ?? []) expect(upload, line).toContain(`"${flag}"`)
    }
  })

  it('names only npm and bun scripts that the packages define', () => {
    const web = JSON.parse(readFileSync(`${repoRoot}web/package.json`, 'utf8')).scripts as Record<string, string>
    const paywalls = JSON.parse(readFileSync(`${repoRoot}superwall/package.json`, 'utf8')).scripts as Record<string, string>
    for (const line of allLines) {
      for (const [, script] of line.matchAll(/npm run ([\w:-]+)/g)) expect(web, line).toHaveProperty(script)
      for (const [, script] of line.matchAll(/bun (?:run )?([\w:-]+)/g)) expect(paywalls, line).toHaveProperty(script)
    }
    expect(web).toHaveProperty('test')
  })

  it('links only to files the repo has', () => {
    const links = DOC_TOOLS.flatMap((tool) => tool.more ?? [])
    expect(links.length).toBeGreaterThan(5)
    for (const link of links) {
      const path = link.href.replace('https://github.com/softroni/stroketutor/blob/main/', '')
      expect(path, link.href).not.toBe(link.href)
      expect(existsSync(repoRoot + path), path).toBe(true)
    }
  })
})

describe('searching the Docs page', () => {
  it('needs every word, in any order and case', () => {
    expect(searchWords('  Video   STILLS ')).toEqual(['video', 'stills'])
    const found = filterTools(DOC_TOOLS, searchWords('stills video'))
    expect(found.map((tool) => tool.id)).toEqual(['studio-cli'])
    expect(found[0].groups.flatMap((group) => group.commands.map((command) => command.run))).toEqual(['lessons video <id>'])
  })

  it('reads a tool’s name, so naming the tool lists all of it', () => {
    const found = filterTools(DOC_TOOLS, searchWords('posthog'))
    const posthog = found.find((tool) => tool.id === 'posthog')
    expect(posthog?.groups).toEqual(DOC_TOOLS.find((tool) => tool.id === 'posthog')?.groups)
  })

  it('keeps everything with no words, and nothing for a word nowhere', () => {
    expect(filterTools(DOC_TOOLS, [])).toBe(DOC_TOOLS)
    expect(filterTools(DOC_TOOLS, searchWords('zzqx'))).toEqual([])
  })
})

describe('the parts of a command', () => {
  it('marks what is filled in', () => {
    expect(commandParts('python3 docs/ops/today.py log "<what happened>"')).toEqual([
      { text: 'python3 docs/ops/today.py log "', fill: false },
      { text: '<what happened>', fill: true },
      { text: '"', fill: false },
    ])
    expect(commandParts('node render.mjs [iphone|ipad] [shot]').filter((part) => part.fill).map((part) => part.text)).toEqual([
      '[iphone|ipad]',
      '[shot]',
    ])
    expect(commandParts('call dashboard-insights-run {"id": 2140277}')).toEqual([
      { text: 'call dashboard-insights-run {"id": 2140277}', fill: false },
    ])
  })
})
