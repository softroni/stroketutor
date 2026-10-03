// The Studio tour's screen recordings: node record.mjs [clip ...] (none: all). Each lands in ../raw/<clip>.mp4
// with <clip>.marks.json (seconds from its first frame). Only plays, scrolls and opens things: never makes,
// approves, publishes or changes anything in the Studio.
import { open, record, smoothScroll, moveTo, clickOn } from './rec.mjs'

const BASE = 'http://localhost:5173/#/'
const wait = (p, ms) => p.waitForTimeout(ms)

async function go(page, route, ms = 4000) {
  await page.goto(BASE + route)
  await wait(page, ms)
  await page.evaluate(() => window.scrollTo(0, 0))
}

async function scrollToEl(page, sel, ms = 1400, offset = 90) {
  await page.evaluate(([sel, offset]) => { window.__t = document.querySelector(sel) ? document.querySelector(sel).getBoundingClientRect().top + window.scrollY - offset : null }, [sel, offset])
  const y = await page.evaluate(() => window.__t)
  if (y == null) { console.warn('no', sel); return }
  await smoothScroll(page, y, ms)
}

async function scrollToText(page, text, ms = 1400, offset = 110) {
  const loc = page.getByText(text, { exact: false }).first()
  const box = await loc.boundingBox()
  if (!box) { console.warn('no text', text); return }
  const y = await page.evaluate(() => window.scrollY)
  await smoothScroll(page, Math.max(0, y + box.y - offset), ms)
}

