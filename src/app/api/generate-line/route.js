import Anthropic from "@anthropic-ai/sdk"
import { NextResponse } from "next/server"

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

  let section, devices, position, extra
  try {
    const body = await request.json()
    section = Array.isArray(body.section) ? body.section.filter(Boolean).slice(0, MAX_BARS) : []
    devices = Array.isArray(body.devices) ? body.devices : []
    position = String(body.position || "Anywhere")
    extra = String(body.extra || "").slice(0, 400)
    if (!section.length) throw new Error("No bars selected")
  } catch (err) {
    return NextResponse.json({ error: err.message || "Invalid request body" }, { status: 400 })
  }

  const userPrompt =
    "Write a connected improvised line over these bars, in order: " +
    section.map((b, i) => `bar ${i + 1}: ${b}`).join("; ") +
    ". Devices to draw from: " + (devices.join(", ") || "your best judgment") +
    ". Position: " + position + ". " +
    (extra ? `Additional direction: ${extra}. ` : "") +
    "Vary the devices across bars, connect bars with voice leading or half-step approach, " +
    "and name the specific device per bar (e.g. 'triad pair Eb+F', 'enclosure of the 3rd')."

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
