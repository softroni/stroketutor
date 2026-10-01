import type { CommandLineReference } from '../../cli/reference'

import { routeHref } from './route'
import studioCliJson from './studioCli.json'

/**
 * The Docs page (#/docs): every command line, script, MCP server and skill this repo uses, what each
 * is for, where to run it, and the line to copy. Written for the creator, in plain words.
 *
 * The Studio command line's commands are not written here: they come from the command line itself
 * (studioCli.json, which cli/reference.test.ts keeps equal to cli/main.ts). Everything else is. A
 * script, command or MCP tool the repo comes to rely on gets its row here in the same change.
 */

/** How a tool is reached, which is also where the page files it. */
export type DocKind = 'terminal' | 'mcp' | 'skill' | 'agent'

export interface DocOption {
  flag: string
  description: string
}

export interface DocCommand {
  /** What to type, or what Claude sends an MCP server. `<placeholders>` are filled in. */
  run: string
  /** What it does, in a sentence. `code` in backquotes. */
  does: string
  /** A caution or a tip, shown after the sentence. */
  note?: string
  /** A Studio command's options, as its `--help` lists them. */
  options?: DocOption[]
  /** False for a name that is nothing to run: a launch agent, a routine. */
  copy?: boolean
}

export interface DocGroup {
  title: string
  about?: string
  commands: DocCommand[]
}

export interface DocLink {
  label: string
  href: string
}

export interface DocTool {
  id: string
  kind: DocKind
  name: string
  /** What it is for, in a sentence or two. */
  about: string
  /** Where its commands run, or where the server lives. */
  where: string
  usedBy: string
  needs?: string[]
  /** What to know before running anything. */
  tips?: string[]
  /** Copy puts this in front of every command: the Studio command line's `npm run studio -- `. */
  prefix?: string
  /** Options every command takes. */
  global?: DocOption[]
  /** Where to see what it makes. */
  see?: DocLink[]
  /** Where the whole story is. */
  more?: DocLink[]
  groups: DocGroup[]
}

export interface DocStep {
  run: string
  does?: string
  /** Words to say to Claude, not a command. */
  ask?: boolean
}

/** A job and the lines that do it: the page's way in. */
export interface DocTask {
  id: string
  title: string
  /** Where the lines run. */
  where: string
  steps: DocStep[]
  note?: string
  /** The tool the lines come from. */
  tool: string
}

export interface DocPart {
  id: 'terminal' | 'claude' | 'own'
  title: string
  about: string
  kinds: DocKind[]
}

export const DOC_PARTS: DocPart[] = [
  {
    id: 'terminal',
    title: 'In a terminal',
    about: 'Command lines and scripts. Copy a line, fill in the <placeholders>, run it.',
    kinds: ['terminal'],
  },
  {
    id: 'claude',
    title: 'Through Claude',
    about: 'MCP servers and skills. Claude calls them: ask in plain words, or name the tool.',
    kinds: ['mcp', 'skill'],
  },
  {
    id: 'own',
    title: 'On its own',
    about: 'What runs with nobody at the keyboard: the Mac’s launch agents and Claude’s routines.',
    kinds: ['agent'],
  },
]

export const KIND_LABELS: Record<DocKind, string> = {
  terminal: 'Terminal',
  mcp: 'MCP server',
  skill: 'Skills',
  agent: 'Runs on its own',
}

const REPO = 'https://github.com/softroni/stroketutor/blob/main/'

function repo(path: string, label = path): DocLink {
  return { label, href: REPO + path }
}

const studioCli = studioCliJson as CommandLineReference

const STUDIO_CLI_GROUPS: { title: string; about: string; words: string[] }[] = [
  { title: 'The Studio', about: 'Where things stand, and what the command line reads and writes.', words: ['status', 'settings', 'models', 'adopt-shared'] },
  { title: 'Levels', about: 'The bands the path list is grouped into: Starter, Core, Advanced.', words: ['levels'] },
  { title: 'Paths', about: 'The paths: their order, color and lessons.', words: ['paths'] },
  { title: 'Curriculum', about: 'A whole plan of levels, paths and planned lessons, laid over the curriculum at once.', words: ['curriculum'] },
  { title: 'Lessons', about: 'Make, check, reshape, picture and film a lesson.', words: ['lessons'] },
  { title: 'Steps', about: 'Split, merge, move and reword the steps of a lesson.', words: ['steps'] },
  { title: 'Strokes', about: 'Move, reverse, split, join and retime single lines.', words: ['strokes'] },
  { title: 'History', about: 'Every saved version of a lesson, and bringing one back.', words: ['history'] },
  { title: 'Publish', about: 'Write lessons and the curriculum into shared/, which ships in the app.', words: ['publish'] },
  { title: 'Trash', about: 'Put things back, or delete them for good.', words: ['trash'] },
  { title: 'SVG and images', about: 'Turn an SVG or a picture into a lesson, and look at a trace.', words: ['svg', 'image'] },
  { title: 'Social', about: 'Lesson videos, step pins and release news on Softroni’s accounts, through Upload-Post.', words: ['social'] },
  { title: 'Voice', about: 'Lina’s voice: cast it, record every step, publish the recordings for the app.', words: ['voice'] },
]

