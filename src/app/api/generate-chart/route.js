import Anthropic from "@anthropic-ai/sdk"
import { NextResponse } from "next/server"

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are a jazz composition engine. Output ONLY valid JSON matching the schema below — no markdown fences, no explanation outside the JSON object.

ALLOWED ROOTS (prefer flats): C Db D Eb E F Gb G Ab A Bb B
ALLOWED QUALITIES: maj7 min7 7 min7b5 dim7 7alt maj6 min6
SYMBOL = root + suffix: maj7→"maj7" min7→"m7" 7→"7" min7b5→"m7b5" dim7→"dim7" 7alt→"7alt" maj6→"6" min6→"m6"
SECTIONS: A  B  Bridge  Tag  Intro  Outro  Vamp

OUTPUT SCHEMA:
{
  "title": "string",
  "keyRoot": "string",
  "keyMode": "major" | "minor",
  "tempo": number,
  "feel": "swing" | "ballad" | "bossa" | "funk" | "latin" | "waltz",
  "generationNotes": "string — explain key harmonic decisions made",
  "bars": [
    { "root": "string", "quality": "string", "symbol": "string", "section": "string" }
  ]
}

JAZZ FORMS:
12-bar blues (any key): I7 IV7 I7 I7 | IV7 IV7 I7 V7/ii | ii-7 V7 I7 V7
Bird/bebop blues (F): F7 Bb7 F7 Cm7 | Bb7 Bdim7 F7 D7 | Gm7 C7 Am7b5 Gm7
AABA 32-bar: A(8) A(8) Bridge(8) A(8)
Rhythm changes A (Bb): Bbmaj7 Gm7 Cm7 F7 | Fm7 Bb7 Ebmaj7 F7
Rhythm changes Bridge: D7 D7 G7 G7 | C7 C7 F7 F7
Minor blues (12-bar): i-7 iv-7 i-7 i-7 | iv-7 iv-7 i-7 V7 | iiø7 V7 i-7 V7
Modal (16-bar So What style): 8 bars min7, 4 bars min7 up half-step, 4 bars back

HARMONIC DEVICES (apply when requested or implied):
- Tritone sub: replace dom7 with dom7 a tritone away (6 semitones)
- Backdoor dominant: replace V7 with bVII7 before tonic arrival
- Secondary dominant: insert V7/X one bar before any diatonic chord
- ii-V insertion: prepend ii-7 before any dom7 chord
- Coltrane changes: replace ii-V-I with major-third cycle I→bIII→bVI→I
- Modal interchange: bVII7 (Mixolydian), iv-7 (Dorian), bIII maj7 (Phrygian)
- Tadd Dameron turnaround: end section with I bIII7 bVI7 II7 V7
- Deceptive cadence: V7 resolves to bVI instead of I
- Passing diminished: dim7 a half-step below the target chord

INFER FROM PROMPT: key, form length, tempo feel (ballad=60-80, medium swing=120-140, uptempo=200+), style, and harmonic devices. If a standard is referenced, use its harmonic DNA as a model. Apply all requested devices with correct jazz voice leading.

MELODY PATHS: Design the chord progression so that connected guide-tone paths can be derived from it, where successive target notes satisfy a maximum of 2 semitones of movement between bars. Prioritise ii-V-I root motion (Perfect 4th/5th) to exploit natural 7th→3rd half-step resolutions. Avoid chains of tritone-distant root movements that make smooth melodic voice-leading impossible.`

function extractJSON(text) {
  // Try direct parse first
  try { return JSON.parse(text) } catch {}
  // Try to find a JSON object in the text
  const match = text.match(/\{[\s\S]*\}/)
  if (match) {
    try { return JSON.parse(match[0]) } catch {}
  }
  throw new Error("Could not parse JSON from response")
}

const VALID_ROOTS = new Set(["C","Db","D","Eb","E","F","Gb","G","Ab","A","Bb","B"])
const VALID_QUALITIES = new Set(["maj7","min7","7","min7b5","dim7","7alt","maj6","min6"])

function validateChart(chart) {
  if (!chart.bars || !Array.isArray(chart.bars) || chart.bars.length === 0) {
    throw new Error("Chart must have at least one bar")
  }
  // Sanitize each bar
  chart.bars = chart.bars.map((bar, i) => {
    const root = VALID_ROOTS.has(bar.root) ? bar.root : "C"
    const quality = VALID_QUALITIES.has(bar.quality) ? bar.quality : "7"
    const suffixMap = {
      maj7:"maj7", min7:"m7", "7":"7", min7b5:"m7b5",
      dim7:"dim7", "7alt":"7alt", maj6:"6", min6:"m6"
    }
    const symbol = `${root}${suffixMap[quality]}`
    return {
      root,
      quality,
      symbol,
      section: bar.section || "A",
    }
  })
  return chart
}

// Pull the generationNotes value out of a partially-received JSON string.
// The schema emits generationNotes before the long bars array, so this lets the
// client show the model's reasoning while the chart is still being written.
function partialNotes(text) {
  const m = text.match(/"generationNotes"\s*:\s*"((?:[^"\\]|\\.)*)/)
  if (!m) return null
  // Drop a dangling escape so the fragment stays parseable mid-stream
  const body = m[1].replace(/\\$/, "")
  try { return JSON.parse(`"${body}"`) } catch { return body }
}

const MODEL = "claude-opus-4-6"

export async function POST(request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set. Add it to .env.local and restart the dev server." },
      { status: 500 }
    )
  }

  let prompt
  let wantStream = false
  try {
    const body = await request.json()
    prompt = body.prompt?.trim()
    wantStream = body.stream === true
    if (!prompt) throw new Error("No prompt provided")
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  // ── Streaming: server-sent events carrying notes as they arrive ──────────
  if (wantStream) {
    const encoder = new TextEncoder()
    const body = new ReadableStream({
      async start(controller) {
        const send = (obj) => {
          try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`)) } catch {}
        }
        let full = ""
        let lastNotes = ""
        try {
          const stream = client.messages.stream({
            model: MODEL,
            max_tokens: 4096,
            system: SYSTEM_PROMPT,
            messages: [{ role: "user", content: prompt }],
          })
          for await (const evt of stream) {
            if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
              full += evt.delta.text
              const notes = partialNotes(full)
              if (notes && notes !== lastNotes) {
                lastNotes = notes
                send({ type: "notes", text: notes })
              }
            }
          }
          send({ type: "done", chart: validateChart(extractJSON(full)) })
        } catch (err) {
          send({ type: "error", error: err?.message || "Generation failed" })
        } finally {
          controller.close()
        }
      },
    })
    return new Response(body, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    })
  }

  // ── Non-streaming (kept so the endpoint stays usable without SSE) ────────
  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    })

    const text = message.content[0]?.text ?? ""
    const raw = extractJSON(text)
    const chart = validateChart(raw)

    return NextResponse.json({ chart })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
