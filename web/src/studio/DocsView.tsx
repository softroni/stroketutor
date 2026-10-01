import { createContext, useContext, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'

import {
  DOC_PARTS,
  DOC_RULES,
  DOC_TASKS,
  DOC_TOOLS,
  KIND_LABELS,
  commandCount,
  commandParts,
  copyText,
  filterTools,
  partOf,
  searchWords,
  taskMatches,
  type DocCommand,
  type DocGroup,
  type DocLink,
  type DocStep,
  type DocTask,
  type DocTool,
} from './docs'
import { routeHref } from './route'

/** Says a copy happened, for screen readers. */
const Announce = createContext<(message: string) => void>(() => {})

/** A tool with more commands than this folds them into one group per kind of thing. */
const FOLD_OVER = 24

/** The click handler of a link to a section of this page. */
type Jump = (id: string) => (event: MouseEvent<HTMLAnchorElement>) => void

/**
 * Docs: every command line, script, MCP server and skill the repo uses, with the line to copy
 * (the content is docs.ts). The search filters every row as it is typed; `#/docs/<tool>` scrolls
 * to one tool, which is how the table of contents and ⌘K reach them.
 */
export function DocsView({ section }: { section: string | null }) {
  const [query, setQuery] = useState('')
  const [announcement, setAnnouncement] = useState('')
  const search = useRef<HTMLInputElement>(null)
  const words = useMemo(() => searchWords(query), [query])
  const searching = words.length > 0
  const tools = useMemo(() => filterTools(DOC_TOOLS, words), [words])
  const tasks = useMemo(() => DOC_TASKS.filter((task) => taskMatches(task, words)), [words])
  const matched = tools.reduce((sum, tool) => sum + commandCount(tool), 0)
  const sections = useMemo(() => [...(searching ? [] : ['start']), ...tools.map((tool) => tool.id)], [searching, tools])
  const active = useActiveSection(sections)

  // Arriving at #/docs/<tool>, or moving to another tool: scroll it under the header. Back to plain
  // #/docs (the header's Docs link) is back to the top.
  const arrived = useRef(false)
  useEffect(() => {
    if (section) scrollToSection(section, arrived.current ? 'smooth' : 'auto')
    else if (arrived.current) window.scrollTo({ top: 0 })
    arrived.current = true
  }, [section])

  // `/` finds, as on most documentation sites, unless something is being typed.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return
      if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable="true"]')) return
      event.preventDefault()
      search.current?.focus()
      search.current?.select()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  /** A link to a tool on this page: the search is cleared so the tool is there to scroll to. */
  const jump: Jump = (id) => (event) => {
    const sameAddress = window.location.hash === routeHref({ name: 'docs', section: id })
    if (searching) setQuery('')
    if (sameAddress || searching) {
      // The address may not change, so nothing else would scroll; wait for the full list to be drawn.
      if (sameAddress) event.preventDefault()
      window.requestAnimationFrame(() => scrollToSection(id, 'smooth'))
    }
  }

  const total = DOC_TOOLS.reduce((sum, tool) => sum + commandCount(tool), 0)

  return (
    <Announce.Provider value={setAnnouncement}>
      <div className="st-docs">
        <header className="st-docs__masthead">
          <p className="st-label">Docs</p>
          <h1 className="st-docs__title">Commands &amp; tools</h1>
          <p className="st-docs__lede">
            Every command line, script and MCP server this repo uses: what each one is for, where it runs, and the
            line to copy.
          </p>
          <div className="st-docs__search">
            <SearchIcon />
            <input
              ref={search}
              type="search"
              value={query}
              placeholder="Find a command: video, publish, crash, ads…"
              aria-label="Find a command"
              aria-controls="st-docs-content"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  if (query) setQuery('')
                  else event.currentTarget.blur()
                }
              }}
            />
            <kbd aria-hidden="true">/</kbd>
          </div>
          <p className="st-docs__counts" aria-live="polite">
            {searching ? (
              <>
                {matched === 0 && tasks.length === 0
                  ? `Nothing matches “${query.trim()}”.`
                  : `${count(matched, 'command')}${tasks.length > 0 ? ` and ${count(tasks.length, 'job')}` : ''} ${
                      matched + tasks.length === 1 ? 'matches' : 'match'
                    } “${query.trim()}”.`}{' '}
                <button type="button" className="st-docs__clear" onClick={() => setQuery('')}>
                  Clear
                </button>
              </>
            ) : (
              `${count(DOC_TOOLS.length, 'tool')} · ${count(total, 'command')}`
            )}
          </p>
        </header>

        <div className="st-docs__layout">
          <nav className="st-docs__toc" aria-label="On this page">
            {searching ? null : (
              <a
                className="st-docs__toc-start"
                href={routeHref({ name: 'docs', section: 'start' })}
                aria-current={active === 'start' ? 'location' : undefined}
                onClick={jump('start')}
              >
                Start here
              </a>
            )}
            {DOC_PARTS.map((part) => {
              const inPart = tools.filter((tool) => partOf(tool).id === part.id)
              if (inPart.length === 0) return null
              return (
                <div key={part.id} className="st-docs__toc-part">
                  <p className="st-docs__toc-title">{part.title}</p>
                  <ul>
                    {inPart.map((tool) => (
                      <li key={tool.id}>
                        <a
                          href={routeHref({ name: 'docs', section: tool.id })}
                          aria-current={active === tool.id ? 'location' : undefined}
                          onClick={jump(tool.id)}
                        >
                          <span>{tool.name}</span>
                          <span className="st-docs__toc-count">{commandCount(tool)}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </nav>

          <div className="st-docs__content" id="st-docs-content">
            {searching ? (
              tasks.length > 0 ? (
                <section className="st-docs__part" aria-labelledby="docs-tasks-title">
                  <Tasks tasks={tasks} onJump={jump} />
                </section>
              ) : null
            ) : (
              <section id="docs-start" className="st-docs__part" aria-labelledby="docs-start-title">
                <header className="st-docs__part-head">
                  <h2 id="docs-start-title" className="st-docs__part-title">
                    Start here
                  </h2>
                  <p>The rules that hold everywhere, then the everyday jobs and the lines that do them.</p>
                </header>
                <ul className="st-docs__rules" aria-label="Good to know">
                  {DOC_RULES.map((rule) => (
                    <li key={rule}>
                      <Prose text={rule} />
                    </li>
                  ))}
                </ul>
                <Tasks tasks={tasks} onJump={jump} />
              </section>
            )}

            {DOC_PARTS.map((part) => {
              const inPart = tools.filter((tool) => partOf(tool).id === part.id)
              if (inPart.length === 0) return null
              return (
                <section key={part.id} className="st-docs__part" aria-labelledby={`docs-part-${part.id}`}>
                  <header className="st-docs__part-head">
                    <h2 id={`docs-part-${part.id}`} className="st-docs__part-title">
                      {part.title}
                    </h2>
                    <p>{part.about}</p>
                  </header>
                  {inPart.map((tool) => (
                    <ToolCard key={tool.id} tool={tool} words={words} />
                  ))}
                </section>
              )
            })}

            {searching && matched === 0 && tasks.length === 0 ? (
              <p className="st-docs__nothing">
                Try one word, like <strong>video</strong>, <strong>publish</strong>, <strong>crash</strong> or{' '}
                <strong>ads</strong>. Or ask Claude: it knows every one of these.
              </p>
            ) : null}
          </div>
        </div>
        <p className="st-docs__sr" aria-live="polite">
          {announcement}
        </p>
      </div>
    </Announce.Provider>
  )
}

function Tasks({ tasks, onJump }: { tasks: DocTask[]; onJump: Jump }) {
  return (
    <>
      <h3 id="docs-tasks-title" className="st-docs__tasks-title">
        I want to…
      </h3>
      <div className="st-docs__tasks">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} onJump={onJump} />
        ))}
      </div>
    </>
  )
}

function TaskCard({ task, onJump }: { task: DocTask; onJump: Jump }) {
  const tool = DOC_TOOLS.find((candidate) => candidate.id === task.tool)
  return (
    <article className="st-docs__task">
      <header className="st-docs__task-head">
        <h4>{task.title}</h4>
        <span className="st-docs__where">{task.where}</span>
        {tool ? (
          <a className="st-docs__task-more" href={routeHref({ name: 'docs', section: tool.id })} onClick={onJump(tool.id)}>
            {tool.name} <span aria-hidden="true">→</span>
          </a>
        ) : null}
      </header>
      <div className="st-docs__task-body">
        <ol className={`st-docs__steps ${task.steps.length > 1 ? 'st-docs__steps--numbered' : ''}`}>
          {task.steps.map((step) => (
            <Step key={step.run} step={step} />
          ))}
        </ol>
        {task.note ? (
          <p className="st-docs__task-note">
            <Prose text={task.note} />
          </p>
        ) : null}
      </div>
    </article>
  )
}

function Step({ step }: { step: DocStep }) {
  return (
    <li className="st-docs__step">
      <div className="st-docs__line">
        {step.ask ? (
          <q className="st-docs__ask">{step.run}</q>
        ) : (
          <code className="st-docs__code">
            <CommandText run={step.run} />
          </code>
        )}
        <CopyButton text={step.run} what={step.ask ? 'the question' : 'the command'} />
      </div>
      {step.does ? <p className="st-docs__step-does">{step.does}</p> : null}
    </li>
  )
}

function ToolCard({ tool, words }: { tool: DocTool; words: string[] }) {
  const searching = words.length > 0
  const folds = !searching && commandCount(tool) > FOLD_OVER
  return (
    <article id={`docs-${tool.id}`} className="st-docs__tool" aria-labelledby={`docs-${tool.id}-name`}>
      <header className="st-docs__tool-head">
        <span className={`st-docs__kind st-docs__kind--${tool.kind}`}>
          <KindIcon kind={tool.kind} />
          {KIND_LABELS[tool.kind]}
        </span>
        <h3 id={`docs-${tool.id}-name`} className="st-docs__tool-name">
          {tool.name}
        </h3>
      </header>
      {searching ? null : (
        <p className="st-docs__about">
          <Prose text={tool.about} />
        </p>
      )}
      <dl className="st-docs__facts">
        <div>
          <dt>Where</dt>
          <dd>
            <Prose text={tool.where} />
          </dd>
        </div>
        <div>
          <dt>Used by</dt>
          <dd>{tool.usedBy}</dd>
        </div>
      </dl>

      {!searching && tool.needs ? (
        <div className="st-docs__needs">
          <p className="st-docs__minor-title">Needs</p>
          <ul>
            {tool.needs.map((need) => (
              <li key={need}>
                <Prose text={need} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {!searching && tool.tips ? (
        <ul className="st-docs__tips" aria-label="Good to know">
          {tool.tips.map((tip) => (
            <li key={tip}>
              <Prose text={tip} />
            </li>
          ))}
        </ul>
      ) : null}
      {!searching && tool.global ? (
        <details className="st-docs__options st-docs__options--global">
          <summary>Every command also takes {count(tool.global.length, 'option')}</summary>
          <Options options={tool.global} />
        </details>
      ) : null}

      <div className="st-docs__groups">
        {tool.groups.map((group) =>
          folds ? (
            <details key={group.title} className="st-docs__fold">
              <summary>
                <span className="st-docs__fold-title">{group.title}</span>
                <span className="st-docs__fold-count">{group.commands.length}</span>
                {group.about ? <span className="st-docs__fold-about">{group.about}</span> : null}
              </summary>
              <Commands tool={tool} group={group} words={words} />
            </details>
          ) : (
            <section key={group.title} className="st-docs__group">
              <h4 className="st-docs__group-title">{group.title}</h4>
              {group.about && !searching ? (
                <p className="st-docs__group-about">
                  <Prose text={group.about} />
                </p>
              ) : null}
              <Commands tool={tool} group={group} words={words} />
            </section>
          ),
        )}
      </div>

      {!searching && (tool.see || tool.more) ? (
        <footer className="st-docs__links">
          {tool.see?.map((link) => (
            <Link key={link.href} link={link} kind="see" />
          ))}
          {tool.more?.map((link) => (
            <Link key={link.href} link={link} kind="more" />
          ))}
        </footer>
      ) : null}
    </article>
  )
}

function Commands({ tool, group, words }: { tool: DocTool; group: DocGroup; words: string[] }) {
  return (
    <ul className="st-docs__commands">
      {group.commands.map((command) => (
        <CommandRow key={command.run} tool={tool} command={command} words={words} />
      ))}
    </ul>
  )
}

function CommandRow({ tool, command, words }: { tool: DocTool; command: DocCommand; words: string[] }) {
  // A search that matched an option opens the options, so the reason for the match shows.
  const optionMatched =
    words.length > 0 &&
    (command.options ?? []).some((option) => words.some((word) => `${option.flag} ${option.description}`.toLowerCase().includes(word)))
  return (
    <li className="st-docs__command">
      <div className="st-docs__line">
        <code className={`st-docs__code ${command.copy === false ? 'st-docs__code--name' : ''}`}>
          <CommandText run={command.run} />
        </code>
        {command.copy === false ? null : <CopyButton text={copyText(tool, command)} what="the command" />}
      </div>
      <p className="st-docs__does">
        <Prose text={command.does} />
        {command.note ? (
          <span className="st-docs__note">
            {' '}
            <Prose text={command.note} />
          </span>
        ) : null}
      </p>
      {command.options ? (
        <details className="st-docs__options" open={optionMatched || undefined}>
          <summary>{count(command.options.length, 'option')}</summary>
          <Options options={command.options} />
        </details>
      ) : null}
    </li>
  )
}

function Options({ options }: { options: { flag: string; description: string }[] }) {
  return (
    <dl className="st-docs__option-list">
      {options.map((option) => (
        <div key={option.flag}>
          <dt>
            <code>
              <CommandText run={option.flag} />
            </code>
          </dt>
          <dd>{option.description}</dd>
        </div>
      ))}
    </dl>
  )
}

/** A command with its `<placeholders>` and `[optional parts]` marked as what to fill in. */
function CommandText({ run }: { run: string }) {
  return (
    <>
      {commandParts(run).map((part, index) =>
        part.fill ? (
          <var key={index} className="st-docs__fill">
            {part.text}
          </var>
        ) : (
          part.text
        ),
      )}
    </>
  )
}

/** Text with `code` in backquotes, and links for the addresses in it. */
function Prose({ text }: { text: string }) {
  return (
    <>
      {text.split(/(`[^`]+`)/).map((part, index) =>
        /^`[^`]+`$/.test(part) ? (
          <code key={index} className="st-docs__inline">
            {part.slice(1, -1)}
          </code>
        ) : (
          <Linked key={index} text={part} />
        ),
      )}
    </>
  )
}

function Linked({ text }: { text: string }) {
  return (
    <>
      {text.split(/(https?:\/\/[^\s]*[^\s.,;:)])/).map((part, index) =>
        index % 2 === 1 ? (
          <a key={index} href={part} target="_blank" rel="noreferrer">
            {part.replace(/^https?:\/\//, '')}
          </a>
        ) : (
          part
        ),
      )}
    </>
  )
}

function Link({ link, kind }: { link: DocLink; kind: 'see' | 'more' }) {
  const outside = /^https?:/.test(link.href)
  return (
    <a
      className={`st-docs__link st-docs__link--${kind}`}
      href={link.href}
      {...(outside ? { target: '_blank', rel: 'noreferrer' } : {})}
    >
      <span className="st-docs__link-kind">{kind === 'see' ? 'See' : 'Read'}</span>
      {link.label}
      <span aria-hidden="true">{outside ? ' ↗' : ' →'}</span>
    </a>
  )
}

function CopyButton({ text, what }: { text: string; what: string }) {
  const announce = useContext(Announce)
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  useEffect(() => {
    if (state === 'idle') return
    const timer = window.setTimeout(() => setState('idle'), 1800)
    return () => window.clearTimeout(timer)
  }, [state])
  return (
    <button
      type="button"
      className="st-docs__copy"
      data-state={state}
      title={text}
      onClick={async (event) => {
        const button = event.currentTarget
        const copied = await writeClipboard(text)
        button.focus()
        if (!copied) selectLine(button)
        setState(copied ? 'copied' : 'failed')
        announce(copied ? `Copied ${what}.` : 'Copying was refused. The line is selected: press ⌘C.')
      }}
    >
      {state === 'copied' ? <CheckIcon /> : <CopyIcon />}
      <span className="st-docs__copy-label" aria-hidden="true">
        {state === 'copied' ? 'Copied' : state === 'failed' ? '⌘C' : 'Copy'}
      </span>
      <span className="st-docs__sr">{state === 'copied' ? `Copied ${what}` : `Copy ${what}`}</span>
    </button>
  )
}

/**
 * The Clipboard API exists only on a secure page (https, or localhost), and a browser may refuse it;
 * the Studio on the tailnet is plain http. Either way it copies through a hidden field instead.
 */
async function writeClipboard(text: string): Promise<boolean> {
  if (window.isSecureContext && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Refused: the older way below may still be allowed.
    }
  }
  const field = document.createElement('textarea')
  field.value = text
  field.setAttribute('readonly', '')
  field.style.position = 'fixed'
  field.style.top = '0'
  field.style.opacity = '0'
  document.body.append(field)
  field.select()
  let copied = false
  try {
    copied = document.execCommand('copy')
  } catch {
    copied = false
  }
  field.remove()
  return copied
}

/** When copying is refused, the line itself is selected so ⌘C takes it. */
function selectLine(button: HTMLElement) {
  const line = button.closest('.st-docs__line')?.querySelector('code, q')
  const selection = window.getSelection()
  if (!line || !selection) return
  const range = document.createRange()
  range.selectNodeContents(line)
  selection.removeAllRanges()
  selection.addRange(range)
}

function scrollToSection(id: string, behavior: ScrollBehavior) {
  const element = document.getElementById(`docs-${id}`)
  if (!element) return
  const distance = element.getBoundingClientRect().top - headerHeight() - 16
  // A long glide is slower than reading: only a nearby section is scrolled to smoothly.
  const near = Math.abs(distance) < window.innerHeight * 1.5
  window.scrollTo({ top: window.scrollY + distance, behavior: near ? behavior : 'auto' })
}

function headerHeight(): number {
  return document.querySelector('.st-studio__bar')?.getBoundingClientRect().height ?? 0
}

/** Which section is under the header as the page scrolls, for the table of contents. */
function useActiveSection(ids: string[]): string | null {
  const [active, setActive] = useState<string | null>(null)
  const key = ids.join(' ')
  useEffect(() => {
    const list = key ? key.split(' ') : []
    let frame = 0
    const update = () => {
      frame = 0
      const line = headerHeight() + 40
      let current: string | null = list[0] ?? null
      for (const id of list) {
        const element = document.getElementById(`docs-${id}`)
        if (element && element.getBoundingClientRect().top <= line) current = id
      }
      // At the very bottom the last sections can't reach the header: the last one is the one read.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) current = list[list.length - 1] ?? current
      setActive(current)
    }
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      window.cancelAnimationFrame(frame)
    }
  }, [key])
  return active
}

function count(n: number, word: string): string {
  return `${n} ${n === 1 ? word : `${word}s`}`
}

function KindIcon({ kind }: { kind: DocTool['kind'] }) {
  const paths: Record<DocTool['kind'], string> = {
    terminal: 'M3 4.5 7 8l-4 3.5M8.5 12H13',
    mcp: 'M6 3v3M10 3v3M4.5 6h7v2.5a3.5 3.5 0 0 1-7 0zM8 12v2',
    skill: 'M3.5 3h6.5l2.5 2.5V13h-9zM6 8h4.5M6 10.5h3',
    agent: 'M8 2.5A5.5 5.5 0 1 1 2.5 8M8 5v3l2 1.5M2.5 3.5V6H5',
  }
  return (
    <svg className="st-docs__kind-icon" viewBox="0 0 16 16" aria-hidden="true">
      <path d={paths[kind]} />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg className="st-docs__copy-icon" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.8" />
      <path d="M10.5 3.6V3.3A1.8 1.8 0 0 0 8.7 1.5H4.3a1.8 1.8 0 0 0-1.8 1.8v4.4a1.8 1.8 0 0 0 1.8 1.8h.3" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg className="st-docs__copy-icon" viewBox="0 0 16 16" aria-hidden="true">
      <path d="m3.5 8.5 3 3 6-7" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg className="st-docs__search-icon" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="7" cy="7" r="4.5" />
      <path d="m10.5 10.5 3 3" />
    </svg>
  )
}
