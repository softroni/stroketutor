import { describe, expect, it } from 'vitest'

import { COMMANDS } from './main'
import { describeCommandLine } from './reference'

describe('the command line on the Docs page', () => {
  // The Studio's Docs page (#/docs) lists every command from src/studio/studioCli.json. A new
  // command, or a changed summary or option, fails here until the file is written again with
  //   npx vitest run cli/reference -u
  it('is the command line as it stands', async () => {
    const reference = `${JSON.stringify(describeCommandLine(COMMANDS), null, 2)}\n`
    await expect(reference).toMatchFileSnapshot('../src/studio/studioCli.json')
  })

  it('writes usages and options as --help does', () => {
    const { global, commands } = describeCommandLine(COMMANDS)
    expect(global).toContainEqual({ flag: '-y, --yes', description: 'Skip confirmations of destructive changes.' })
    const video = commands.find((command) => command.name === 'lessons video')
    expect(video?.usage).toBe('lessons video <id>')
    expect(video?.options.map((option) => option.flag)).toContain('--stills <dir>')
    expect(commands.find((command) => command.name === 'paths add')?.usage).toBe('paths add <id> <lessonId...>')
  })
})
