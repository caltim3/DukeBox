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

// Scale degrees relative to the board's root. Transposition-invariant and what
// you actually think in mid-solo — a note name costs a read, a degree doesn't.
// 3 semitones renders as b3 rather than #9: minor chords are far commoner on
// this board than altered dominants, so that is the reading that is right more
// often.
const DEGREES = ["R", "b9", "9", "b3", "3", "11", "#11", "5", "b13", "13", "b7", "7"]

function degreeOf(noteName, rootName) {
  const a = NOTES_FLAT.indexOf(noteName)
  const b = NOTES_FLAT.indexOf(rootName)
  if (a < 0 || b < 0) return noteName
  return DEGREES[(a - b + 12) % 12]
}

// Every playable position on a neck, so callers can score fret windows without
// re-deriving the tuning maths.
export function fretPositions(tuningName = "Standard") {
  const strings = TUNINGS[tuningName] || TUNINGS.Standard
  const out = []
  strings.forEach((open, si) => {
    const openChroma = NOTES_FLAT.indexOf(norm(open))
    if (openChroma === -1) return
    for (let f = 0; f <= FRET_COUNT; f++) {
      out.push({ si, f, note: NOTES_FLAT[(openChroma + f) % 12] })
    }
  })
  return out
}

export const FRETBOARD_FRETS = FRET_COUNT

// A route is only drawn to a ghost this close. Beyond it the "shortest path"
// stops being a path you'd actually play, and the line lies about the fingering.
const MAX_ROUTE_FRETS   = 3
const MAX_ROUTE_STRINGS = 1

