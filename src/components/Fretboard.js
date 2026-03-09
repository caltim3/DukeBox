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
}

const FRET_COUNT   = 12
const MARKER_FRETS = [3, 5, 7, 9, 12]
const NUM_FRET_LABELS = [1, 3, 5, 7, 9, 12]

export default function Fretboard({ chordNotes = [], rootNote = "C", scaleNotes = null, view = "chord", tuningName = "Standard", targetNotes = [], passingNotes = [], guideToneNotes = [] }) {
  const displayNotes = view === "scale" && scaleNotes?.length ? scaleNotes : chordNotes
  const noteSet    = new Set(displayNotes.map(n => norm(n)))
  const targetSet  = new Set((targetNotes  ?? []).map(n => norm(n)))
  const passingSet = new Set((passingNotes ?? []).map(n => norm(n)))
  const guideSet   = new Set((guideToneNotes ?? []).map(n => norm(n)))
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
      if (!inChord && !inTarget && !inPassing && !inGuide) continue
      const isRoot    = noteName === root
      const isTarget  = !isRoot && inTarget
      const isPassing = !isRoot && !isTarget && inPassing
      const isGuide   = !isRoot && !isTarget && !isPassing && inGuide
      // Color priority: root > resolution target > bebop passing > guide tone > scale/chord
      const color = isRoot    ? "#BD2031"
                  : isTarget  ? "#E09B3D"   // amber  — resolution target note
                  : isPassing ? "#56C568"   // green  — bebop chromatic passing tone
                  : isGuide   ? "#FFD54F"   // gold   — guide tones (3rd / 7th)
                  : view === "scale" ? "#3A78C9"  // blue  — scale tone
                  : "#3A9C5A"               // green  — chord tone
      dots.push({
        key:  `${si}-${f}`,
        cx:   dotX(f),
        cy:   strY(si),
        r:    isRoot ? 10 : 9,
        color,
        label: noteName,
        isRoot, isTarget, isPassing, isGuide,
      })
    }
  })
  // Render overlays last (guide → passing → target) so they always paint over scale dots
  dots.sort((a, b) => {
    const rank = d => d.isTarget ? 3 : d.isPassing ? 2 : d.isGuide ? 1 : 0
    return rank(a) - rank(b)
  })

  const midY = Y_TOP + (STR_SPAN / 2)

  return (
    <svg viewBox={`0 0 ${W} ${H + 24}`} style={{ width: "100%", display: "block" }}>

      {/* Fretboard wood background */}
      <rect x={NUT_X} y={0} width={FRET_AREA} height={H} rx={3} fill="#18100A" />

      {/* String lines (thicker for lower strings) */}
      {strings.map((_, si) => (
        <line key={`s${si}`}
          x1={NUT_X - 2} y1={strY(si)} x2={W} y2={strY(si)}
          stroke="#8A7850" strokeWidth={0.6 + si * 0.22}
        />
      ))}

      {/* Fret lines (fret 0 = nut) */}
      {Array.from({ length: FRET_COUNT + 1 }, (_, f) => (
        <line key={`f${f}`}
          x1={fretLineX(f)} y1={Y_TOP - 5}
          x2={fretLineX(f)} y2={Y_TOP + STR_SPAN + 5}
          stroke={f === 0 ? "#8A6A50" : "#444"} strokeWidth={f === 0 ? 5 : 1.2}
        />
      ))}

      {/* Inlay markers */}
      {MARKER_FRETS.flatMap(f => {
        const x = NUT_X + (f - 0.5) * FRET_W
        if (f === 12) return [
          <circle key={`m${f}a`} cx={x} cy={midY - STR_SPAN * 0.22} r={4.5} fill="#3A2E20" />,
          <circle key={`m${f}b`} cx={x} cy={midY + STR_SPAN * 0.22} r={4.5} fill="#3A2E20" />,
        ]
        return [<circle key={`m${f}`} cx={x} cy={midY} r={4.5} fill="#3A2E20" />]
      })}

      {/* Fret number labels */}
      {NUM_FRET_LABELS.map(f => (
        <text key={`n${f}`}
          x={NUT_X + (f - 0.5) * FRET_W} y={LABEL_Y}
          textAnchor="middle" fill="#555" fontSize={10} fontFamily="Arial, sans-serif"
        >{f}</text>
      ))}

      {/* Open-string labels */}
      {strings.map((note, si) => (
        <text key={`sl${si}`}
          x={16} y={strY(si) + 4}
          textAnchor="middle" fill="#888" fontSize={10} fontFamily="Arial, sans-serif"
        >{note}</text>
      ))}

      {/* Note dots */}
      {dots.map(d => (
        <g key={d.key}>
          <circle cx={d.cx} cy={d.cy} r={d.r} fill={d.color} />
          <text x={d.cx} y={d.cy + 3.5}
            textAnchor="middle" fill="white"
            fontSize={d.isRoot ? 9 : 8} fontWeight="bold" fontFamily="Arial, sans-serif"
          >{d.label}</text>
        </g>
      ))}

    </svg>
  )
}
