// Cover thumbnails for the Reference tab.
//
// The guides in public/reference/ are standalone HTML documents, so their
// "cover" is just the top of the page — screenshot it and the shelf shows
// each guide as itself rather than as a row of identical text links.
// Re-run after editing a guide (or adding one to GUIDES):
//
//   npm run start &            # thumbnails are shot against the real server
//   node scripts/make-reference-thumbs.mjs
//
// Output: public/reference/thumbs/<slug>.jpg at 600x450 (a 1200x900 layout
// shot at deviceScaleFactor 0.5 — the page lays out at desktop width, so the
// cover looks like the document does, then scales down to a thumbnail).

import { mkdir } from "node:fs/promises"
import { execSync } from "node:child_process"
import path from "node:path"
import { pathToFileURL } from "node:url"

// Playwright isn't a dependency of the app — it's only needed to regenerate
// these covers — so take it from wherever it happens to be installed
// (project, or a global install) rather than forcing it into package.json.
async function loadChromium() {
  try { return (await import("playwright")).chromium } catch {}
  try {
    const root = execSync("npm root -g", { encoding: "utf8" }).trim()
    const mod = await import(pathToFileURL(path.join(root, "playwright", "index.mjs")).href)
    return mod.chromium ?? mod.default?.chromium
  } catch {}
  console.error("playwright not found — `npm i -D playwright` (or install it globally), then re-run.")
  process.exit(1)
}
const chromium = await loadChromium()

const BASE = process.env.THUMB_BASE ?? "http://localhost:3000"
const OUT = path.resolve("public/reference/thumbs")

const GUIDES = [
  "pentatonic-32-navigator.html",
  "likas-page-2-guitar.html",
  "triad-network.html",
  "blues-pathways.html",
  "open-tunings-1.html",
  "open-tunings-2.html",
  "tavern-set.html",
  "martin-000-buying-guide.html",
  "mesaboogie.html",
]

await mkdir(OUT, { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage({
  viewport: { width: 1200, height: 900 },
  deviceScaleFactor: 0.5,
})

for (const file of GUIDES) {
  const url = `${BASE}/reference/${file}`
  const out = path.join(OUT, file.replace(/\.html$/, ".jpg"))
  await page.goto(url, { waitUntil: "networkidle" }).catch(() => {})
  // Guides that animate or lazy-render (the navigator's board, the triad
  // canvas) need a beat before the cover is worth capturing.
  await page.waitForTimeout(1200)
  await page.screenshot({ path: out, type: "jpeg", quality: 78 })
  console.log("✓", path.basename(out))
}

await browser.close()