/** The command line's commands in its own order, under the groups above; a word no group names goes last. */
export function studioCliGroups(reference: CommandLineReference = studioCli): DocGroup[] {
  const groups: DocGroup[] = STUDIO_CLI_GROUPS.map(({ title, about }) => ({ title, about, commands: [] }))
  const more: DocGroup = { title: 'More', commands: [] }
  for (const command of reference.commands) {
    const word = command.name.split(' ')[0]
    const index = STUDIO_CLI_GROUPS.findIndex((group) => group.words.includes(word))
    ;(index >= 0 ? groups[index] : more).commands.push({
      run: command.usage,
      does: command.summary,
      ...(command.options.length > 0 ? { options: command.options } : {}),
    })
  }
  return [...groups, more].filter((group) => group.commands.length > 0)
}

const studioPages = {
  today: routeHref({ name: 'today', day: null }),
  social: routeHref({ name: 'social' }),
  voice: routeHref({ name: 'voice' }),
  screenshots: routeHref({ name: 'screenshots', device: 'iphone', shot: null }),
  settings: routeHref({ name: 'settings' }),
}

const IOS_TEST = "xcodebuild test -project PaperCoach.xcodeproj -scheme PaperCoach -destination 'platform=iOS Simulator,name=iPhone 17'"

export const DOC_TOOLS: DocTool[] = [
  {
    id: 'studio',
    kind: 'terminal',
    name: 'The Studio',
    about:
      'This web app. It runs by itself on the Mac m4-1, so open it rather than start it: http://m4-1.tail958ea4.ts.net:5173 from any device on the tailnet.',
    where: '`web/`',
    usedBy: 'You and Claude',
    needs: ['Node 22.13 or later, and `npm install` once', 'Keys in `web/.env.local` (git ignores it): `OPENROUTER_API_KEY` to generate lessons'],
    tips: ['On m4-1, don’t start a second Studio: the command line and the running one share the workspace safely.'],
    see: [{ label: 'Settings', href: studioPages.settings }],
    more: [repo('web/README.md')],
    groups: [
      {
        title: 'Run it',
        commands: [
          {
            run: 'npm run dev',
            does: 'Starts the Studio at http://localhost:5173 with its local server: saving, publishing, voice, Today. A plain build has no server and is read-only.',
          },
          {
            run: 'STUDIO_OPS_DIR=<folder> npm run dev',
            does: 'Shows the Today page from another folder (a sample, or a past day from `ops-history`), leaving `.studio/ops` alone.',
          },
        ],
      },
      {
        title: 'Check it',
        commands: [
          { run: 'npm test', does: 'Every web test: the player, the conformance cases, the catalog, the Studio and the command line.' },
          { run: 'npm run build', does: 'Type-checks and bundles. Run it with `npm test` before every push: never push red.' },
          { run: 'npx vitest run cli', does: 'Only the command line’s tests, with no browser.' },
          { run: 'STUDIO_BROWSER_TESTS=1 npx vitest run cli/browser.smoke', does: 'The smoke tests that drive a real Chromium.' },
          { run: 'npx playwright install chromium', does: 'Once per machine: the headless Chromium that SVG commands, pictures and videos need.' },
        ],
      },
    ],
  },
  {
    id: 'studio-cli',
    kind: 'terminal',
    name: 'Studio command line',
    about:
      'Everything the Studio does, from a terminal and on the same workspace: lessons, paths, publishing, Lina’s voice, videos and social posts. It is how Claude authors lessons.',
    where: '`web/`',
    usedBy: 'Claude, and you',
    prefix: 'npm run studio -- ',
    needs: [
      'Chromium for SVG commands, pictures and videos (`npx playwright install chromium`)',
      'An OpenRouter key in `web/.env.local` for anything a model writes',
      'ffmpeg and Whisper for videos; Upload-Post settings in `~/.config/upload-post/config` for social',
    ],
    tips: [
      'Every command runs as `npm run studio -- <command>` from `web/`. Copy puts the whole line on the clipboard.',
      'Keep the `--` after `npm run studio`: without it npm swallows the options.',
      'Only `publish` and Voice’s publishing write `shared/`, which ships in the app. Everything else changes your workspace (`.studio/workspace.sqlite`).',
      'A destructive change asks you to type the id; `-y` answers for scripts. Exit codes: 0 done, 1 refused (the reason is printed), 2 not understood.',
      'To try something without touching real lessons: `STUDIO_WORKSPACE=/tmp/ws.sqlite npm run studio -- status`.',
    ],
    global: studioCli.global,
    more: [repo('.claude/skills/studio-cli/SKILL.md', 'The full manual (the studio-cli skill)'), repo('.claude/skills/studio-cli/reference.md', 'Every --help, word for word')],
    groups: studioCliGroups(),
  },
  {
    id: 'today',
    kind: 'terminal',
    name: 'Daily ops: today.py',
    about:
      'Reads App Store Connect, sales, Apple Ads and the paywall tests, keeps the log, and builds the Today page. The routines run it every day; anyone can log a line.',
    where: 'repo root',
    usedBy: 'Claude’s routines; you, to log',
    needs: ['App Store Connect keys in `~/.appstoreconnect/config`', 'The `superwall` CLI signed in, for Apple Ads and the tests'],
    tips: [
      'A log line is one short sentence under 120 characters, in plain words: “Apple approved 1.1 (4); tagged and merged”.',
      'Never delete `.studio/ops/history` or `log.jsonl`: they only grow.',
    ],
    see: [{ label: 'Today', href: studioPages.today }],
    more: [repo('docs/ops/README.md', 'The ops runbook'), repo('docs/ops/today.py')],
    groups: [
      {
        title: 'Every day',
        commands: [
          {
            run: 'python3 docs/ops/today.py check',
            does: 'Quick: has the App Store review state changed, and are there new reviews? Prints “no changes” when nothing moved.',
          },
          {
            run: 'python3 docs/ops/today.py collect',
            does: 'Everything: versions and review, reviews, rating, sales, Apple Ads and the Superwall tests, into `.studio/ops/facts.json`.',
          },
          { run: 'python3 docs/ops/today.py publish', does: 'Rebuilds the Today page from the facts, Claude’s notes and the log.' },
          {
            run: 'python3 docs/ops/today.py archive',
            does: 'Commits and pushes the day’s history to the `ops-history` branch, so any past day opens at `#/today/<date>`.',
          },
        ],
      },
      {
        title: 'The log',
        commands: [
          { run: 'python3 docs/ops/today.py log "<what happened>"', does: 'Adds a line to the Today log and republishes the page.' },
          {
            run: 'python3 docs/ops/today.py log --kind <kind> "<what happened>"',
            does: 'The same, filed under a kind: release, review, ads, tests, social, build, money, learners or check.',
          },
          { run: 'python3 docs/ops/today.py show', does: 'The page as it stands, in the terminal.' },
        ],
      },
    ],
  },
  {
    id: 'screenshots',
    kind: 'terminal',
    name: 'App Store screenshots',
    about:
      'Eight framed screenshots for the iPhone and the same eight for the iPad: captured from the simulators, rendered with their headlines, uploaded to App Store Connect. A change to a screen they show means taking them again.',
    where: 'repo root',
    usedBy: 'Claude',
    needs: [
      'The two screenshot simulators booted with a Debug build: “PC Shots iPhone 17 Pro Max” and “PC Shots iPad Pro 13”',
      'Google Chrome, and `npm install` in `web/`',
      'Apple’s device frames, already on this Mac',
    ],
    see: [{ label: 'Screenshots', href: studioPages.screenshots }],
    more: [repo('docs/app-store/marketing/README.md', 'How the screenshots are made')],
    groups: [
      {
        title: 'Capture',
        commands: [
          { run: 'xcrun simctl list devices | grep "PC Shots"', does: 'The two screenshot simulators and their udids.' },
          {
            run: 'docs/app-store/marketing/capture.sh <udid> <iphone|ipad> <screen...>',
            does: 'Opens the app on each screen through its debug harness and saves the raw picture in `captures/`.',
            note: 'Shot 4 needs `SETTLE=25` in front, while its intro builds the drawing; Home needs `SETTLE=9`.',
          },
        ],
      },
      {
        title: 'Render',
        commands: [
          {
            run: 'node docs/app-store/marketing/render.mjs [iphone|ipad] [shot]',
            does: 'Frames and captions the shots into `out/`: all sixteen with no arguments, or one, like `iphone learn`.',
          },
          { run: 'node docs/app-store/marketing/gallery.mjs', does: 'Rewrites `gallery.html` alone; `render.mjs` already does it.' },
        ],
      },
      {
        title: 'Upload',
        commands: [
          { run: 'python3 docs/app-store/marketing/upload.py', does: 'Compares `out/` with the version being prepared in App Store Connect. Changes nothing.' },
          {
            run: 'python3 docs/app-store/marketing/upload.py --apply',
            does: 'Uploads only the sets that differ and waits for Apple to process them. Never touches a version in review or on sale.',
            note: '`--version 1.1` picks a version by name.',
          },
        ],
      },
    ],
  },
  {
    id: 'ios',
    kind: 'terminal',
    name: 'The iOS app: Xcode and git',
    about: 'Testing the app, opening a simulator straight on any screen, and the git steps of a release.',
    where: 'repo root',
    usedBy: 'You for features, Claude for fixes',
    tips: [
      'A fix starts from what is on sale, in a `release/<version>` worktree, never from `main`.',
      'Only builds Apple approved are tagged, as `<version>(<build>)`, like `1.0(2)`.',
    ],
    more: [repo('docs/ops/README.md', 'Shipping a fix, in the ops runbook'), repo('PaperCoach/App/DebugScreenHarness.swift', 'Every screen the harness opens')],
    groups: [
      {
        title: 'Test and look',
        commands: [
          { run: IOS_TEST, does: 'Every iOS test, on the iPhone 17 simulator.' },
          {
            run: 'xcrun simctl launch <udid> com.softroni.papercoach -STScreen <screen>',
            does: 'Opens a Debug build straight on one screen, with sample data: `paths`, `player-awaiting`, `sketchbook-filled`, `offer-paywall` and fifty more.',
          },
          {
            run: 'xcrun simctl launch <udid> com.softroni.papercoach -STScreen <screen> -STLesson <lessonId>',
            does: 'The same with another lesson than the palm tree, like `-STScreen preview-default -STLesson rocket`.',
          },
        ],
      },
      {
        title: 'A release',
        commands: [
          {
            run: "git worktree add ../stroketutor-release-<version> -b release/<version> '<version>(<build>)'",
            does: 'Starts a fix from the build on sale, in a folder of its own.',
          },
          { run: "git tag '<version>(<build>)' <commit>", does: 'Tags the commit of a build Apple approved.' },
          { run: "git push origin '<version>(<build>)'", does: 'Pushes the tag.' },
          { run: 'git tag -l', does: 'Every build Apple has approved.' },
        ],
      },
      {
        title: 'A crash',
        commands: [
          {
            run: `atos -arch arm64 -o "$DSYM/Contents/Resources/DWARF/PaperCoach" -l 0x100000000 0x$(printf '%x' $((0x100000000 + 0x<offset>)))`,
            does: 'Turns a crash report’s `PaperCoach+0x<offset>` into a line of code.',
            note: '`DSYM` is the dSYM of the build that crashed, in its archive under `~/Library/Developer/Xcode/Archives`.',
          },
        ],
      },
    ],
  },
  {
    id: 'superwall',
    kind: 'terminal',
    name: 'Superwall CLI',
    about:
      'The paywalls, campaigns and A/B tests in Superwall, and Apple Ads through Superwall’s proxy. `today.py` calls it for the tests and the ads.',
    where: 'anywhere',
    usedBy: 'Claude, for the tests and the ads',
    needs: ['`superwall login` once per machine'],
    tips: [
      'A paywall test is judged by purchases per paywall open, never by taps.',
      'Apple Ads follow the runbook’s budget rule: within $150 of spend in all, Claude experiments freely; past it needs Kevin’s yes and a plan.',
    ],
    more: [repo('docs/ops/README.md', 'A/B test and Apple Ads rules, in the ops runbook'), repo('docs/ops/apple-ads-plan.md', 'The Apple Ads plan')],
    groups: [
      {
        title: 'Paywalls and tests',
        commands: [
          { run: 'superwall campaigns list', does: 'The campaigns and their paywall splits: Onboarding offer (109312) and In-app Premium (109313).' },
          { run: 'superwall paywalls list', does: 'Every paywall, by id and name.' },
          { run: 'superwall query "<sql>"', does: 'SQL over Superwall’s analytics: paywall opens, trials, purchases.' },
        ],
      },
      {
        title: 'Apple Ads',
        commands: [
          {
            run: 'superwall asa campaigns list --app 54792',
            does: 'The Apple Ads campaigns. `--app 54792` is the Superwall app whose connection reaches Softroni’s ads account.',
          },
          {
            run: 'superwall asa <resource> <action> --app 54792',
            does: 'Any Apple Ads resource: `adgroups`, `keywords`, `negative-keywords`, `reports`, `budget-orders`…',
          },
          { run: 'superwall asa docs <resource>', does: 'A resource’s fields and actions, from Apple’s own schema.' },
          { run: 'superwall asa apps eligibility 6816231257 --app 54792', does: 'Whether Paper Coach can be advertised.' },
        ],
      },
      {
        title: 'App Store Connect and the CLI',
        commands: [
          { run: 'superwall asc <get|post|patch|delete> <path>', does: 'The App Store Connect API through Superwall’s signed proxy, with no key to handle.' },
          { run: 'superwall asc docs <search>', does: 'The exact request schema of an App Store Connect endpoint.' },
          { run: 'superwall login', does: 'Signs the CLI in.' },
          { run: 'superwall whoami', does: 'Which account it is signed in as.' },
          { run: 'superwall skills -y', does: 'Installs or updates the Superwall skills Claude uses.' },
        ],
      },
    ],
  },
  {
    id: 'paywalls',
    kind: 'terminal',
    name: 'Code paywalls',
    about: 'Paywalls written as React pages in `superwall/paywalls/`, pushed to Superwall as versions.',
    where: '`superwall/`',
    usedBy: 'Claude',
    needs: ['bun, and `bun install` once', '`SUPERWALL_CHANNEL=next`: the `.env` in `superwall/` sets it, so run from there'],
    tips: ['`bun run ship` changes what learners see, so it follows the A/B test rules like any paywall change.'],
    more: [repo('superwall/README.md')],
    groups: [
      {
        title: 'Paywalls',
        commands: [
          { run: 'bun dev', does: 'Opens Superwall’s studio to preview the paywalls live.' },
          { run: 'bun run push', does: 'Pushes new versions to Superwall. Production is untouched.' },
          { run: 'bun run promote', does: 'Points production at a pushed version.' },
          { run: 'bun run ship', does: 'Pushes and promotes in one step.' },
          { run: 'bun run typecheck', does: 'Type-checks the paywalls.' },
        ],
      },
    ],
  },
  {
    id: 'design',
    kind: 'terminal',
    name: 'iOS design document',
    about: 'Interactive layouts of every screen of the app with developer notes. `v3.html` is the current design.',
    where: 'repo root',
    usedBy: 'You and Claude',
    more: [repo('docs/ios-design/README.md')],
    groups: [
      {
        title: 'Look and build',
        commands: [
          {
            run: 'python3 -m http.server 4173 --directory docs/ios-design',
            does: 'Serves it at http://localhost:4173/v3.html. Claude’s preview calls it `ios-design`.',
          },
          { run: 'node docs/ios-design/build.mjs', does: 'Rebuilds `v3.html`, `v2.html` and `index.html` from `src/`.' },
          { run: 'node docs/ios-design/build.mjs --check', does: 'Only checks the screen fragments.' },
          { run: 'node docs/ios-design/build.mjs --lax', does: 'Builds even with problems, for work in progress.' },
        ],
      },
    ],
  },
  {
    id: 'posthog',
    kind: 'mcp',
    name: 'PostHog',
    about:
      'The app’s analytics: what learners do, the onboarding funnel, paywall steps, crashes and hangs. Claude reads it every night for the daily check.',
    where: 'claude.ai connector · project 629055',
    usedBy: 'Claude',
    tips: [
      'Ask in plain words: “How did Paper Coach do yesterday?” or “Any crashes in the player this week?”',
      'Events from test builds don’t count: leave out `build = debug` and `asa_test_payload`.',
      'Worth knowing: `app_crashed`, `app_hung`, `lesson_completed`, `purchase_attempted`, `install_attributed`, `drawing_shared`.',
    ],
    see: [{ label: 'The daily dashboard', href: 'https://us.posthog.com/project/629055/dashboard/2140277' }],
    more: [repo('docs/ops/README.md', 'The daily check, in the ops runbook')],
    groups: [
      {
        title: 'What Claude sends',
        about: 'One tool, `exec`, takes commands like these.',
        commands: [
          { run: 'call dashboard-insights-run {"id": 2140277, "refresh": "blocking"}', does: 'Runs every tile of “Paper Coach: how it’s going”, fresh.' },
          { run: 'call read-data-schema {"query": {"kind": "events"}}', does: 'The events the app really sends, checked before any query.' },
          { run: 'call execute-sql {"query": "<sql>"}', does: 'Any question in SQL, like the drawing-time check in the runbook.' },
          { run: 'learn -s "<task>"', does: 'Loads PostHog’s own playbook for a task first.' },
          { run: 'search <words>', does: 'Finds a PostHog tool by what it does.' },
          { run: 'info <tool>', does: 'A tool’s inputs, read before calling it.' },
        ],
      },
    ],
  },
  {
    id: 'voice-server',
    kind: 'mcp',
    name: 'Lina’s voice server',
    about:
      'Speech made on the Mac m4-1 with MLX models; nothing leaves the tailnet. The Studio’s Voice page and `studio voice …` use it, and Claude can call it directly for any narration.',
    where: 'm4-1 · local-tts',
    usedBy: 'The Studio, and Claude',
    tips: [
      'The Studio reaches it at `STUDIO_TTS_MCP_URL` (https://m4-1.tail958ea4.ts.net:8443/mcp); Claude at http://127.0.0.1:8001/mcp.',
      'The first line after switching models is slow while it loads.',
    ],
    see: [{ label: 'Voice', href: studioPages.voice }],
    more: [repo('web/README.md', 'Voice, in the web README')],
    groups: [
      {
        title: 'Tools',
        commands: [
          { run: 'status', does: 'Whether the speech server is up, and which model is warm.' },
          { run: 'list_voices', does: 'The reference voices that can be cloned.' },
          {
            run: 'generate_speech {"text": "<words>", "model": "chatterbox"}',
            does: 'Speaks a line and returns a link to the audio. Models: `chatterbox`, `qwen-custom` and `qwen-design` (steered by a `style`), `qwen-base` (clones a `voice`).',
          },
          {
            run: 'add_voice {"name": "<name>", "transcript": "<words>", "audio_base64": "<wav>"}',
            does: 'Uploads a 5 to 15 second reference to clone. Freezing Lina’s voice in the Studio does this.',
          },
          { run: 'list_outputs', does: 'The audio made lately.' },
        ],
      },
    ],
  },
  {
    id: 'browser',
    kind: 'mcp',
    name: 'Browser',
    about:
      'For the pages with no API: Apple’s message about a rejection, App Privacy, the Superwall editor, Upload-Post. Claude in Chrome works in your own signed-in Chrome; Claude’s browser is its own.',
    where: 'the Claude app',
    usedBy: 'Claude',
    tips: ['Claude never types a password or pays: signing in and paying stay yours.'],
    groups: [
      {
        title: 'Tools',
        commands: [
          { run: 'preview_start {"name": "papercoach-web"}', does: 'Opens the Studio in Claude’s browser, as `.claude/launch.json` describes it.' },
          { run: 'preview_start {"name": "ios-design"}', does: 'Serves the iOS design document and opens it.' },
          { run: 'navigate <url>', does: 'Opens a page; `get_page_text` then reads it, `computer` clicks and types.' },
        ],
      },
    ],
  },
  {
    id: 'simulator',
    kind: 'mcp',
    name: 'iOS Simulator',
    about: 'Claude installs a build on a simulator, opens it and looks: screenshots, taps, typing. You can watch it in a live panel.',
    where: 'the Claude app',
    usedBy: 'Claude',
    tips: ['`-STScreen <screen>` and `-STLesson <id>` open any screen directly (see The iOS app).'],
    groups: [
      {
        title: 'Tools',
        commands: [
          { run: 'attach', does: 'Opens the live panel, so you can watch.' },
          { run: 'launch {"app_path": "<path>/PaperCoach.app"}', does: 'Installs a build and opens it.' },
          { run: 'screenshot', does: 'What the screen shows now.' },
          { run: 'tap · swipe · text', does: 'Uses the app as a finger would.' },
          { run: 'open_url <url>', does: 'Opens a link in the simulator.' },
        ],
      },
    ],
  },
  {
    id: 'skills',
    kind: 'skill',
    name: 'Skills',
    about: 'Manuals Claude loads for a job. Type the name with a slash in Claude, or ask for it by name.',
    where: 'Claude',
    usedBy: 'Claude',
    more: [repo('.claude/skills/studio-cli/SKILL.md', 'studio-cli'), repo('.claude/skills/author-lesson/SKILL.md', 'author-lesson')],
    groups: [
      {
        title: 'In this repo',
        commands: [
          { run: '/studio-cli', does: 'How to drive the Studio from a terminal: every command, selectors, plan files, gotchas.' },
          { run: '/author-lesson', does: 'Turn an SVG into a lesson as a person would draw it, or plan a path of lessons.' },
        ],
      },
      {
        title: 'On this Mac',
        commands: [
          { run: '/superwall', does: 'The Superwall CLI: apps, products, campaigns, paywalls, App Store Connect, analytics.' },
          { run: '/superwall-editor', does: 'Build and edit a live Superwall paywall in its browser editor.' },
          { run: '/local-tts', does: 'Narration and voices on the Mac’s speech server.' },
        ],
      },
    ],
  },
  {
    id: 'agents',
    kind: 'agent',
    name: 'Launch agents on m4-1',
    about: 'macOS keeps these running on the Mac m4-1, from login on. Nothing needs starting by hand.',
    where: '`~/Library/LaunchAgents`',
    usedBy: 'macOS, by itself',
    tips: ['Logs are in `.studio/logs/` of the main checkout.'],
    see: [{ label: 'Social', href: studioPages.social }],
    more: [repo('docs/ops/README.md', 'Lesson videos on social, in the ops runbook')],
    groups: [
      {
        title: 'The agents',
        commands: [
          {
            run: 'com.softroni.stroketutor-web',
            does: 'Keeps the Studio running for the tailnet (`npm run dev` in `web/`). Log: `web.log`.',
            copy: false,
          },
          {
            run: 'com.softroni.stroketutor-autopull',
            does: 'Every minute, fast-forwards this checkout from GitHub and restarts the Studio when packages changed. Local edits stop it. Log: `autopull.log`.',
            copy: false,
          },
          {
            run: 'com.softroni.papercoach-social',
            does: 'At 17:00 Central, posts the day’s lesson video: `social next --log`. Log: `social.log`.',
            copy: false,
          },
        ],
      },
      {
        title: 'Looking at them',
        commands: [
          { run: 'launchctl list | grep softroni', does: 'Which of them are loaded.' },
          { run: 'tail -f .studio/logs/<name>.log', does: 'Follows a log as it is written, from the repo root.' },
          {
            run: 'launchctl load -w ~/Library/LaunchAgents/com.softroni.papercoach-social.plist',
            does: 'Turns the daily post on, once its plist is copied from `docs/ops/`.',
          },
        ],
      },
    ],
  },
  {
    id: 'routines',
    kind: 'agent',
    name: 'Claude routines',
    about:
      'Scheduled Claude runs on m4-1 while the Claude app is open. Each acts by its prompt and sends anything that needs you to your phone. Change them in the Claude app, under Routines.',
    where: 'the Claude app · scheduled tasks',
    usedBy: 'Claude, by itself',
    see: [{ label: 'Today', href: studioPages.today }],
    more: [repo('docs/ops/README.md', 'A day, in the ops runbook'), repo('docs/ops/routines/paper-coach-social.md', 'The social check’s prompt')],
    groups: [
      {
        title: 'The routines',
        commands: [
          {
            run: 'paper-coach-daily',
            does: 'At midnight Central: the daily check. App Store, reviews, crashes, A/B tests, Apple Ads, social, then Today and a short summary.',
            copy: false,
          },
          {
            run: 'paper-coach-heartbeat',
            does: 'At 08:00, 12:00, 16:00 and 20:00: the review state and new reviews. Stops at once when nothing changed.',
            copy: false,
          },
          {
            run: 'paper-coach-social',
            does: 'At 17:45: checks the 17:00 post reached every platform and fixes what failed; the Monday numbers; release news.',
            copy: false,
          },
        ],
      },
      {
        title: 'What Claude sends',
        about: 'The scheduled-tasks MCP server.',
        commands: [
          { run: 'list_scheduled_tasks', does: 'Every routine, its schedule and its next run.' },
          { run: 'run_scheduled_task {"taskId": "<id>"}', does: 'Runs one now, like Run now in Routines.' },
          { run: 'list_task_runs', does: 'The latest runs, and what each said.' },
        ],
      },
    ],
  },
]