export default function Fretboard({ chordNotes = [], rootNote = "C", scaleNotes = null, view = "chord", tuningName = "Standard", targetNotes = [], passingNotes = [], guideToneNotes = [], guideToneDirections = null, enclosureNotes = [], ghostNotes = [], seventhNotes = [], labelMode = "names", ghostRootNote = null, focusStart = null, focusSpan = 4, animate = false, barSeconds = 0, phaseKey = null, zorroOn = false, zorroCells = null }) {
  // ZorroMode (the Pickup Music "3:2 System") takes the board over
  // completely when it's on and has something to show — it draws its own
  // two highways instead of the usual chord/scale dots, so every other
  // overlay below (ghosts, routes, the fret-focus window) sits out rather
  // than fighting it for the same neck. Off, or no shape for this chord
  // quality, and nothing here changes.
  const zorroActive = zorroOn && Array.isArray(zorroCells) && zorroCells.length > 0

  // The bar has a shape. Beats 1-2 the chord stands alone; beat 3 the ghosts
  // fade up and the routes start drawing; beat 4 the routes are at full and
  // everything that isn't a guide tone dims, so you are pulled into the change
  // instead of being surprised by it.
  //
  // Driven by CSS keyframes scaled to the bar's duration and remounted on
  // phaseKey — the same approach Runway uses for its fill bar. No animation
  // frame loop, no re-renders, and it stays on the compositor.
  const phaseOn = animate && barSeconds > 0
  const displayNotes = view === "scale" && scaleNotes?.length ? scaleNotes : chordNotes
  const noteSet    = new Set(displayNotes.map(n => norm(n)))
  const targetSet  = new Set((targetNotes  ?? []).map(n => norm(n)))
  const passingSet = new Set((passingNotes ?? []).map(n => norm(n)))
  const guideSet   = new Set((guideToneNotes ?? []).map(n => norm(n)))
  const enclosureSet = new Set((enclosureNotes ?? []).map(n => norm(n)))
  const ghostSet   = new Set((ghostNotes ?? []).map(n => norm(n)))
  const seventhSet = new Set((seventhNotes ?? []).map(n => norm(n)))
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
  let dots = []
  if (!zorroActive) strings.forEach((open, si) => {
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
      // Rank by what the note is *for*, not by what it is. A resolution target
      // and the guide tones outrank the root: the bass is already covering the
      // root, which makes it the least useful note on the screen to a soloist.
      const isTarget  = inTarget
      const isGuide   = !isTarget && inGuide
      const isPassing = !isTarget && !isGuide && inPassing
      const isEnclosure = !isTarget && !isGuide && !isPassing && inEnclosure
      const isRoot    = !isTarget && !isGuide && !isPassing && !isEnclosure && noteName === root
      // Color priority: resolution target > guide tone > bebop passing > enclosure > root > scale/chord
      // Fixed maple-note-role tokens (--n-*), never palette tokens — the board reads
      // the same on every palette (see docs/PRACTICE_REDESIGN_V3.md §4.7).
      // The 7th is a guide tone like the 3rd and the same size; only the hue
      // differs, so the pair reads as a pair without collapsing into one note.
      const isSeventh = (isGuide || isTarget) && seventhSet.has(noteName)
      const color = isSeventh ? "var(--n-seventh)"
                  : isTarget  ? "var(--n-target)"
                  : isGuide   ? "var(--n-target)"
                  : isPassing ? "var(--n-passing)"
                  : isEnclosure ? "var(--n-enclosure)"
                  : isRoot    ? "var(--n-root)"
                  : view === "scale" ? "var(--n-scale)"
                  : "var(--n-chord)"
      // Size carries the same ranking as colour, so the hierarchy survives in
      // peripheral vision and for anyone who can't separate the hues. Guide
      // tones and targets share --n-target, so size is what tells them apart.
      const r = isGuide ? 11 : isTarget ? 10 : isEnclosure ? 8 : 8.5
      // A guide tone the next chord also contains: nothing to move, so it gets
      // a ring rather than a route. "Stay put" is information worth drawing.
      const held = isGuide && ghostSet.has(noteName)
        && guideToneDirections?.[noteName] === 0
      dots.push({
        key:  `${si}-${f}`,
        cx:   dotX(f),
        cy:   strY(si),
        r,
        color,
        label: noteName,
        text: labelMode === "degrees" ? degreeOf(noteName, root) : noteName,
        si, f, held,
        isRoot, isTarget, isPassing, isGuide, isEnclosure,
      })
    }
  })

  // ZorroMode dots — two highways, each cell already resolved to an exact
  // string/fret by pentatonic32.js, so this just paints them: blue for the
  // 3-note group, red for the 2-note group, a gold ring on a minor shape's
  // root ("ring finger on the root").
  if (zorroActive) {
    const ZORRO_COLOR = { A: "var(--n-penta-a)", B: "var(--n-penta-b)" }
    dots = zorroCells.map(c => ({
      key: `z${c.si}-${c.f}`,
      cx: dotX(c.f),
      cy: strY(c.si),
      r: c.isRingRoot ? 10 : 8.5,
      color: ZORRO_COLOR[c.group] || "var(--n-penta-a)",
      label: c.noteName || c.text,
      text: c.text,
      si: c.si, f: c.f, held: false,
      isRoot: false, isTarget: false, isPassing: false, isGuide: false, isEnclosure: false,
      isZorroRing: !!c.isRingRoot,
    }))
  }

  // Render overlays last (root → enclosure → passing → guide → target) so the
  // notes that matter most always paint over the ones that matter least.
  dots.sort((a, b) => {
    const rank = d => d.isTarget ? 5 : d.isGuide ? 4 : d.isPassing ? 3 : d.isEnclosure ? 2 : d.isRoot ? 1 : 0
    return rank(a) - rank(b)
  })

  // ── Ghosts: the NEXT chord's guide tones, on this same neck ────────────────
  // Drawn here rather than on a second fretboard below, so there is no mental
  // register-mapping between two graphics at tempo. At the bar change they are
  // already where your eye is.
  const heldAt = new Set(dots.filter(d => d.held).map(d => `${d.si}:${d.f}`))
  const ghosts = []
  if (!zorroActive && ghostSet.size) {
    strings.forEach((open, si) => {
      const openChroma = NOTES_FLAT.indexOf(norm(open))
      if (openChroma === -1) return
      for (let f = 0; f <= FRET_COUNT; f++) {
        const noteName = NOTES_FLAT[(openChroma + f) % 12]
        if (!ghostSet.has(noteName)) continue
        if (heldAt.has(`${si}:${f}`)) continue   // the ring on the live dot says it already
        // A ghost's degree belongs to the chord it comes from, not this one —
        // labelling the next chord's 3rd against the current root would name it
        // something you'd never call it.
        const ghostText = labelMode === "degrees" && ghostRootNote
          ? degreeOf(noteName, norm(ghostRootNote))
          : noteName
        ghosts.push({ key: `g${si}-${f}`, cx: dotX(f), cy: strY(si), si, f, label: noteName, text: ghostText })
      }
    })
  }

  // ── Routes: the shortest playable path from each live guide tone to a ghost ─
  const routes = []
  if (ghosts.length && guideToneDirections) {
    for (const d of dots) {
      if (!d.isGuide || d.held) continue
      const semis = guideToneDirections[d.label]
      const dest  = guideToneDirections[`${d.label}:to`]
      if (semis == null || semis === 0 || !dest) continue
      const destNorm = norm(dest)
      let best = null, bestCost = Infinity
      for (const g of ghosts) {
        if (g.label !== destNorm) continue
        const df = Math.abs(g.f - d.f), ds = Math.abs(g.si - d.si)
        if (df > MAX_ROUTE_FRETS || ds > MAX_ROUTE_STRINGS) continue
        const cost = df + ds * 2.2          // crossing a string costs more than sliding a fret
        if (cost < bestCost) { bestCost = cost; best = g }
      }
      if (!best) continue
      const mx = (d.cx + best.cx) / 2
      const my = (d.cy + best.cy) / 2 - (d.si === best.si ? 15 : 10)
      routes.push({
        key: `r${d.key}`, fromKey: d.key,
        startFret: d.f, endFret: best.f,
        d: `M${d.cx},${d.cy} Q${mx},${my} ${best.cx},${best.cy}`,
        from: d.label, to: destNorm, semis,
      })
    }
  }

  // Where a route or a held ring already shows the resolution, the arrow glyph
  // would only repeat it. Suppressed per dot, not globally: in 3rd Hunter the
  // marked note is the lead-in, which is never a guide tone and never routed,
  // so its arrow has to survive.
  const drawnResolution = new Set([
    ...routes.map(r => r.fromKey),
    ...dots.filter(d => d.held).map(d => d.key),
  ])

  // Dimming only means something when something else stays lit. With no guide
  // tones or targets on the board there is nothing to step back for, and the
  // whole neck would fade out once a bar.
  const hasLitLayer = dots.some(d => d.isGuide || d.isTarget)

  // The fret focus window. Off (focusStart null) is the default so you can
  // roam. When on, everything outside dims rather than disappearing — you keep
  // your bearings, and the shapes you already know stay recognisable.
  //
  // ZorroMode still uses this: it swaps WHICH notes are drawn (the 3:2 shape
  // instead of chord/scale tones), not whether a window narrows the neck. Two
  // highways tile the whole board on their own (that's the point of the
  // octave copies), so without a window they cover almost every fret and the
  // page reads as "everywhere lit up" rather than "focused." page.js nudges
  // focusMode from Off to Auto the moment Zorro turns on for exactly this
  // reason — Zorro without a window isn't a focus mode.
  const focusOn = focusStart != null
  const focusLo = focusOn ? focusStart : 0
  const focusHi = focusOn ? focusStart + focusSpan : FRET_COUNT
  const inFocus = (f) => !focusOn || (f >= focusLo && f <= focusHi)
  const OUT_OF_FOCUS = 0.13
  const phaseDur = { animationDuration: `${barSeconds}s` }

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

      {phaseOn && (
        <style>{`
          .dbfb-ghost, .dbfb-route, .dbfb-dim {
            animation-timing-function: linear;
            animation-fill-mode: both;
          }
          .dbfb-ghost { animation-name: dbfbGhostIn }
          .dbfb-route { animation-name: dbfbRouteIn }
          .dbfb-dim   { animation-name: dbfbDim }

          /* Beats 1-2 nothing; the change arrives over beat 3. */
          @keyframes dbfbGhostIn {
            0%, 45%    { opacity: 0 }
            80%, 100%  { opacity: 0.85 }
          }
          /* The route draws itself along the neck across beats 3 and 4. */
          @keyframes dbfbRouteIn {
            0%, 55%    { stroke-dashoffset: 1; opacity: 0 }
            58%        { opacity: 0.95 }
            92%, 100%  { stroke-dashoffset: 0; opacity: 0.95 }
          }
          /* Beat 4: everything that isn't a guide tone gets out of the way. */
          @keyframes dbfbDim {
            0%, 70%    { opacity: 1 }
            100%       { opacity: 0.4 }
          }

          @media (prefers-reduced-motion: reduce) {
            .dbfb-ghost, .dbfb-route, .dbfb-dim { animation: none !important }
          }
        `}</style>
      )}

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

      {/* Wash over the wood outside the window. Sits above the frets and
          strings but under the dots, which manage their own opacity — the
          neck recedes while the shapes on it stay legible. */}
      {focusOn && (
        <g aria-hidden="true">
          {focusLo > 0 && (
            <rect x={NUT_X} y={2} width={Math.max(0, fretLineX(focusLo) - NUT_X)} height={H - 2}
              fill="var(--fb-nut)" opacity={0.55} />
          )}
          {focusHi < FRET_COUNT && (
            <rect x={fretLineX(focusHi)} y={2} width={Math.max(0, W - fretLineX(focusHi))} height={H - 2}
              fill="var(--fb-nut)" opacity={0.55} />
          )}
        </g>
      )}

      {/* Routes into the next chord — under the dots so they never hide a note */}
      <g key={`routes-${phaseKey}`}>
        {routes.map(r => (
          <path key={r.key} d={r.d} fill="none" stroke="var(--n-next)" strokeWidth={2.4} strokeLinecap="round"
            opacity={(inFocus(r.startFret) || inFocus(r.endFret)) ? 0.95 : 0}
            pathLength={1} strokeDasharray="1 1" strokeDashoffset={0}
            className={phaseOn ? "dbfb-route" : undefined} style={phaseOn ? phaseDur : undefined}>
            <title>{`${r.from} → ${r.to} · ${Math.abs(r.semis) === 1 ? "a semitone" : "a whole tone"} ${r.semis > 0 ? "up" : "down"}`}</title>
          </path>
        ))}
      </g>

      {/* Ghosts of the next chord's guide tones */}
      <g key={`ghosts-${phaseKey}`}>
        {ghosts.map(g => (
          <g key={g.key} opacity={inFocus(g.f) ? 0.85 : OUT_OF_FOCUS}
            className={phaseOn ? "dbfb-ghost" : undefined} style={phaseOn ? phaseDur : undefined}>
            <circle cx={g.cx} cy={g.cy} r={9.5} fill="var(--n-next-fill)" stroke="var(--n-next)" strokeWidth={2.2} />
            <text x={g.cx} y={g.cy + 3.2}
              textAnchor="middle" fill="var(--n-next)"
              fontSize={g.text.length > 2 ? 7 : 8} fontWeight="bold" fontFamily="Arial, sans-serif"
            >{g.text}</text>
            <title>{`${g.label} — guide tone of the next chord`}</title>
          </g>
        ))}
      </g>

      {/* Note dots */}
      <g key={`dots-${phaseKey}`}>
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
        const semis = (!zorroActive && guideToneDirections && !drawnResolution.has(d.key)) ? guideToneDirections[d.label] : null
        const goesTo = (!zorroActive && guideToneDirections) ? guideToneDirections[`${d.label}:to`] : null
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
        // Guide tones and targets hold their brightness through the bar; they
        // are what you are aiming at. Everything else steps back on beat 4.
        const dims = phaseOn && hasLitLayer && !d.isGuide && !d.isTarget
        return (
          <g key={d.key}
            opacity={inFocus(d.f) ? 1 : OUT_OF_FOCUS}
            className={dims ? "dbfb-dim" : undefined} style={dims ? phaseDur : undefined}>
            {glows && (
              <circle cx={d.cx} cy={d.cy} r={d.r + 4} fill="var(--n-target-glow)" filter="url(#fb-target-glow)" />
            )}
            <circle cx={d.cx} cy={d.cy} r={d.r} fill={d.color} stroke="#3D2A12" strokeWidth={d.isRoot ? 1.2 : 0.6} />
            {d.isEnclosure && (
              <circle cx={d.cx} cy={d.cy} r={d.r + 3} fill="none" stroke="var(--n-enclosure)" strokeWidth={1.4} strokeDasharray="3 2.5" />
            )}
            {/* ZorroMode minor root — "ring finger on the root" in the chart. */}
            {d.isZorroRing && (
              <circle cx={d.cx} cy={d.cy} r={d.r + 3} fill="none" stroke="var(--n-penta-ring)" strokeWidth={2}>
                <title>{`${d.label} — root, ring finger`}</title>
              </circle>
            )}
            {/* Held guide tone — the next chord has it too, so stay put. Drawn
                inside the dot rather than around it: strings are only ~23px
                apart, so a concentric ring would spill into its neighbours,
                and the enclosure ring already owns the outside of the dot. */}
            {d.held && (
              <circle cx={d.cx} cy={d.cy} r={d.r - 1.4}
                fill="none" stroke="var(--n-next)" strokeWidth={2.4}
                className={phaseOn ? "dbfb-ghost" : undefined} style={phaseOn ? phaseDur : undefined}>
                <title>{`${d.label} is in both chords — hold it`}</title>
              </circle>
            )}
            {glyph && <title>{`${d.label} → ${goesTo ?? "?"} · ${motionWord}`}</title>}
            <text x={d.cx} y={d.cy + 3.5}
              textAnchor="middle" fill="#FFFFFF"
              fontSize={d.text.length > 2 ? 7 : d.isRoot ? 9 : 8}
              fontWeight="bold" fontFamily="Arial, sans-serif"
            >{d.text}</text>
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
      </g>

    </svg>
  )
}
