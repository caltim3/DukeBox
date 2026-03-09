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
  return (oct - 4) * 7 + (L[m[1]] ?? 2) - 2
}

function accidental(noteName) {
  if (!noteName) return null
  if (/^[A-G]b/.test(noteName)) return "♭"
  if (/^[A-G]#/.test(noteName)) return "♯"
  return null
}

// ─── Single notehead with stem, ledger lines, accidental, label ───────────────
function Notehead({ x, y, pos, color, label, labelAbove = false }) {
  const stemUp  = pos < 4
  const stemX   = stemUp ? x + 5.5 : x - 5.5
  const stemEnd = stemUp ? y - 32 : y + 32

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
  // Note name label: above stem-end when stem goes up, below when stem goes down
  const labelY = stemUp ? stemEnd - 6 : stemEnd + 14

  return (
    <g>
      {ledgers.map(lp => {
        const ly = y + (pos - lp) * 8
        return (
          <line key={lp} x1={x - 12} y1={ly} x2={x + 12} y2={ly}
            stroke="rgba(255,255,255,0.50)" strokeWidth="1.3" />
        )
      })}
      {acc && (
        <text x={x - 10} y={y + 5} fontSize="14"
          fontFamily="'Georgia', 'Times New Roman', serif"
          textAnchor="middle" fill={color} opacity="0.95">
          {acc}
        </text>
      )}
      {/* notehead */}
      <ellipse cx={x} cy={y} rx={6.5} ry={5}
        transform={`rotate(-15 ${x} ${y})`} fill={color} />
      {/* stem */}
      <line x1={stemX} y1={y} x2={stemX} y2={stemEnd}
        stroke={color} strokeWidth="1.6" />
      {/* note name label — floated to stem tip */}
      <text x={stemX + (stemUp ? -7 : 8)} y={labelY}
        textAnchor={stemUp ? "end" : "start"}
        fontSize="11" fontFamily="Arial, sans-serif"
        fontWeight="700" fill={color} opacity="0.95">
        {label || "—"}
      </text>
    </g>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function NotationLane({
  bars,
  activeIndex,
  onSelectBar,
  playheadIndex = null,
  barLabels = null,        // optional string[] — if omitted, falls back to 1-based index
}) {
  const STEP    = 8    // px per staff step
  const CLEF_W  = 52   // space reserved for treble clef
  const BAR_MIN = 120  // minimum bar width
  const R_PAD   = 24   // right padding

  // Vertical layout — leave room ABOVE the staff for chord name + bar number
  const HEADER_H = 50   // px above the top staff line
  const TOP      = HEADER_H   // y of the top staff line (F5)

  const n  = bars.length
  const totalW = Math.max(n * BAR_MIN + CLEF_W + R_PAD, 700)
  const bw = (totalW - CLEF_W - R_PAD) / Math.max(n, 1)
  const svgH = TOP + 10 * STEP + 24  // staff (10 steps) + small bottom pad

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
    <div style={{ overflowX: "auto", paddingBottom: "4px" }}>
      <svg width={totalW} height={svgH} style={{ display: "block" }}>

        {/* Background */}
        <rect x={0} y={0} width={totalW} height={svgH} rx={12}
          fill="rgba(4,4,18,0.72)" />

        {/* Five staff lines */}
        {staffLineYs.map((y, i) => (
          <line key={i} x1={CLEF_W - 10} y1={y} x2={totalW - R_PAD} y2={y}
            stroke="rgba(255,255,255,0.20)" strokeWidth="1" />
        ))}

        {/* Treble clef glyph */}
        <text x={4} y={staffBot + 18} fontSize="82"
          fontFamily="'Bravura','Noto Music','FreeSerif',Georgia,serif"
          fill="rgba(255,255,255,0.45)" dominantBaseline="auto">
          𝄞
        </text>

        {/* Opening double bar */}
        <line x1={CLEF_W - 9} y1={staffTop} x2={CLEF_W - 9} y2={staffBot}
          stroke="rgba(255,255,255,0.55)" strokeWidth="2.5" />
        <line x1={CLEF_W - 5} y1={staffTop} x2={CLEF_W - 5} y2={staffBot}
          stroke="rgba(255,255,255,0.25)" strokeWidth="1" />

        {/* Bar backgrounds, bar lines, bar numbers, chord symbols ABOVE staff */}
        {barData.map(({ i, bar, x0 }) => {
          const sel  = i === activeIndex
          const play = i === playheadIndex
          const label = barLabels ? barLabels[i] : String(i + 1)

          return (
            <g key={`bg-${i}`} onClick={() => onSelectBar(i)} style={{ cursor: "pointer" }}>
              {/* highlight strip spans full header + staff area */}
              <rect x={x0} y={0} width={bw} height={svgH}
                rx={4}
                fill={
                  play  ? "rgba(86,197,104,0.10)" :
                  sel   ? "rgba(224,180,76,0.12)"  : "transparent"
                } />

              {/* bar line on right edge */}
              <line x1={x0 + bw} y1={staffTop} x2={x0 + bw} y2={staffBot}
                stroke="rgba(255,255,255,0.20)" strokeWidth="1" />

              {/* Bar number — top of header */}
              <text x={x0 + 6} y={14}
                fontSize="10" fontFamily="Arial, sans-serif"
                fill={sel ? "rgba(255,235,150,0.9)" : "rgba(255,255,255,0.30)"}>
                {label}
              </text>

              {/* Chord symbol — large, above the staff, centered */}
              <text x={x0 + bw / 2} y={38}
                textAnchor="middle"
                fontSize="15" fontFamily="Arial, sans-serif" fontWeight="700"
                fill={
                  play ? "#8bd3a8"
                  : sel  ? "#f0d070"
                  : "rgba(255,255,255,0.88)"
                }>
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
            stroke="rgba(255,255,255,0.10)" strokeWidth="1.5"
            strokeDasharray="4 4" strokeLinejoin="round" />
        )}

        {/* Per-bar: slur + noteheads */}
        {barData.map(({ i, bar, arrX, arrY, arrP, depX, depY, depP }) => {
          const sel  = i === activeIndex
          const play = i === playheadIndex

          // Arrival = structural note for THIS chord → RED
          // Departure = leading tone toward NEXT chord → GREEN
          const arrColor = play ? "#8bd3a8"
                         : sel  ? "#ff6b6b"
                         : "#e05050"

          const depColor = play ? "#8bd3a8"
                         : sel  ? "#69e080"
                         : "#4caf7d"

          // Slur arc between the two notes
          const arcY = Math.min(arrY, depY) - 22
          const slur = `M ${arrX + 6} ${arrY - 6} Q ${(arrX + depX) / 2} ${arcY} ${depX - 6} ${depY - 6}`

          return (
            <g key={`n-${i}`} onClick={() => onSelectBar(i)} style={{ cursor: "pointer" }}>
              <path d={slur} fill="none"
                stroke="rgba(255,255,255,0.15)" strokeWidth="1.2" />
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