export const DOC_TASKS: DocTask[] = [
  {
    id: 'status',
    title: 'See where the lessons stand',
    where: 'web/',
    tool: 'studio-cli',
    steps: [
      { run: 'npm run studio -- status', does: 'Paths, lessons, and what publishing would change' },
      { run: 'npm run studio -- lessons list --status draft', does: 'Only the drafts' },
    ],
  },
  {
    id: 'svg-lesson',
    title: 'Make a lesson from an SVG',
    where: 'web/',
    tool: 'studio-cli',
    note: 'Claude writes the plan of steps with the author-lesson skill.',
    steps: [
      { run: 'npm run studio -- svg optimize <file>.svg --simplify', does: 'A clean drawing to trace' },
      { run: 'npm run studio -- svg trace <file>.optimized.svg --out t.json --summary', does: 'Its lines and colours, with ids' },
      {
        run: 'npm run studio -- svg to-steps <file>.optimized.svg --plan plan.json --trace t.json --id <id> --title "<title>" --objective "<objective>" --source "<source>" --license "<license>"',
        does: 'The lesson, as a draft',
      },
    ],
  },
  {
    id: 'publish',
    title: 'Put lessons in the app',
    where: 'web/',
    tool: 'studio-cli',
    note: 'Then commit `shared/`: the app bundles it at its next release.',
    steps: [
      { run: 'npm run studio -- lessons approve <id>', does: 'Shows its quality warnings, then approves it' },
      { run: 'npm run studio -- publish lessons <id>', does: 'Writes it into shared/ and prints the git add line' },
    ],
  },
  {
    id: 'voice',
    title: 'Give a lesson Lina’s voice',
    where: 'web/',
    tool: 'studio-cli',
    steps: [
      { run: 'npm run studio -- voice narrate <id>', does: 'Records every step not recorded yet' },
      { run: 'npm run studio -- voice publish <id>', does: 'Puts the recordings in shared/ for the app' },
    ],
  },
  {
    id: 'video',
    title: 'Film a lesson for social',
    where: 'web/',
    tool: 'studio-cli',
    steps: [
      { run: 'npm run studio -- lessons video <id> --stills <folder>', does: 'Six stills in half a minute: look first' },
      { run: 'npm run studio -- lessons video <id>', does: 'The video, in .studio/videos/' },
    ],
  },
  {
    id: 'social',
    title: 'Check the social posts',
    where: 'web/',
    tool: 'studio-cli',
    note: 'The day’s video posts itself at 17:00.',
    steps: [
      { run: 'npm run studio -- social queue', does: 'What goes out next' },
      { run: 'npm run studio -- social status --refresh', does: 'Where the last posts reached' },
      { run: 'npm run studio -- social scorecard', does: 'How each platform did this week' },
      { run: 'npm run studio -- social post <id> --platforms <platform> --no-pin', does: 'Post a lesson again, to one platform' },
    ],
  },
  {
    id: 'log',
    title: 'Write on the Today page',
    where: 'repo root',
    tool: 'today',
    steps: [
      { run: 'python3 docs/ops/today.py log "<what happened>"', does: 'One short sentence; the page updates' },
      { run: 'python3 docs/ops/today.py show', does: 'The page as it stands, in the terminal' },
    ],
  },
  {
    id: 'screenshots',
    title: 'Retake the App Store screenshots',
    where: 'repo root',
    tool: 'screenshots',
    steps: [
      { run: 'docs/app-store/marketing/capture.sh <udid> <iphone|ipad> <screen...>', does: 'The raw screens, from a simulator' },
      { run: 'node docs/app-store/marketing/render.mjs', does: 'Framed and captioned, into out/' },
      { run: 'python3 docs/app-store/marketing/upload.py --apply', does: 'Into the version being prepared' },
    ],
  },
  {
    id: 'numbers',
    title: 'Read the numbers and crashes',
    where: 'Claude',
    tool: 'posthog',
    steps: [
      { run: 'How did Paper Coach do yesterday? Read the PostHog dashboard.', does: 'Ask Claude', ask: true },
      { run: 'call dashboard-insights-run {"id": 2140277, "refresh": "blocking"}', does: 'What Claude sends PostHog' },
    ],
  },
  {
    id: 'tests-ads',
    title: 'Look at the paywall tests and ads',
    where: 'anywhere',
    tool: 'superwall',
    steps: [
      { run: 'superwall campaigns list', does: 'The paywall tests and their splits' },
      { run: 'superwall asa campaigns list --app 54792', does: 'The Apple Ads campaigns' },
    ],
  },
  {
    id: 'tests',
    title: 'Run every test',
    where: 'web/, then the repo root',
    tool: 'studio',
    steps: [
      { run: 'npm test && npm run build', does: 'The web app and the command line, from web/' },
      { run: IOS_TEST, does: 'The iOS app, from the repo root' },
    ],
  },
]

