import Anthropic from "@anthropic-ai/sdk"
import { NextResponse } from "next/server"
import { getRecommendedScalesFromQuality, guideTones } from "@/lib/music/tonal"

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const MODEL = "claude-opus-4-6"

// Line Lab — single-note improvised lines over a chosen stretch of changes.
// Kept close to the original Line Lab prompt, which leans on Barry Harris,
// Pat Martino, Randy Vincent, and Hal Galper pedagogy.
const SYSTEM_PROMPT =
  "You are a jazz guitar improvisation expert fluent in Barry Harris, Pat Martino, " +
  "Randy Vincent, and Hal Galper pedagogy. You write single-note eighth-note-based " +
  "lines for guitar in standard tuning. Respond ONLY with minified JSON, no markdown " +
  "fences, no prose. Schema: " +
  '{"bars":[{"c":"chord(s)","d":"device used","x":"why it works, max 16 words",' +
  '"n":[[string,fret,beats],...]}],"s":"one sentence on the overall shape"}. ' +
  "string is 1 (high e) to 6 (low E). beats is 0.5 for eighths, 1 quarter, 2 half, etc. " +
  "Each bar sums to 4 beats or slightly less if it breathes. Keep every note playable " +
  "in the requested position with at most a one-fret stretch or slide."

// Complexity ladder — each level sets the baseline vocabulary. Selected device
// chips bias emphasis on top of this, most strongly at levels 3-5.
const LEVELS = {
  1: { name: "Skeleton", rule: "Use ONLY chord tones and guide tones (3rds and 7ths). Quarter and eighth notes. No chromaticism at all. Land the 3rd or 7th on strong beats and voice-lead guide tones between chords (the 7th of one chord falling a half step to the 3rd of the next). This is the bare skeleton a beginner would play." },
  2: { name: "Inside", rule: "Use the recommended (inside) scale for each chord plus diatonic passing tones and the bebop scale (added chromatic passing tone between b7 and 6 on dominants, between 5 and 6 on major). Mostly eighth notes with clear voice leading. Stay audibly inside." },
  3: { name: "Chromatic", rule: "Emphasize chromatic enclosures and approach patterns: wrap target chord tones (especially 3rds and 7ths) from a half step above and below, use double chromatic approaches from below, and delayed resolutions. Bebop eighth-note flow. Name each enclosure by the target it wraps." },
  4: { name: "Structures", rule: "Use triad pairs (two triads a step or tritone apart sharing no common tones), melodic cells sequenced and rhythmically displaced, and arpeggio superimposition (Em7 arpeggio over Cmaj9, upper-structure triads over dominants). Identify the specific pair or cell in each bar." },
  5: { name: "Exotic / Altered", rule: "Use altered and exotic scale choices: the altered scale (melodic minor a half step up) and half-whole diminished over dominants, lydian dominant over non-resolving 7ths, side-slipping (play a half step off, then resolve), and upper-structure tensions (b9, #9, #11, b13). Maximum tension with deliberate resolution. Name the scale or device in each bar." },
}

const MAX_BARS = 8

function extractJSON(text) {
  const cleaned = String(text || "").replace(/```json|```/g, "").trim()
  try { return JSON.parse(cleaned) } catch {}
  const start = cleaned.indexOf("{")
  const end = cleaned.lastIndexOf("}")
  if (start === -1 || end <= start) throw new Error("No JSON object in response")
  return JSON.parse(cleaned.slice(start, end + 1))
}

// Keep only notes that are actually playable/renderable so the tab and the
// fretboard can't be handed garbage.
function validateLine(raw) {
  if (!raw || !Array.isArray(raw.bars) || !raw.bars.length) {
    throw new Error("Model returned no bars")
  }
  const bars = raw.bars.slice(0, MAX_BARS).map((bar) => ({
    c: String(bar?.c ?? ""),
    d: String(bar?.d ?? ""),
    x: String(bar?.x ?? ""),
    n: (Array.isArray(bar?.n) ? bar.n : [])
      .map((ev) => {
        const s = Number(ev?.[0]), f = Number(ev?.[1]), b = Number(ev?.[2])
        if (!Number.isFinite(s) || s < 1 || s > 6) return null
        if (!Number.isFinite(f) || f < 0 || f > 24) return null
        if (!Number.isFinite(b) || b <= 0 || b > 8) return null
        return [Math.round(s), Math.round(f), b]
      })
      .filter(Boolean),
  }))
  if (!bars.some((b) => b.n.length)) throw new Error("Model returned no playable notes")
  return { bars, s: String(raw.s ?? "") }
}

export async function POST(request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set. Add it to .env.local and restart the dev server." },
      { status: 500 }
    )
  }

  let section, devices, position, extra, level, chartBars
  try {
    const body = await request.json()
    section = Array.isArray(body.section) ? body.section.filter(Boolean).slice(0, MAX_BARS) : []
    devices = Array.isArray(body.devices) ? body.devices : []
    position = String(body.position || "Anywhere")
    extra = String(body.extra || "").slice(0, 400)
    level = LEVELS[body.level] ? Number(body.level) : null
    // Optional richer bar data (root/quality/beats) so we can feed the model
    // DukeBox's own scale recommendations and guide tones.
    chartBars = Array.isArray(body.chartBars) ? body.chartBars.slice(0, MAX_BARS) : []
    if (!section.length) throw new Error("No bars selected")
  } catch (err) {
    return NextResponse.json({ error: err.message || "Invalid request body" }, { status: 400 })
  }

  // Per-bar theory context, drawn from the same helpers the Improv Guide uses.
  function barContext(i) {
    const cb = chartBars[i]
    if (!cb) return ""
    const parts = []
    try {
      const scales = (getRecommendedScalesFromQuality(cb.quality) || []).slice(0, 2)
      if (scales.length) parts.push(`recommended: ${scales.join(" or ")}`)
    } catch {}
    try {
      const gt = guideTones(cb.symbol)
      if (gt?.length) parts.push(`guide tones ${gt.join("/")}`)
    } catch {}
    if (cb.beats && cb.beats !== 4) parts.push(`${cb.beats}-beat bar`)
    return parts.length ? ` (${parts.join("; ")})` : ""
  }

  const userPrompt =
    (level ? `COMPLEXITY LEVEL ${level} (${LEVELS[level].name}): ${LEVELS[level].rule}\n\n` : "") +
    "Write a connected improvised line over these bars, in order: " +
    section.map((b, i) => `bar ${i + 1}: ${b}${barContext(i)}`).join("; ") +
    ". Devices to draw from: " + (devices.join(", ") || "your best judgment") +
    ". Position: " + position + ". " +
    (extra ? `Additional direction: ${extra}. ` : "") +
    "Vary the devices across bars, connect bars with voice leading or half-step approach, " +
    "and name the specific device per bar (e.g. 'triad pair Eb+F', 'enclosure of the 3rd'). " +
    "For any bar marked as a 2-beat bar, its note durations must sum to 2 beats, not 4."

  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    })
    const text = message.content?.find?.((c) => c.type === "text")?.text ?? ""
    return NextResponse.json({ line: validateLine(extractJSON(text)) })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
