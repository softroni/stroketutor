import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { parseTutorialJSON, type ValidationIssue } from './validate'

/**
 * Runs the shared conformance corpus.
 *
 * `shared/conformance/` is read by this suite and by `ConformanceTests.swift`
 * in the iOS app. Both assert the verdict the manifest gives, so the two
 * implementations cannot drift apart quietly; where they are meant to differ,
 * the manifest says so out loud and says why.
 *
 * Adding a case is dropping a file in `cases/` and an entry in `cases.json` —
 * no change to this file.
 */

interface TargetExpectation {
  expect?: 'valid' | 'invalid'
  path?: string
  messageContains?: string
  why?: string
}

interface ConformanceCase {
  file: string
  expect: 'valid' | 'invalid'
  why: string
  web?: TargetExpectation
  ios?: TargetExpectation & { warningContains?: string }
}

const corpusDir = fileURLToPath(new URL('../../../shared/conformance/', import.meta.url))
const manifest = JSON.parse(readFileSync(`${corpusDir}cases.json`, 'utf8')) as {
  cases: ConformanceCase[]
}

const describeIssues = (issues: ValidationIssue[]) =>
  issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n')

describe('shared conformance corpus', () => {
  it('has a manifest entry for every case file, and a file for every entry', () => {
    const onDisk = readdirSync(`${corpusDir}cases`).filter((name) => name.endsWith('.json')).sort()
    const listed = manifest.cases.map((entry) => entry.file).sort()
    expect(listed).toEqual(onDisk)
  })

  it('explains every deliberate divergence', () => {
    const undocumented = manifest.cases
      .filter((entry) => entry.ios?.expect && entry.ios.expect !== entry.expect)
      .filter((entry) => !entry.ios?.why)
      .map((entry) => entry.file)
    expect(undocumented).toEqual([])
  })

  for (const entry of manifest.cases) {
    const expected = entry.web?.expect ?? entry.expect

    it(`${entry.file} is ${expected}`, () => {
      const source = readFileSync(`${corpusDir}cases/${entry.file}`, 'utf8')
      const result = parseTutorialJSON(source)

      if (expected === 'valid') {
        expect(result.ok, result.ok ? '' : describeIssues(result.issues)).toBe(true)
        return
      }

      expect(result.ok).toBe(false)
      if (result.ok) return

      if (entry.web?.path) {
        expect(
          result.issues.map((issue) => issue.path),
          describeIssues(result.issues),
        ).toContain(entry.web.path)
      }
      if (entry.web?.messageContains) {
        const matched = result.issues.some((issue) =>
          issue.message.includes(entry.web!.messageContains!),
        )
        expect(matched, describeIssues(result.issues)).toBe(true)
      }
    })
  }
})

describe('shared published tutorials', () => {
  const tutorialsDir = fileURLToPath(new URL('../../../shared/Tutorials/', import.meta.url))
  const files = readdirSync(tutorialsDir).filter((name) => name.endsWith('.json'))

  it('still has representative published tutorials the iOS app bundles', () => {
    // The Studio saves new lessons into this folder too, so this checks for the
    // published representatives rather than an exact list; every file is validated below.
    expect(files).toEqual(expect.arrayContaining(['sun.json', 'cloud.json']))
  })

  for (const file of files) {
    it(`${file} validates`, () => {
      const result = parseTutorialJSON(readFileSync(`${tutorialsDir}${file}`, 'utf8'))
      expect(result.ok, result.ok ? '' : describeIssues(result.issues)).toBe(true)
    })
  }
})