/** What to know before running anything. */
export const DOC_RULES: string[] = [
  'The Studio runs by itself on m4-1. Don’t start a second one there.',
  'Studio commands run from `web/`; everything else from the repo root.',
  'Only publishing writes `shared/`, which ships in the app. Everything else changes your own workspace.',
  'Keys never go in the repo: they live in `~/.appstoreconnect`, `~/.config/upload-post` and `web/.env.local`.',
]

export function partOf(tool: DocTool): DocPart {
  return DOC_PARTS.find((part) => part.kinds.includes(tool.kind)) ?? DOC_PARTS[0]
}

export function commandCount(tool: DocTool): number {
  return tool.groups.reduce((sum, group) => sum + group.commands.length, 0)
}

/** The line Copy puts on the clipboard: the whole line, ready to paste. */
export function copyText(tool: DocTool, command: DocCommand): string {
  return `${tool.prefix ?? ''}${command.run}`
}

/** The words of a search, lowercased; every one must appear for a row to match. */
export function searchWords(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean)
}

export function commandMatches(tool: DocTool, group: DocGroup, command: DocCommand, words: string[]): boolean {
  if (words.length === 0) return true
  const text = [
    tool.name,
    tool.prefix ?? '',
    group.title,
    command.run,
    command.does,
    command.note ?? '',
    ...(command.options ?? []).flatMap((option) => [option.flag, option.description]),
  ]
    .join(' ')
    .toLowerCase()
  return words.every((word) => text.includes(word))
}

export function taskMatches(task: DocTask, words: string[]): boolean {
  if (words.length === 0) return true
  const text = [task.title, task.note ?? '', ...task.steps.flatMap((step) => [step.run, step.does ?? ''])].join(' ').toLowerCase()
  return words.every((word) => text.includes(word))
}

/** Each tool with only the groups and commands a search matches; a tool with none is left out. */
export function filterTools(tools: DocTool[], words: string[]): DocTool[] {
  if (words.length === 0) return tools
  return tools.flatMap((tool) => {
    const groups = tool.groups
      .map((group) => ({ ...group, commands: group.commands.filter((command) => commandMatches(tool, group, command, words)) }))
      .filter((group) => group.commands.length > 0)
    return groups.length > 0 ? [{ ...tool, groups }] : []
  })
}

/** A command split into what is typed as written and the `<placeholders>` and `[optional parts]` to fill in. */
export function commandParts(run: string): { text: string; fill: boolean }[] {
  return run
    .split(/(<[^<>]+>|\[[^[\]\s]+\])/)
    .filter(Boolean)
    .map((text) => ({ text, fill: /^(<[^<>]+>|\[[^[\]\s]+\])$/.test(text) }))
}