const CLIPS = {
  async nav(page) {
    // Every page once first, so none is still asking PostHog or Superwall while it is filmed.
    for (const route of ['voice', 'learners', 'social', 'docs', 'today']) {
      await go(page, route, 1500)
      await page.waitForFunction(() => !/Asking PostHog|Loading/.test(document.body.innerText), null, { timeout: 90000 }).catch(() => console.warn('slow', route))
    }
    await go(page, 'paths/plants')
    await page.mouse.move(1100, 500)
    await record(page, 'nav', async (p, mark) => {
      await wait(p, 600)
      for (const tab of ['Voice', 'Learners', 'Social', 'Docs', 'Today', 'Paths']) {
        mark(tab)
        await clickOn(p, `header a:has-text("${tab}"), nav a:has-text("${tab}")`, 450)
        await wait(p, 1500)
      }
    })
  },

  async paths(page) {
    await go(page, 'paths/plants')
    await page.mouse.move(900, 600)
    await record(page, 'paths', async (p, mark) => {
      await wait(p, 800)
      mark('hover cards')
      for (const name of ['Tulip', 'Mushroom', 'Sunflower']) { await moveTo(p, `text=${name}`, 500); await wait(p, 350) }
      for (const path of ['In the Air', 'Food & Treats', 'Around Town', 'Plants']) {
        mark(path)
        await clickOn(p, `.st-paths__list a:has-text("${path}")`, 550)
        await wait(p, 1300)
      }
      mark('palm tree')
      await clickOn(p, 'text=Palm Tree', 700)
      await wait(p, 2500)
    })
  },

  async lessonPlay(page) {
    await go(page, 'lessons/palm-tree')
    await page.mouse.move(800, 600)
    await record(page, 'lessonPlay', async (p, mark) => {
      await wait(p, 700)
      await clickOn(p, 'button:has-text("2×")', 500)
      await wait(p, 300)
      mark('play')
      await clickOn(p, 'button:has-text("Lesson")', 500)
      await p.mouse.move(1000, 700, { steps: 20 })
      await wait(p, 25000)
      mark('done')
      await wait(p, 1000)
    })
  },

  async lessonSteps(page) {
    await go(page, 'lessons/palm-tree')
    await page.mouse.move(800, 600)
    await record(page, 'lessonSteps', async (p, mark) => {
      await wait(p, 600)
      mark('colour by step off')
      await clickOn(p, 'text=Colour by step', 600)
      await wait(p, 1200)
      await clickOn(p, 'text=Colour by step', 400)
      await wait(p, 600)
      mark('step 4')
      const leaf = p.locator('text=Draw the top leaf >> visible=true').first()
      await leaf.evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'center' }))
      await wait(p, 900)
      await clickOn(p, leaf, 700)
      await wait(p, 1200)
      mark('replay step')
      await clickOn(p, 'text=Replay step', 600)
      await wait(p, 4500)
      mark('preview')
      await clickOn(p, 'button:has-text("Preview")', 700)
      await p.mouse.move(1150, 780, { steps: 25 })
      await wait(p, 11000)
      mark('ready')
      await clickOn(p, 'button:has-text("I’m ready"), button:has-text("I\'m ready")', 700)
      await wait(p, 6000)
    })
  },

  async voice(page) {
    await go(page, 'voice')
    await page.mouse.move(900, 300)
    await record(page, 'voice', async (p, mark) => {
      await wait(p, 600)
      mark('cast')
      await moveTo(p, 'text=Lina, bright', 600); await wait(p, 600)
      await moveTo(p, 'text=Lina, unhurried', 500); await wait(p, 500)
      await moveTo(p, 'text=Lina, spark', 500); await wait(p, 500)
      await scrollToText(p, 'THE CAST', 1200, 90)
      await wait(p, 400)
      mark('play encouragement')
      await clickOn(p, '[aria-label="Play Lina, bright saying Encouragement"]', 600)
      await wait(p, 6500)
      mark('describe')
      await scrollToText(p, 'Add a voice', 1000, 300)
      await moveTo(p, 'text=Add a voice', 600); await wait(p, 1500)
      mark('own lines')
      await scrollToText(p, 'LINA’S OWN LINES', 1600, 90)
      await wait(p, 600)
      mark('play hello')
      await clickOn(p, '[aria-label="Play Onboarding and Settings: meet the voice"]', 600)
      await wait(p, 6800)
      mark('scroll lines')
      await smoothScroll(p, (await p.evaluate(() => window.scrollY)) + 500, 2500)
      await wait(p, 1000)
    })
  },

  async learnersTop(page) {
    await go(page, 'learners', 2000)
    await page.waitForFunction(() => document.body.innerText.includes('how to draw'), null, { timeout: 60000 }).catch(() => console.warn('no keyword names'))
    await wait(page, 1500)
    await page.mouse.move(700, 250)
    await record(page, 'learnersTop', async (p, mark) => {
      await wait(p, 800)
      mark('tiles')
      for (const t of ['Installs', 'Lessons done', 'Free trials', 'Buys']) { await moveTo(p, `text=${t}`, 550); await wait(p, 450) }
      mark('journey')
      await scrollToText(p, 'Journey of the day', 1500, 120)
      await moveTo(p, 'text=Finished onboarding', 600); await wait(p, 700)
      await moveTo(p, 'text=First drawing', 400); await wait(p, 700)
      mark('most drawn')
      await moveTo(p, 'text=Most drawn', 600); await wait(p, 1200)
      mark('paywall')
      await scrollToText(p, 'At the paywall', 1500, 110)
      await moveTo(p, 'text=Paywall 1', 600); await wait(p, 1200)
      await moveTo(p, 'text=Met “This part is for a grown-up”', 700); await wait(p, 1500)
      mark('before buying')
      await scrollToText(p, 'Before buying', 1500, 110)
      await wait(p, 1800)
      mark('where from')
      await scrollToText(p, 'Where from', 1500, 110)
      await moveTo(p, 'text=Apple Ads “how to draw”', 700); await wait(p, 1500)
      await scrollToText(p, 'LINKS IN POSTS', 1200, 260)
      await moveTo(p, 'text=tour-1-1', 600); await wait(p, 1500)
      mark('top learners')
      await scrollToText(p, 'Top learners', 1500, 110)
      await wait(p, 1500)
      mark('sessions')
      await scrollToEl(p, '.st-learners__sessions', 1500, 200)
      await wait(p, 2500)
    })
  },

  async learnersSession(page) {
    await go(page, 'learners', 2000)
    await page.waitForFunction(() => document.body.innerText.includes('renewal off'), null, { timeout: 90000 }).catch(() => console.warn('no renewal off'))
    await wait(page, 1000)
    await scrollToEl(page, '.st-learners__sessions', 10, 200)
    await page.mouse.move(900, 400)
    await record(page, 'learnersSession', async (p, mark) => {
      await wait(p, 600)
      const faces = p.locator('.st-learners__session-face')
      const n = await faces.count()
      let pick = 0
      for (let i = 0; i < n; i++) if ((await faces.nth(i).innerText()).includes('E574')) { pick = i; break }
      const face = faces.nth(pick)
      const y = await p.evaluate(() => window.scrollY)
      const box = await face.boundingBox()
      await smoothScroll(p, y + box.y - 200, 1400)
      mark('row')
      await moveTo(p, face.locator('.st-learners__purchase'), 700); await wait(p, 1800)
      mark('open')
      const b2 = await face.boundingBox()
      await clickOn(p, { x: b2.x + 260, y: b2.y + 25 }, 500)
      await wait(p, 1200)
      mark('paywall')
      await scrollToText(p, 'Paywall opened', 2200, 330)
      await moveTo(p, 'text=Bought Premium, yearly', 600); await wait(p, 2500)
      mark('cancel')
      await scrollToText(p, 'Turned off the free week', 2600, 330)
      await moveTo(p, 'text=Turned off the free week', 700); await wait(p, 3000)
      mark('after')
      await smoothScroll(p, (await p.evaluate(() => window.scrollY)) + 380, 2200)
      await wait(p, 2000)
    })
  },

  async learnersPeriod(page) {
    // Week and month take PostHog a while the first time; the Studio keeps the answer five minutes.
    for (const period of ['week', 'month']) {
      await go(page, `learners/${period}`, 1000)
      await page.waitForFunction(() => !document.body.innerText.includes('Asking PostHog'), null, { timeout: 120000 }).catch(() => console.warn('slow', period))
    }
    await go(page, 'learners', 2000)
    await page.waitForFunction(() => document.body.innerText.includes('how to draw'), null, { timeout: 60000 }).catch(() => {})
    await wait(page, 1000)
    await page.mouse.move(900, 400)
    await record(page, 'learnersPeriod', async (p, mark) => {
      await wait(p, 500)
      mark('week')
      await clickOn(p, '.st-learners__segments a:has-text("Week")', 700)
      await wait(p, 3500)
      mark('month')
      await clickOn(p, '.st-learners__segments a:has-text("Month")', 500)
      await wait(p, 3500)
      mark('scroll month')
      await smoothScroll(p, 700, 2500)
      await wait(p, 2000)
    })
  },

  async social(page) {
    await go(page, 'social')
    await page.mouse.move(900, 400)
    await record(page, 'social', async (p, mark) => {
      await wait(p, 800)
      mark('coming up')
      await moveTo(p, 'text=Cherries', 600); await wait(p, 600)
      await moveTo(p, 'text=Boba Tea', 600); await wait(p, 900)
      mark('made')
      await scrollToText(p, 'Made, not posted yet', 1800, 100)
      await wait(p, 1500)
      mark('lesson videos')
      await scrollToText(p, 'Lesson video', 1800, 300)
      await moveTo(p, 'text=Tulip', 600); await wait(p, 1500)
      mark('history')
      await scrollToText(p, 'Saturday, October 3', 1800, 110)
      await wait(p, 1200)
      await smoothScroll(p, (await p.evaluate(() => window.scrollY)) + 700, 3500)
      await wait(p, 1500)
    })
  },

  async docs(page) {
    await go(page, 'docs')
    await page.mouse.move(900, 500)
    await record(page, 'docs', async (p, mark) => {
      await wait(p, 800)
      mark('search')
      const input = 'input[placeholder^="Find a command"]'
      await clickOn(p, input, 600)
      await p.type(input, 'video', { delay: 140 })
      await wait(p, 2200)
      await smoothScroll(p, 350, 1500)
      await wait(p, 1500)
      mark('ads')
      await smoothScroll(p, 0, 900)
      await p.fill(input, '')
      await p.type(input, 'ads', { delay: 160 })
      await wait(p, 2200)
      await p.fill(input, '')
      mark('recipes')
      await scrollToText(p, 'I WANT TO', 1500, 110)
      await moveTo(p, 'text=Give a lesson Lina’s voice', 600); await wait(p, 600)
      mark('copy')
      const copy = p.locator('button:has-text("Copy")').nth(6)
      await clickOn(p, copy, 600)
      await wait(p, 1500)
      await smoothScroll(p, (await p.evaluate(() => window.scrollY)) + 800, 3500)
      await wait(p, 1200)
    })
  },

  async today(page) {
    await go(page, 'today')
    await page.mouse.move(900, 400)
    await record(page, 'today', async (p, mark) => {
      await wait(p, 1500)
      mark('releases')
      await moveTo(p, 'text=Waiting for review', 600); await wait(p, 1000)
      mark('needs you')
      await scrollToText(p, 'Needs you', 1500, 110)
      await wait(p, 1500)
      mark('claude is on')
      await scrollToText(p, 'What Claude is on', 2000, 100)
      await moveTo(p, 'text=Apple Ads: the $150 learning budget', 600); await wait(p, 1500)
      mark('log')
      await scrollToText(p, 'Show all', 1800, 520)
      await wait(p, 2500)
      await smoothScroll(p, (await p.evaluate(() => window.scrollY)) + 400, 2000)
      await wait(p, 1500)
    })
  },
}

const want = process.argv.slice(2).filter((arg) => !arg.startsWith('--'))
const width = Number(process.argv.find((arg) => arg.startsWith('--width='))?.slice(8) ?? 1440)
const { browser, page } = await open(width)
for (const [name, fn] of Object.entries(CLIPS)) {
  if (want.length && !want.includes(name)) continue
  try { await fn(page) } catch (e) { console.error(name, 'failed:', e.message.split('\n')[0]) }
}
await browser.close()
