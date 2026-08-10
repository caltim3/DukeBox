// Guitar fretboard component — adapted from Bebop Blueprint
// Shows chord tones or scale tones on a 6-string fretboard (SVG)

const NOTES_FLAT  = ["C","Db","D","Eb","E","F","Gb","G","Ab","A","Bb","B"]
const SHARP_TO_FLAT = { "C#":"Db","D#":"Eb","F#":"Gb","G#":"Ab","A#":"Bb","B#":"C","E#":"F","Cb":"B" }
function norm(n) { return SHARP_TO_FLAT[n] || n }

const TUNINGS = {
  Standard: ["E","A","D","G","B","E"],   // low → high
  "Drop D":  ["D","A","D","G","B","E"],
  "Open G":  ["D","G","D","G","B","D"],
  DADGAD:    ["D","A","D","G","A","D"],
  "Open D":  ["D","A","D","Gb","A","D"],
  "Open E":  ["E","B","E","Ab","B","E"],
}

const FRET_COUNT   = 12
const MARKER_FRETS = [3, 5, 7, 9, 12]
const NUM_FRET_LABELS = [1, 3, 5, 7, 9, 12]

export default function Fretboard({ chordNotes = [], rootNote = "C", scaleNotes = null, view = "chord", tuningName = "Standard", targetNotes = [], passingNotes = [], guideToneNotes = [], guideToneDirections = null, enclosureNotes = [] }) {
  const displayNotes = view === "scale" && scaleNotes?.length ? scaleNotes : chordNotes
  const noteSet    = new Set(displayNotes.map(n => norm(n)))
  const targetSet  = new Set((targetNotes  ?? []).map(n => norm(n)))
  const passingSet = new Set((passingNotes ?? []).map(n => norm(n)))
  const guideSet   = new Set((guideToneNotes ?? []).map(n => norm(n)))
  const enclosureSet = new Set((enclosureNotes ?? []).map(n => norm(n)))
  const root       = norm(rootNote)

  const strings     = TUNINGS[tuningName] || TUNINGS.Standard
  const numStrings  = strings.length

  // SVG coordinate constants
  const W          = 680
  const H          = 136
  const NUT_X      = 42         // left edge of nut
  const FRET_AREA  = W - NUT_X  // drawable fret width
  const FRET_W     = FRET_AREA / FRET_COUNT
  const STR_SPAN   = H - 20     // vertical spread of strings
  const Y_TOP      = 10         // y of highest string (string 5 = high E)
  const LABEL_Y    = H + 16     // fret-number label y

  function strY(i) { return Y_TOP + (numStrings - 1 - i) * (STR_SPAN / (numStrings - 1)) }
  function fretLineX(f) { return NUT_X + f * FRET_W }
  function dotX(f)      { return f === 0 ? NUT_X - 16 : NUT_X + (f - 0.5) * FRET_W }

  // Build note dot list
  const dots = []
  strings.forEach((open, si) => {
    const openNorm   = norm(open)
    const openChroma = NOTES_FLAT.indexOf(openNorm)
    if (openChroma === -1) return
    for (let f = 0; f <= FRET_COUNT; f++) {
      const noteName = NOTES_FLAT[(openChroma + f) % 12]
      const inChord   = noteSet.has(noteName)
      const inTarget  = targetSet.has(noteName)
      const inPassing = passingSet.has(noteName)
      const inGuide   = guideSet.has(noteName)
      const inEnclosure = enclosureSet.has(noteName)
      if (!inChord && !inTarget && !inPassing && !inGuide && !inEnclosure) continue
      const isRoot    = noteName === root
      const isTarget  = !isRoot && inTarget
      const isPassing = !isRoot && !isTarget && inPassing
      const isGuide   = !isRoot && !isTarget && !isPassing && inGuide
      const isEnclosure = !isRoot && !isTarget && !isPassing && !isGuide && inEnclosure
      // Color priority: root > resolution target > bebop passing > guide tone > enclosure > scale/chord
      // Fixed maple-note-role tokens (--n-*), never palette tokens — the board reads
      // the same on every palette (see docs/PRACTICE_REDESIGN_V3.md §4.7).
      const color = isRoot    ? "var(--n-root)"
                  : isTarget  ? "var(--n-target)"
                  : isPassing ? "var(--n-passing)"
                  : isGuide   ? "var(--n-target)"
                  : isEnclosure ? "var(--n-enclosure)"
                  : view === "scale" ? "var(--n-scale)"
                  : "var(--n-chord)"
      dots.push({
        key:  `${si}-${f}`,
        cx:   dotX(f),
        cy:   strY(si),
        r:    isRoot ? 10 : isEnclosure ? 8 : 9,
        color,
        label: noteName,
        isRoot, isTarget, isPassing, isGuide, isEnclosure,
      })
    }
  })
  // Render overlays last (enclosure → guide → passing → target) so they always paint over scale dots
  dots.sort((a, b) => {
    const rank = d => d.isTarget ? 4 : d.isPassing ? 3 : d.isGuide ? 2 : d.isEnclosure ? 1 : 0
    return rank(a) - rank(b)
  })

  const midY = Y_TOP + (STR_SPAN / 2)

  return (
    <svg viewBox={`0 0 ${W} ${H + 24}`} style={{ width: "100%", display: "block" }}>
      {/* Maple wood + note-role colors below all read from the constant --fb- and --n-
          tokens (globals.css :root), never from the active palette — the board looks
          identical no matter which of the six palettes is selected (spec §4.7). */}
      <defs>
        <linearGradient id="fb-maple" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--fb-wood-1)" />
          <stop offset="100%" stopColor="var(--fb-wood-2)" />
        </linearGradient>
        <filter id="fb-target-glow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="3.2" />
        </filter>
      </defs>

      {/* Fretboard wood background */}
      <rect x={NUT_X} y={0} width={FRET_AREA} height={H} rx={3} fill="url(#fb-maple)" stroke="var(--fb-nut)" strokeWidth={1} />

      {/* String lines (thicker for lower strings) */}
      {strings.map((_, si) => (
        <line key={`s${si}`}
          x1={NUT_X - 2} y1={strY(si)} x2={W} y2={strY(si)}
          stroke="var(--fb-string)" strokeWidth={0.6 + si * 0.22}
        />
      ))}

      {/* Fret lines (fret 0 = nut) */}
      {Array.from({ length: FRET_COUNT + 1 }, (_, f) => (
        <line key={`f${f}`}
          x1={fretLineX(f)} y1={Y_TOP - 5}
          x2={fretLineX(f)} y2={Y_TOP + STR_SPAN + 5}
          stroke={f === 0 ? "var(--fb-nut)" : "var(--fb-fret)"} strokeWidth={f === 0 ? 5 : 1.2}
        />
      ))}

      {/* Inlay markers */}
      {MARKER_FRETS.flatMap(f => {
        const x = NUT_X + (f - 0.5) * FRET_W
        if (f === 12) return [
          <circle key={`m${f}a`} cx={x} cy={midY - STR_SPAN * 0.22} r={4.5} fill="var(--fb-inlay)" opacity={0.35} />,
          <circle key={`m${f}b`} cx={x} cy={midY + STR_SPAN * 0.22} r={4.5} fill="var(--fb-inlay)" opacity={0.35} />,
        ]
        return [<circle key={`m${f}`} cx={x} cy={midY} r={4.5} fill="var(--fb-inlay)" opacity={0.35} />]
      })}

      {/* Fret number labels */}
      {NUM_FRET_LABELS.map(f => (
        <text key={`n${f}`}
          x={NUT_X + (f - 0.5) * FRET_W} y={LABEL_Y}
          textAnchor="middle" fill="var(--fb-labels)" fontSize={10} fontFamily="Arial, sans-serif"
        >{f}</text>
      ))}

      {/* Open-string labels */}
      {strings.map((note, si) => (
        <text key={`sl${si}`}
          x={16} y={strY(si) + 4}
          textAnchor="middle" fill="var(--fb-labels)" fontSize={10} fontFamily="Arial, sans-serif"
        >{note}</text>
      ))}

      {/* Note dots */}
      {dots.map(d => {
        // How this guide tone resolves into the next chord.
        // One arrow per semitone, pointing the way the note moves in pitch —
        // right for higher, left for lower, which is also the direction you
        // move along the neck:
        //     →   up a semitone        ←   down a semitone
        //     →→  up a whole tone      ←←  down a whole tone
        //     =   common tone (stays put)
        // Nothing further than a whole tone is marked at all; a bigger leap
        // isn't a resolution, so labelling it was worse than staying quiet.
        // The arrow is keyed off the note name alone, not the dot's role: in
        // 3rd Hunter the note that moves is the lead-in (drawn in the approach
        // colour), while the lit guide tone is the chord's own 3rd and stays
        // unmarked.
        const semis = guideToneDirections ? guideToneDirections[d.label] : null
        const goesTo = guideToneDirections ? guideToneDirections[`${d.label}:to`] : null
        let glyph = null
        if (semis != null) {
          const n = Math.abs(semis)
          glyph = n === 0 ? "=" : (semis > 0 ? "→" : "←").repeat(n)
        }
        const motionWord = semis == null ? ""
          : semis === 0 ? "stays"
          : `${Math.abs(semis) === 1 ? "a semitone" : "a whole tone"} ${semis > 0 ? "up" : "down"}`
        // Target/guide-tone dots pulse with a soft glow, same as every palette —
        // the glow color is a constant token too (--n-target-glow).
        const glows = d.isTarget || d.isGuide
        return (
          <g key={d.key}>
            {glows && (
              <circle cx={d.cx} cy={d.cy} r={d.r + 4} fill="var(--n-target-glow)" filter="url(#fb-target-glow)" />
            )}
            <circle cx={d.cx} cy={d.cy} r={d.r} fill={d.color} stroke="#3D2A12" strokeWidth={d.isRoot ? 1.2 : 0.6} />
            {d.isEnclosure && (
              <circle cx={d.cx} cy={d.cy} r={d.r + 3} fill="none" stroke="var(--n-enclosure)" strokeWidth={1.4} strokeDasharray="3 2.5" />
            )}
            {glyph && <title>{`${d.label} → ${goesTo ?? "?"} · ${motionWord}`}</title>}
            <text x={d.cx} y={d.cy + 3.5}
              textAnchor="middle" fill="#FFFFFF"
              fontSize={d.isRoot ? 9 : 8} fontWeight="bold" fontFamily="Arial, sans-serif"
            >{d.label}</text>
            {glyph && (
              <text x={d.cx} y={d.cy - d.r - 2.5}
                textAnchor="middle" fontSize={12.5} fontWeight="bold"
                fontFamily="Arial, sans-serif" letterSpacing="-1.5"
                fill="var(--n-target)" stroke="var(--fb-wood-1)" strokeWidth="0.9" paintOrder="stroke"
              >{glyph}</text>
            )}
          </g>
        )
      })}

    </svg>
  )
}
