"use client"

// ─── Staff position math (treble clef) ────────────────────────────────────────
// Bottom line = E4 = pos 0.  Each step = one diatonic step (line or space).
// Lines  (even): 0=E4  2=G4  4=B4  6=D5  8=F5
// Spaces (odd):  1=F4  3=A4  5=C5  7=E5

const L = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 }

function staffPos(noteName) {
  if (!noteName) return 4 // default B4
  const m = noteName.match(/^([A-G])([b#]?)(\d?)$/)
  if (!m) return 4
  const oct = m[3] ? parseInt(m[3]) : 4
  // pos relative to E4=0: (oct-4)*7 + letter_offset - 2  (E has offset 2)
  return (oct - 4) * 7 + (L[m[1]] ?? 2) - 2
}

function accidental(noteName) {
  if (!noteName) return null
  if (/^[A-G]b/.test(noteName)) return "♭"
  if (/^[A-G]#/.test(noteName)) return "♯"
  return null
}

// ─── Single notehead with stem, ledger lines, accidental, label ───────────────
function Notehead({ x, y, pos, color, label }) {
  const stemUp  = pos < 4
  const stemX   = stemUp ? x + 5.5 : x - 5.5
  const stemEnd = stemUp ? y - 30 : y + 30

  // Ledger lines for notes outside the 5-line staff
  const ledgers = []
  if (pos <= -2) {
    const start = pos % 2 === 0 ? pos : pos - 1
    for (let lp = start; lp <= -2; lp += 2) ledgers.push(lp)
  }
  if (pos >= 10) {
    const start = pos % 2 === 0 ? pos : pos + 1
    for (let lp = 10; lp <= start; lp += 2) ledgers.push(lp)
  }

  const acc = accidental(label)

  return (
    <g>
      {ledgers.map(lp => {
        const ly = y + (pos - lp) * 8  // relative offset (reused from caller's STEP=8)
        return (
          <line key={lp} x1={x - 11} y1={ly} x2={x + 11} y2={ly}
            stroke="rgba(255,255,255,0.55)" strokeWidth="1.2" />
        )
      })}
      {acc && (
        <text x={x - 9} y={y + 5} fontSize="14"
          fontFamily="'Georgia', 'Times New Roman', serif"
          textAnchor="middle" fill={color} opacity="0.9">
          {acc}
        </text>
      )}
      {/* notehead */}
      <ellipse cx={x} cy={y} rx={6} ry={4.5}
        transform={`rotate(-15 ${x} ${y})`} fill={color} />
      {/* stem */}
      <line x1={stemX} y1={y} x2={stemX} y2={stemEnd}
        stroke={color} strokeWidth="1.5" />
      {/* label */}
      <text x={x} y={stemUp ? y - 13 : stemEnd - 8} textAnchor="middle"
        fontSize="9.5" fontFamily="Arial, sans-serif" fill={color} opacity="0.7">
        {label || "—"}
      </text>
    </g>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function NotationLane({ bars, activeIndex, onSelectBar, playheadIndex = null }) {
  const STEP    = 8    // px per staff step
  const CLEF_W  = 52   // space reserved for treble clef
  const BAR_MIN = 110  // minimum bar width
  const R_PAD   = 24   // right padding
  const TOP     = 34   // y of top staff line (F5)

  const n  = bars.length
  const totalW = Math.max(n * BAR_MIN + CLEF_W + R_PAD, 700)
  const bw = (totalW - CLEF_W - R_PAD) / Math.max(n, 1)
  const svgH = TOP + 10 * STEP + 52  // staff + ledger room below + chord label room

  // Convert staff position to SVG y-coordinate
  const yAt = pos => TOP + (8 - pos) * STEP

  // Five staff lines: E4(0) G4(2) B4(4) D5(6) F5(8)
  const staffLineYs = [0, 2, 4, 6, 8].map(yAt)
  const staffTop    = staffLineYs[4]   // y of F5 (highest line)
  const staffBot    = staffLineYs[0]   // y of E4 (lowest line)

  // Per-bar computed positions
  const barData = bars.map((bar, i) => {
    const x0   = CLEF_W + i * bw
    const arrX = x0 + bw * 0.28
    const depX = x0 + bw * 0.68
    const arrP = staffPos(bar.arrivalNote)
    const depP = staffPos(bar.departureNote)
    return { i, bar, x0, arrX, depX, arrP, arrY: yAt(arrP), depP, depY: yAt(depP) }
  })

  // Dashed contour line through all notes in melodic order
  const contour = barData.flatMap(d => [`${d.arrX},${d.arrY}`, `${d.depX},${d.depY}`])

  return (
    <div style={{ overflowX: "auto", paddingBottom: "8px" }}>
      <svg width={totalW} height={svgH} style={{ display: "block" }}>

        {/* Background */}
        <rect x={0} y={0} width={totalW} height={svgH} rx={12}
          fill="rgba(4,4,18,0.6)" />

        {/* Five staff lines */}
        {staffLineYs.map((y, i) => (
          <line key={i} x1={CLEF_W - 10} y1={y} x2={totalW - R_PAD} y2={y}
            stroke="rgba(255,255,255,0.22)" strokeWidth="1" />
        ))}

        {/* Treble clef glyph */}
        <text x={4} y={staffBot + 16} fontSize="80"
          fontFamily="'Bravura','Noto Music','FreeSerif',Georgia,serif"
          fill="rgba(255,255,255,0.50)" dominantBaseline="auto">
          𝄞
        </text>

        {/* Opening double bar */}
        <line x1={CLEF_W - 9} y1={staffTop} x2={CLEF_W - 9} y2={staffBot}
          stroke="rgba(255,255,255,0.55)" strokeWidth="2.5" />
        <line x1={CLEF_W - 5} y1={staffTop} x2={CLEF_W - 5} y2={staffBot}
          stroke="rgba(255,255,255,0.25)" strokeWidth="1" />

        {/* Bar backgrounds, bar lines, bar numbers, chord symbols */}
        {barData.map(({ i, bar, x0 }) => {
          const sel  = i === activeIndex
          const play = i === playheadIndex
          return (
            <g key={`bg-${i}`} onClick={() => onSelectBar(i)} style={{ cursor: "pointer" }}>
              <rect x={x0} y={staffTop} width={bw} height={staffBot - staffTop}
                fill={
                  play  ? "rgba(139,211,168,0.12)" :
                  sel   ? "rgba(224,180,76,0.10)"  : "transparent"
                } />
              {/* bar line on right */}
              <line x1={x0 + bw} y1={staffTop} x2={x0 + bw} y2={staffBot}
                stroke="rgba(255,255,255,0.22)" strokeWidth="1" />
              {/* bar number */}
              <text x={x0 + 5} y={staffTop - 8} fontSize="9.5"
                fontFamily="Arial, sans-serif"
                fill={sel ? "#fff7db" : "rgba(255,255,255,0.35)"}>
                {i + 1}
              </text>
              {/* chord symbol */}
              <text x={x0 + bw / 2} y={svgH - 10} textAnchor="middle"
                fontSize="12" fontFamily="Arial, sans-serif"
                fill={play ? "#8bd3a8" : sel ? "#e0b44c" : "rgba(255,255,255,0.65)"}>
                {bar.chord}
              </text>
            </g>
          )
        })}

        {/* Closing double bar */}
        <line x1={totalW - R_PAD - 3} y1={staffTop} x2={totalW - R_PAD - 3} y2={staffBot}
          stroke="rgba(255,255,255,0.30)" strokeWidth="1" />
        <line x1={totalW - R_PAD} y1={staffTop} x2={totalW - R_PAD} y2={staffBot}
          stroke="rgba(255,255,255,0.55)" strokeWidth="3" />

        {/* Dashed melodic contour */}
        {contour.length > 2 && (
          <polyline points={contour.join(" ")} fill="none"
            stroke="rgba(255,255,255,0.12)" strokeWidth="1.5"
            strokeDasharray="4 4" strokeLinejoin="round" />
        )}

        {/* Per-bar: slur + noteheads */}
        {barData.map(({ i, bar, arrX, arrY, arrP, depX, depY, depP }) => {
          const sel  = i === activeIndex
          const play = i === playheadIndex

          const arrColor = play ? "#8bd3a8" : sel ? "#e0b44c" : "#c9a7ff"
          const depColor = play ? "#8bd3a8" : sel ? "#f0d48a" : "#8bd3a8"

          // Slur arc between the two notes (bows above both noteheads)
          const arcY = Math.min(arrY, depY) - 20
          const slur = `M ${arrX + 6} ${arrY - 5} Q ${(arrX + depX) / 2} ${arcY} ${depX - 6} ${depY - 5}`

          return (
            <g key={`n-${i}`} onClick={() => onSelectBar(i)} style={{ cursor: "pointer" }}>
              <path d={slur} fill="none"
                stroke="rgba(255,255,255,0.18)" strokeWidth="1.2" />
              <Notehead x={arrX} y={arrY} pos={arrP}
                color={arrColor} label={bar.arrivalNote} />
              <Notehead x={depX} y={depY} pos={depP}
                color={depColor} label={bar.departureNote} />
            </g>
          )
        })}
      </svg>
    </div>
  )
}
