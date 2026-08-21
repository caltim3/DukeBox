// Phrase Machine — the block-grammar bebop phrase generator, ported from the
// standalone phrase-machine_5.html prototype (docs/phrase-machine-docs.md,
// docs/phrase-machine_5.html) into a pure ES module for Line Lab's "Phrase
// Machine" source.
//
// This file is the "phrase-engine.js" the docs' own "Suggested refactor for
// module extraction" section describes: no DOM, no ABCJS, no audio. Its
// output — { notes, blockLog, targetEighths, prog } — has no `abc` string,
// unlike the prototype's PhraseResult: DukeBox doesn't render ABC at all, so
// building one is dropped entirely. src/lib/music/phraseAdapter.js converts
// this module's output into DukeBox's own line schema instead (the notation,
// TAB, fretboard walkthrough, playback, transpose, and MusicXML export
// already used by Chart/Network/Licktionary sources).
//
// Two DOM reads from the prototype are gone, per its own "Open Items" list:
//   - runGenerator's document.getElementById('sel-land') read is now a
//     `landing` parameter (default "and3", the prototype's own default).
//   - The prototype's getSlotForPosition() re-read the prog/key selects and
//     re-transposed the progression on every call. The version here takes
//     the already-transposed `prog` as a parameter instead — same lookup,
//     no DOM, no redundant re-transposition.
//
// Exports are prefixed PM_ where a bare name (NOTES, CHORD_DATA,
// PROGRESSIONS) would be easy to mistake for tonal.js's own very different
// data shapes when the two files are open side by side.

// ─── Notes, chords, progressions ───────────────────────────────────────────

export const PM_NOTES = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]

// Wrap a semitone index into 0..11. Every pitch-class computation in this
// module goes through this — block functions freely add/subtract semitones
// and index back into PM_NOTES with the result.
export function mod12(n) {
  return ((n % 12) + 12) % 12
}

export function transposeNote(note, semitones) {
  const i = PM_NOTES.indexOf(note)
  return i < 0 ? note : PM_NOTES[mod12(i + semitones)]
}

// tones: chord tones as semitones above root. bop: the 8-note bebop scale
// (chord tones + passing tones) block functions draw scale runs and cells
// from.
export const PM_CHORD_DATA = {
  maj7:    { tones: [0, 4, 7, 11], bop: [0, 2, 4, 5, 7, 9, 11, 10] },
  m7:      { tones: [0, 3, 7, 10], bop: [0, 2, 3, 5, 7, 9, 10, 11] },
  dom7:    { tones: [0, 4, 7, 10], bop: [0, 2, 4, 5, 7, 9, 10, 11] },
  m7b5:    { tones: [0, 3, 6, 10], bop: [0, 2, 3, 5, 6, 9, 10, 11] },
  dom7alt: { tones: [0, 4, 6, 10], bop: [0, 1, 3, 4, 6, 8, 10, 11] }, // Ab melodic minor
  m6:      { tones: [0, 3, 7, 9],  bop: [0, 2, 3, 5, 7, 9, 11] },
}

// beats are in eighth-note units (a 4/4 bar = 8).
export const PM_PROGRESSIONS = {
  major251: {
    label: "Major ii-V-I",
    chords: [
      { symbol: "Dm7", root: "D", type: "m7", slot: "ii", beats: 8 },
      { symbol: "G7", root: "G", type: "dom7", slot: "V", beats: 8 },
      { symbol: "Cmaj7", root: "C", type: "maj7", slot: "I", beats: 8 },
    ],
  },
  minor251: {
    label: "Minor ii-V-i",
    chords: [
      { symbol: "Dm7b5", root: "D", type: "m7b5", slot: "ii", beats: 8 },
      { symbol: "G7alt", root: "G", type: "dom7alt", slot: "V", beats: 8 },
      { symbol: "Cm6", root: "C", type: "m6", slot: "I", beats: 8 },
    ],
  },
  jazz_blues: {
    label: "Jazz Blues",
    chords: [
      { symbol: "C7", root: "C", type: "dom7", slot: "I", beats: 8 },
      { symbol: "F7", root: "F", type: "dom7", slot: "IV", beats: 8 },
      { symbol: "C7", root: "C", type: "dom7", slot: "I", beats: 8 },
      { symbol: "G7", root: "G", type: "dom7", slot: "V", beats: 8 },
      { symbol: "F7", root: "F", type: "dom7", slot: "IV", beats: 4 },
      { symbol: "C7", root: "C", type: "dom7", slot: "I", beats: 4 },
    ],
  },
  autumn: {
    label: "Autumn Leaves",
    chords: [
      { symbol: "Cm7", root: "C", type: "m7", slot: "ii", beats: 8 },
      { symbol: "F7", root: "F", type: "dom7", slot: "V", beats: 8 },
      { symbol: "BbM7", root: "Bb", type: "maj7", slot: "I", beats: 8 },
      { symbol: "Am7b5", root: "A", type: "m7b5", slot: "ii", beats: 8 },
      { symbol: "D7alt", root: "D", type: "dom7alt", slot: "V", beats: 8 },
      { symbol: "Gm7", root: "G", type: "m7", slot: "I", beats: 8 },
    ],
  },
}

// Transposes every chord in a progression by the semitone distance from C to
// `key`. rawProg is PM_PROGRESSIONS[x].chords.
export function transposeProgression(rawProg, key) {
  const off = PM_NOTES.indexOf(key)
  return rawProg.map((ch) => ({
    ...ch,
    root: PM_NOTES[mod12(PM_NOTES.indexOf(ch.root) + off)],
    symbol: ch.symbol.replace(/^[A-G][b#]?/, PM_NOTES[mod12(PM_NOTES.indexOf(ch.root) + off)]),
  }))
}

export function getChordTones(root, type) {
  const ri = PM_NOTES.indexOf(root)
  return PM_CHORD_DATA[type].tones.map((s) => PM_NOTES[mod12(ri + s)])
}

export function getBopScale(root, type) {
  const ri = PM_NOTES.indexOf(root)
  return PM_CHORD_DATA[type].bop.map((s) => PM_NOTES[mod12(ri + s)])
}

export function getDimNotes(root) {
  const ri = PM_NOTES.indexOf(root)
  return [0, 3, 6, 9].map((s) => PM_NOTES[mod12(ri + s)])
}

// LCG — deterministic, so a given seed always regenerates the same phrase
// (a saved phrase's `seed` field can reproduce it exactly).
export function seededRand(seed) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 4294967296
  }
}

// ─── Block vocabulary ───────────────────────────────────────────────────────
// Each block is a pure function (root, chord, variation, rng) -> Note[],
// Note = { note, dur, triplet?, tgroup? }. dur is in eighth-note units (see
// BLOCK_EIGHTH_DURATION below); triplet-flagged notes compress to 2/3 that
// nominal duration in real time (phraseAdapter.js's job, not this module's).

function encStd(r, c) {
  const ct = getChordTones(r, c.type)
  const ti = PM_NOTES.indexOf(ct[0])
  return [{ note: PM_NOTES[mod12(ti + 2)], dur: 1 }, { note: PM_NOTES[mod12(ti - 1)], dur: 1 }, { note: ct[0], dur: 2 }]
}
function encDbl(r, c) {
  const ct = getChordTones(r, c.type)
  const ti = PM_NOTES.indexOf(ct[0])
  return [
    { note: PM_NOTES[mod12(ti + 1)], dur: 1 }, { note: PM_NOTES[mod12(ti - 2)], dur: 1 },
    { note: PM_NOTES[mod12(ti - 1)], dur: 1 }, { note: ct[0], dur: 1 },
  ]
}
function encChrom(r, c) {
  const ct = getChordTones(r, c.type)
  const ti = PM_NOTES.indexOf(ct[0])
  return [
    { note: PM_NOTES[mod12(ti - 3)], dur: 1 }, { note: PM_NOTES[mod12(ti - 2)], dur: 1 },
    { note: PM_NOTES[mod12(ti - 1)], dur: 1 }, { note: ct[0], dur: 1 },
  ]
}
function arpRootUp(r, c) {
  return getChordTones(r, c.type).map((n) => ({ note: n, dur: 2 }))
}
function arpRootDown(r, c) {
  return [...getChordTones(r, c.type)].reverse().map((n) => ({ note: n, dur: 2 }))
}
function arp3rdUp(r, c) {
  const ct = getChordTones(r, c.type)
  const ri = PM_NOTES.indexOf(r)
  const ninth = PM_NOTES[mod12(ri + 14)]
  return [ct[1], ct[2], ct[3], ninth].map((n) => ({ note: n, dur: 2 }))
}
function arpDimUp(r, c) {
  const ct = getChordTones(r, c.type)
  return getDimNotes(ct[1]).map((n) => ({ note: n, dur: 2 }))
}
function arpDimDown(r, c) {
  return [...getDimNotes(getChordTones(r, c.type)[1])].reverse().map((n) => ({ note: n, dur: 2 }))
}
function arpShellUp(r, c) {
  const ct = getChordTones(r, c.type)
  const ninth = PM_NOTES[mod12(PM_NOTES.indexOf(r) + 14)]
  return [ct[1], ct[3], ninth, ct[1]].map((n) => ({ note: n, dur: 2 }))
}
function arpUpperStruct(r) {
  const ri = PM_NOTES.indexOf(r)
  const sub = PM_NOTES[mod12(ri + 6)]
  const si = PM_NOTES.indexOf(sub)
  return [sub, PM_NOTES[mod12(si + 4)], PM_NOTES[mod12(si + 7)], sub].map((n) => ({ note: n, dur: 2 }))
}
function scaleBopDown(r, c) {
  return [...getBopScale(r, c.type)].reverse().map((n) => ({ note: n, dur: 1 }))
}
function scaleBopUp(r, c) {
  return getBopScale(r, c.type).map((n) => ({ note: n, dur: 1 }))
}
function scaleMajDown(r, c, v, rng) {
  const sc = getBopScale(r, c.type)
  const len = 4 + Math.floor((rng() || 0.5) * 4)
  return sc.slice(0, len).reverse().map((n) => ({ note: n, dur: 1 }))
}
function scaleMMDown(r, c) {
  const ri = PM_NOTES.indexOf(r)
  const mr = c.type === "dom7alt" ? PM_NOTES[mod12(ri - 2)] : r
  const mri = PM_NOTES.indexOf(mr)
  return [0, 2, 3, 5, 7, 9, 11].map((s) => PM_NOTES[mod12(mri + s)]).reverse().map((n) => ({ note: n, dur: 1 }))
}
function scaleHWDim(r) {
  const ri = PM_NOTES.indexOf(r)
  return [0, 1, 3, 4, 6, 7, 9, 10].map((s) => ({ note: PM_NOTES[mod12(ri + s)], dur: 1 }))
}
function scaleChromDown(r) {
  const ri = PM_NOTES.indexOf(r)
  return [0, 11, 10, 9, 8, 7, 6].map((s) => ({ note: PM_NOTES[mod12(ri + s)], dur: 1 }))
}
function scalePentDown(r) {
  const ri = PM_NOTES.indexOf(r)
  return [0, 3, 5, 7, 10].map((s) => PM_NOTES[mod12(ri + s)]).reverse().map((n) => ({ note: n, dur: 1 }))
}
function cell1235(r, c) {
  const sc = getBopScale(r, c.type)
  return [sc[0], sc[1], sc[2], sc[4]].map((n) => ({ note: n, dur: 2 }))
}
function cell5321(r, c) {
  const sc = getBopScale(r, c.type)
  return [sc[4], sc[2], sc[1], sc[0]].map((n) => ({ note: n, dur: 2 }))
}
function cellB7R53(r, c) {
  const ct = getChordTones(r, c.type)
  return [ct[3], ct[0], ct[2], ct[1]].map((n) => ({ note: n, dur: 2 }))
}
function cell3217(r, c) {
  const sc = getBopScale(r, c.type)
  return [sc[2], sc[1], sc[0], sc[6] || sc[5]].map((n) => ({ note: n, dur: 2 }))
}
function cellB9(r) {
  const ri = PM_NOTES.indexOf(r)
  const b9 = PM_NOTES[mod12(ri + 1)]
  const bi = PM_NOTES.indexOf(b9)
  return [b9, PM_NOTES[mod12(bi + 2)], PM_NOTES[mod12(bi + 3)], PM_NOTES[mod12(bi + 7)]].map((n) => ({ note: n, dur: 2 }))
}
function cellBebopLick(r, c) {
  const sc = getBopScale(r, c.type)
  return [sc[2], sc[1], sc[0], sc[6] || sc[5], sc[0], sc[2], sc[4], sc[6] || sc[5]].map((n) => ({ note: n, dur: 1 }))
}
function pivot3rdUp(r, c) {
  const ri = PM_NOTES.indexOf(r)
  const ct = getChordTones(r, c.type)
  const sc = getBopScale(r, c.type)
  const ninth = PM_NOTES[mod12(ri + 14)]
  const up = [ct[1], ct[2], ct[3], ninth].map((n) => ({ note: n, dur: 1 }))
  const ni = sc.indexOf(ninth) >= 0 ? sc.indexOf(ninth) : sc.length - 1
  const down = []
  for (let i = Math.min(ni, sc.length - 1); i >= Math.max(0, ni - 3); i--) down.push({ note: sc[i], dur: 1 })
  return [...up, ...down]
}
function pivot3rdDown(r, c) {
  const ct = getChordTones(r, c.type)
  const sc = getBopScale(r, c.type)
  const ninth = PM_NOTES[mod12(PM_NOTES.indexOf(r) + 14)]
  return [[ninth, ct[3], ct[2], ct[1]], ...sc.slice(0, 4)].flat().map((n) => (typeof n === "string" ? { note: n, dur: 1 } : n))
}
function pivotRootUp(r, c) {
  const ct = getChordTones(r, c.type)
  const sc = getBopScale(r, c.type)
  return [...ct.map((n) => ({ note: n, dur: 1 })), ...sc.slice(0, 4).reverse().map((n) => ({ note: n, dur: 1 }))]
}
function triadPairUU(r, c) {
  const ct = getChordTones(r, c.type)
  const t1 = [ct[1], ct[2], ct[3]]
  const ri2 = PM_NOTES.indexOf(ct[3])
  const t2 = [ct[3], PM_NOTES[mod12(ri2 + 4)], PM_NOTES[mod12(ri2 + 7)]]
  return [...t1, ...t2].slice(0, 6).map((n) => ({ note: n, dur: 2 })).concat({ note: ct[0], dur: 2 })
}
function triadSubTT(r) {
  const ri = PM_NOTES.indexOf(r)
  const sub = PM_NOTES[mod12(ri + 6)]
  const si = PM_NOTES.indexOf(sub)
  return [sub, PM_NOTES[mod12(si + 4)], PM_NOTES[mod12(si + 7)], sub].map((n) => ({ note: n, dur: 2 }))
}
function triadMMPair(r) {
  const ri = PM_NOTES.indexOf(r)
  const db = PM_NOTES[mod12(ri - 1)]
  const dbi = PM_NOTES.indexOf(db)
  const eb = PM_NOTES[mod12(ri + 3)]
  const ebi = PM_NOTES.indexOf(eb)
  return [
    [db, PM_NOTES[mod12(dbi + 4)], PM_NOTES[mod12(dbi + 7)]],
    [eb, PM_NOTES[mod12(ebi + 4)], PM_NOTES[mod12(ebi + 7)]],
  ].flat().map((n) => ({ note: n, dur: 1 }))
}
function tripTriadChain(r, c) {
  const sc = getBopScale(r, c.type)
  const ns = []
  let b = 0
  for (let g = 0; g < 4; g++) {
    for (let k = 0; k < 3; k++) ns.push({ note: sc[(b + k) % sc.length], dur: 1, triplet: true, tgroup: g })
    b = (b + 2) % sc.length
  }
  return ns
}
function tripDimChain(r, c) {
  const ct = getChordTones(r, c.type)
  const dim = getDimNotes(ct[1])
  const ns = []
  for (let g = 0; g < 4; g++) {
    for (let k = 0; k < 3; k++) ns.push({ note: dim[(g + k) % 4], dur: 1, triplet: true, tgroup: g })
  }
  return ns
}
function tripBurstRest(r, c) {
  const ct = getChordTones(r, c.type)
  return [
    { note: ct[0], dur: 1, triplet: true, tgroup: 0 }, { note: ct[1], dur: 1, triplet: true, tgroup: 0 },
    { note: ct[2], dur: 1, triplet: true, tgroup: 0 }, { note: "z", dur: 4 },
  ]
}
function landAnd1(root) { return [{ note: root, dur: 1 }, { note: "z", dur: 2 }] }
function landAnd3(root) { return [{ note: "z", dur: 4 }, { note: root, dur: 1 }, { note: "z", dur: 2 }] }
function landHold(root) { return [{ note: root, dur: 6 }] }
function landLate3(root) { return [{ note: "z", dur: 4 }, { note: root, dur: 4 }] }

export const BLOCK_FNS = {
  enclosure_std: encStd, enclosure_dbl: encDbl, enclosure_chrom: encChrom,
  enclosure_above: (r, c) => {
    const ti = PM_NOTES.indexOf(getChordTones(r, c.type)[0])
    return [
      { note: PM_NOTES[mod12(ti + 2)], dur: 1 }, { note: PM_NOTES[mod12(ti + 1)], dur: 1 },
      { note: PM_NOTES[mod12(ti + 2)], dur: 1 }, { note: PM_NOTES[mod12(ti)], dur: 1 },
    ]
  },
  pickup_scale: (r, c) => getBopScale(r, c.type).slice(0, 2).map((n) => ({ note: n, dur: 1 })),
  pickup_chrom: (r) => {
    const ri = PM_NOTES.indexOf(r)
    return [PM_NOTES[mod12(ri - 2)], PM_NOTES[mod12(ri - 1)]].map((n) => ({ note: n, dur: 1 }))
  },
  arp_root_up: arpRootUp, arp_root_down: arpRootDown, arp_3rd_up: arp3rdUp,
  arp_3rd_down: (r, c, v, rng) => [...arp3rdUp(r, c, v, rng)].reverse(),
  arp_dim_up: arpDimUp, arp_dim_down: arpDimDown,
  arp_shell_up: arpShellUp, arp_upper_struct: arpUpperStruct,
  scale_bop_down: scaleBopDown, scale_bop_up: scaleBopUp, scale_major_down: scaleMajDown,
  scale_mm_down: scaleMMDown, scale_mm_up: (r, c, v, rng) => [...scaleMMDown(r, c, v, rng)].reverse(),
  scale_hw_dim: scaleHWDim, scale_chrom_down: scaleChromDown, scale_pent_down: scalePentDown,
  cell_1235: cell1235, cell_5321: cell5321, cell_b7R53: cellB7R53, cell_3217: cell3217,
  cell_b9cell: cellB9, cell_bebop_lick: cellBebopLick,
  pivot_3rd_up: pivot3rdUp, pivot_3rd_down: pivot3rdDown, pivot_root_up: pivotRootUp,
  triad_pair_uu: triadPairUU, triad_sub_tt: triadSubTT, triad_mm_pair: triadMMPair,
  trip_triad_chain: tripTriadChain, trip_dim_chain: tripDimChain, trip_burst_rest: tripBurstRest,
  land_and1: (r) => landAnd1(r), land_and3: (r) => landAnd3(r),
  land_hold: (r) => landHold(r), land_beat3_late: (r) => landLate3(r),
}

const CAT_PREFIX_MAP = {
  enclosure: "opener", pickup: "opener", arp: "arp", scale: "scale", triad: "triad",
  cell: "cell", pivot: "pivot", trip: "triplet", land: "rhythm", rest: "rhythm", silence: "opener",
}

export const BLOCK_CAT = {}
Object.keys(BLOCK_FNS).forEach((k) => {
  const cat = Object.entries(CAT_PREFIX_MAP).find(([prefix]) => k.startsWith(prefix))
  BLOCK_CAT[k] = cat ? cat[1] : "rhythm"
})

export const BLOCK_LABELS = {
  enclosure_std: "Encl std", enclosure_dbl: "Encl dbl", enclosure_chrom: "Encl chrom", enclosure_above: "Encl above",
  pickup_scale: "Pickup scale", pickup_chrom: "Pickup chrom",
  arp_root_up: "Root ↑", arp_root_down: "Root ↓", arp_3rd_up: "3rd ↑", arp_3rd_down: "3rd ↓",
  arp_dim_up: "Dim7 ↑", arp_dim_down: "Dim7 ↓", arp_shell_up: "Shell ↑", arp_upper_struct: "Upper struct",
  scale_bop_down: "Bebop ↓", scale_bop_up: "Bebop ↑", scale_major_down: "Major ↓",
  scale_mm_down: "Mel min ↓", scale_mm_up: "Mel min ↑", scale_hw_dim: "H-W dim",
  scale_chrom_down: "Chrom ↓", scale_pent_down: "Pent ↓",
  cell_1235: "1-2-3-5", cell_5321: "5-3-2-1", cell_b7R53: "b7-R-5-3", cell_3217: "3-2-1-7",
  cell_b9cell: "b9 cell", cell_bebop_lick: "Bebop lick",
  pivot_3rd_up: "Pivot 3↑", pivot_3rd_down: "Pivot 3↓", pivot_root_up: "Pivot R↑",
  triad_pair_uu: "Pair ↑↑", triad_sub_tt: "TT sub", triad_mm_pair: "MM pair",
  trip_triad_chain: "Gallop", trip_dim_chain: "Dim gallop", trip_burst_rest: "Burst+rest",
  land_and1: "Land &1", land_and3: "Land &3", land_hold: "Land+hold", land_beat3_late: "Late land",
}

// ─── Compatibility graph ────────────────────────────────────────────────────

// inside (diatonic), altered (strong tension), outside (chromatic/side-slip).
// Visual guidance only — not part of scoring.
export const BLOCK_FLAVOR = {
  enclosure_std: "inside", enclosure_dbl: "inside", enclosure_chrom: "outside", enclosure_above: "inside",
  pickup_scale: "inside", pickup_chrom: "outside",
  arp_root_up: "inside", arp_root_down: "inside", arp_3rd_up: "inside", arp_3rd_down: "inside",
  arp_dim_up: "altered", arp_dim_down: "altered", arp_shell_up: "inside", arp_upper_struct: "outside",
  scale_bop_down: "inside", scale_bop_up: "inside", scale_major_down: "inside",
  scale_mm_down: "altered", scale_mm_up: "altered", scale_hw_dim: "altered",
  scale_chrom_down: "outside", scale_pent_down: "inside",
  cell_1235: "inside", cell_5321: "inside", cell_b7R53: "inside", cell_3217: "inside",
  cell_b9cell: "altered", cell_bebop_lick: "inside",
  pivot_3rd_up: "inside", pivot_3rd_down: "inside", pivot_root_up: "inside",
  triad_pair_uu: "inside", triad_sub_tt: "outside", triad_mm_pair: "altered",
  trip_triad_chain: "inside", trip_dim_chain: "altered", trip_burst_rest: "outside",
  land_and1: "inside", land_and3: "inside", land_hold: "inside", land_beat3_late: "outside",
}

// Which way a block leaves the phrase — drives the Direction (path) voice
// multiplier below. high: ends above where it started. low: ends below.
// neutral: ends near the middle. enc: ends on a specific target (enclosures).
export const BLOCK_EXIT = {
  enclosure_std: "enc", enclosure_dbl: "enc", enclosure_chrom: "enc", enclosure_above: "enc",
  pickup_scale: "neutral", pickup_chrom: "neutral",
  arp_root_up: "high", arp_root_down: "low", arp_3rd_up: "high", arp_3rd_down: "low",
  arp_dim_up: "high", arp_dim_down: "low", arp_shell_up: "high", arp_upper_struct: "high",
  scale_bop_down: "low", scale_bop_up: "high", scale_major_down: "low",
  scale_mm_down: "low", scale_mm_up: "high", scale_hw_dim: "high",
  scale_chrom_down: "low", scale_pent_down: "low",
  cell_1235: "high", cell_5321: "low", cell_b7R53: "neutral", cell_3217: "low",
  cell_b9cell: "high", cell_bebop_lick: "neutral",
  pivot_3rd_up: "neutral", pivot_3rd_down: "neutral", pivot_root_up: "neutral",
  triad_pair_uu: "high", triad_sub_tt: "high", triad_mm_pair: "high",
  trip_triad_chain: "high", trip_dim_chain: "high", trip_burst_rest: "low",
  land_and1: "neutral", land_and3: "neutral", land_hold: "neutral", land_beat3_late: "neutral",
}

// [from][to] -> base score 0-100. Missing pairs default to 30 (getBaseScore).
export const GRAMMAR = {
  enclosure_std:   { pivot_3rd_up: 90, arp_root_up: 88, arp_3rd_up: 85, scale_bop_down: 70, cell_1235: 72, cell_b7R53: 68 },
  enclosure_dbl:   { pivot_3rd_up: 88, arp_root_up: 85, cell_1235: 75, scale_bop_down: 65 },
  enclosure_chrom: { pivot_3rd_up: 82, scale_chrom_down: 85, arp_dim_up: 80, arp_upper_struct: 78 },
  pickup_scale:    { enclosure_std: 85, pivot_3rd_up: 80, arp_root_up: 78, cell_1235: 72 },
  pickup_chrom:    { enclosure_std: 82, enclosure_chrom: 88, arp_dim_up: 75, scale_chrom_down: 80 },
  arp_root_up:     { scale_bop_down: 90, scale_major_down: 85, pivot_3rd_up: 80, cell_5321: 75, arp_dim_up: 72, trip_dim_chain: 68 },
  arp_root_down:   { enclosure_std: 82, cell_1235: 78, scale_bop_up: 75, pivot_3rd_up: 70 },
  arp_3rd_up:      { scale_bop_down: 92, scale_major_down: 88, cell_5321: 80, arp_dim_up: 78, trip_dim_chain: 72 },
  arp_3rd_down:    { enclosure_std: 85, cell_1235: 80, scale_bop_up: 75 },
  arp_dim_up:      { land_and3: 95, land_and1: 88, land_hold: 82, scale_bop_down: 70, enclosure_std: 65 },
  arp_dim_down:    { enclosure_std: 85, arp_root_up: 75, cell_1235: 70 },
  arp_shell_up:    { scale_bop_down: 85, cell_5321: 80, arp_dim_up: 75, trip_dim_chain: 70 },
  arp_upper_struct:{ land_and3: 90, land_and1: 85, scale_mm_down: 78, cell_b9cell: 75 },
  scale_bop_down:  { enclosure_std: 88, arp_dim_up: 85, land_and3: 90, land_and1: 85, trip_dim_chain: 75, cell_b7R53: 72 },
  scale_bop_up:    { arp_dim_up: 82, triad_pair_uu: 78, arp_3rd_up: 75, scale_bop_down: 72 },
  scale_major_down:{ enclosure_std: 85, arp_dim_up: 82, land_and3: 88, land_and1: 80, cell_b7R53: 70 },
  scale_mm_down:   { land_and3: 92, land_and1: 88, enclosure_std: 75, arp_dim_up: 80 },
  scale_hw_dim:    { land_and3: 90, enclosure_std: 78, arp_dim_down: 72 },
  scale_chrom_down:{ enclosure_std: 80, land_and3: 85, arp_dim_down: 75 },
  scale_pent_down: { enclosure_std: 78, cell_b7R53: 75, arp_root_up: 70 },
  cell_1235:       { arp_dim_up: 85, scale_bop_down: 82, pivot_3rd_up: 80, triad_pair_uu: 75, enclosure_std: 72 },
  cell_5321:       { enclosure_std: 88, land_and3: 85, cell_b7R53: 80, land_and1: 78 },
  cell_b7R53:      { land_and3: 92, land_and1: 88, land_hold: 82, enclosure_std: 70 },
  cell_3217:       { land_and3: 90, enclosure_std: 82, arp_dim_up: 75 },
  cell_b9cell:     { land_and3: 95, land_and1: 90, enclosure_std: 72, scale_mm_down: 70 },
  cell_bebop_lick: { land_and3: 90, land_and1: 85, enclosure_std: 75, scale_bop_down: 68 },
  pivot_3rd_up:    { scale_bop_down: 95, scale_major_down: 90, cell_5321: 80, arp_dim_up: 78, trip_dim_chain: 72 },
  pivot_3rd_down:  { scale_bop_up: 85, cell_1235: 80, arp_3rd_up: 78 },
  pivot_root_up:   { scale_bop_down: 88, arp_dim_up: 82, cell_5321: 78 },
  triad_pair_uu:   { scale_bop_down: 85, arp_dim_up: 82, land_and3: 80, cell_b7R53: 75 },
  triad_sub_tt:    { land_and3: 92, land_and1: 88, enclosure_std: 75, scale_mm_down: 72 },
  triad_mm_pair:   { land_and3: 90, land_and1: 85, scale_mm_down: 78, arp_dim_down: 70 },
  trip_triad_chain:{ trip_dim_chain: 85, land_and3: 80, land_and1: 78, scale_bop_down: 70 },
  trip_dim_chain:  { land_and3: 95, land_and1: 90, land_hold: 82, enclosure_std: 68 },
  trip_burst_rest: { land_and3: 88, land_and1: 82, enclosure_std: 70 },
}

// [path][exit] -> multiplier. arch/valley get a dynamic per-position variant
// in computeScore below, not this static table.
export const PATH_BONUS = {
  ascending: { high: 1.2, low: 0.6, neutral: 1.0, enc: 1.0 },
  descending: { high: 0.6, low: 1.2, neutral: 1.0, enc: 1.0 },
  arch: { high: 1.1, low: 1.1, neutral: 1.0, enc: 1.1 },
  valley: { high: 0.9, low: 0.9, neutral: 1.1, enc: 1.0 },
  chromatic: { high: 0.9, low: 0.9, neutral: 1.0, enc: 1.1 },
}

// [slot][category] -> 0-1.
export const SLOT_FIT = {
  ii: { opener: 0.9, arp: 0.85, scale: 0.8, triad: 0.75, cell: 0.8, pivot: 0.9, triplet: 0.7, rhythm: 0.3 },
  V: { opener: 0.5, arp: 0.8, scale: 0.85, triad: 0.85, cell: 0.8, pivot: 0.75, triplet: 0.85, rhythm: 0.5 },
  I: { opener: 0.3, arp: 0.6, scale: 0.5, triad: 0.5, cell: 0.6, pivot: 0.5, triplet: 0.5, rhythm: 0.95 },
  IV: { opener: 0.6, arp: 0.8, scale: 0.8, triad: 0.75, cell: 0.75, pivot: 0.7, triplet: 0.7, rhythm: 0.4 },
}

export function getBaseScore(fromType, toType) {
  return GRAMMAR[fromType]?.[toType] ?? 30
}

// The three-layer score: grammar base * slot fitness * direction multiplier,
// plus the personal-usage bonus, with the landing-blocks-only-at-the-end gate.
export function computeScore(fromType, toType, slot, voicePath, posInPhrase, totalSlots, usageMap) {
  let score = getBaseScore(fromType, toType)

  const slotKey = slot || "ii"
  const cat = BLOCK_CAT[toType] || "rhythm"
  score *= SLOT_FIT[slotKey]?.[cat] ?? 0.5

  const exitDir = BLOCK_EXIT[fromType] || "neutral"
  let pathMult = PATH_BONUS[voicePath]?.[exitDir] ?? 1.0
  // Arch/valley reverse which half of the phrase wants which exit direction.
  if (voicePath === "arch") {
    pathMult = posInPhrase < totalSlots / 2 ? (exitDir === "high" ? 1.2 : 0.8) : (exitDir === "low" ? 1.2 : 0.8)
  }
  score *= pathMult

  const useCount = usageMap[`${fromType}>${toType}`] || 0
  score += Math.min(useCount * 4, 20)

  if (toType.startsWith("land") && posInPhrase < totalSlots - 1) score *= 0.2
  if (!toType.startsWith("land") && posInPhrase >= totalSlots - 1) score *= 0.3

  return Math.round(Math.min(score, 100))
}

export function tier(score) {
  if (score >= 80) return "hot"
  if (score >= 65) return "warm"
  if (score >= 45) return "ok"
  return "out"
}

// Every block type, scored against fromType/slot/path/position and sorted
// best-first — the candidate list one tree column renders. excludeLanding
// drops non-landing blocks once pos is the final slot (nothing plays after
// the landing note).
export function getTopN(fromType, slot, voicePath, pos, total, usageMap, n, excludeLanding) {
  const all = Object.keys(BLOCK_FNS)
    .filter((k) => !(excludeLanding && !k.startsWith("land") && pos >= total - 1))
    .map((k) => ({
      type: k,
      score: computeScore(fromType, k, slot, voicePath, pos, total, usageMap),
      flavor: BLOCK_FLAVOR[k] || "neutral",
    }))
    .filter((b) => !(fromType && b.type.startsWith("land") && pos < total - 1))
    .sort((a, b) => b.score - a.score)
  return n === "all" ? all : all.slice(0, parseInt(n, 10))
}

// Chord (and its harmonic slot) active at a given position in the formula
// being built — the prototype's getSlotForPosition(), minus the DOM reads:
// callers pass the already-transposed prog instead of a prog/key select.
// Used by the tree UI to label each column and score its candidates.
export function chordAtFormulaPosition(prog, formula, pos) {
  if (!prog?.length) return { slot: "ii", symbol: "?" }
  let beat = 0
  for (let i = 0; i < pos; i++) {
    const t = formula[i]
    beat += t ? blockDur(t) : 8
  }
  let cursor = 0
  for (const ch of prog) {
    if (beat >= cursor && beat < cursor + (ch.beats || 8)) return ch
    cursor += ch.beats || 8
  }
  return prog[prog.length - 1]
}

// ─── Rhythm / timing ────────────────────────────────────────────────────────

// Nominal duration per block, in eighth-note units. Used by the beat-counting
// chord assigner and the tree UI's position lookup. Triplet blocks (trip_*)
// use their nominal duration here too — the real-time compression to 2/3
// happens once, in phraseAdapter.js, when converting to DukeBox beats.
export const BLOCK_EIGHTH_DURATION = {
  enclosure_std: 4, enclosure_dbl: 4, enclosure_chrom: 4, enclosure_above: 4,
  pickup_scale: 2, pickup_chrom: 2,
  arp_root_up: 8, arp_root_down: 8, arp_3rd_up: 8, arp_3rd_down: 8,
  arp_dim_up: 8, arp_dim_down: 8, arp_shell_up: 8, arp_upper_struct: 8,
  scale_bop_down: 8, scale_bop_up: 8, scale_major_down: 6, scale_mm_down: 7,
  scale_mm_up: 7, scale_hw_dim: 8, scale_chrom_down: 7, scale_pent_down: 5,
  triad_pair_uu: 8, triad_sub_tt: 8, triad_mm_pair: 6,
  cell_1235: 8, cell_5321: 8, cell_b7R53: 8, cell_3217: 8,
  cell_b9cell: 8, cell_bebop_lick: 8,
  pivot_3rd_up: 8, pivot_3rd_down: 8, pivot_root_up: 8,
  trip_triad_chain: 12, trip_dim_chain: 12, trip_burst_rest: 7,
  land_and1: 4, land_and3: 7, land_hold: 6, land_beat3_late: 8,
}

export function blockDur(type) {
  return BLOCK_EIGHTH_DURATION[type] || 8
}

// Returns 0-3 connector notes to bridge the interval between the last note of
// one block and the first note of the next.
export function makeConnector(lastNote, firstNote, variation, rng, chord) {
  if (!lastNote || !firstNote || lastNote === "z" || firstNote === "z") return []
  const li = PM_NOTES.indexOf(lastNote)
  const fi = PM_NOTES.indexOf(firstNote)
  if (li < 0 || fi < 0) return []
  const diff = mod12(fi - li) // semitones up from last to first, 0-11

  if (diff === 0) return []
  if (diff === 1 || diff === 11) return [] // half step — direct connect

  if (diff === 2) return variation === "shallow" ? [] : [{ note: PM_NOTES[mod12(li + 1)], dur: 1 }]
  if (diff === 10) return variation === "shallow" ? [] : [{ note: PM_NOTES[mod12(li - 1)], dur: 1 }]

  if (diff === 3) return [{ note: PM_NOTES[mod12(li + 2)], dur: 1 }]
  if (diff === 9) return [{ note: PM_NOTES[mod12(li - 2)], dur: 1 }]

  // Major 3rd / 4th — micro-enclosure into the target.
  if (diff === 4 || diff === 5) {
    const upper = PM_NOTES[mod12(fi + 1)]
    const lower = PM_NOTES[mod12(fi - 1)]
    return variation === "deep" ? [{ note: upper, dur: 1 }, { note: lower, dur: 1 }] : [{ note: lower, dur: 1 }]
  }

  // Tritone or larger — chromatic approach from below.
  if (diff >= 6) {
    const appr1 = PM_NOTES[mod12(fi - 2)]
    const appr2 = PM_NOTES[mod12(fi - 1)]
    return variation === "shallow" ? [{ note: appr2, dur: 1 }] : [{ note: appr1, dur: 1 }, { note: appr2, dur: 1 }]
  }

  return []
}

// Maps each formula slot to the chord actually sounding when it starts,
// walking a beat timeline built from prog rather than assuming formula[i]
// lines up with prog[i] (a pivot block starting mid-progression correctly
// gets the chord under it, not the chord at its own array index).
export function assignChordsToBlocks(formula, prog) {
  const timeline = []
  let cursor = 0
  prog.forEach((ch) => {
    timeline.push({ start: cursor, end: cursor + (ch.beats || 8), chord: ch })
    cursor += ch.beats || 8
  })

  let beat = 0
  return formula.map((blockType) => {
    let active = timeline[timeline.length - 1].chord
    for (const seg of timeline) {
      if (beat >= seg.start && beat < seg.end) { active = seg.chord; break }
    }
    const dur = blockDur(blockType)
    const result = { chord: active, startBeat: beat }
    beat += dur
    return result
  })
}

// Trims or pads the note stream to land exactly on targetEighths, with a
// landing note at landingBeat.
export function enforcePhraseLengthAndLanding(allNotes, targetEighths) {
  const current = allNotes.reduce((s, n) => s + (n.dur || 1), 0)
  if (current === targetEighths) return allNotes

  if (current > targetEighths) {
    let trimmed = [...allNotes]
    let total = current
    while (total > targetEighths && trimmed.length > 1) {
      const last = trimmed.pop()
      total -= last.dur || 1
    }
    if (total < targetEighths) trimmed.push({ note: "z", dur: targetEighths - total })
    return trimmed
  }

  const gap = targetEighths - current
  if (gap <= 0) return allNotes
  return [...allNotes, { note: "z", dur: gap }]
}

const LANDING_OFFSETS = { and1: 1, and3: 5, late3: 9, beat1: 0, beat3: 4 }

// Resolves `formula` into a note stream against `prog` (already transposed —
// see transposeProgression). `landing` replaces the prototype's own
// document.getElementById('sel-land') read; defaults to its same "and3"
// (the Galper sweet spot — see docs/phrase-machine-docs.md).
//
// Returns { notes, blockLog, targetEighths, prog } — no `abc` field. Feed
// this into phraseAdapter.js's phraseResultToLine() to get a DukeBox line.
export function runGenerator(formula, key, progType, variation, seed, landing = "and3") {
  const rng = seededRand(seed)
  const rawProg = PM_PROGRESSIONS[progType]?.chords
  if (!rawProg) throw new Error(`Unknown Phrase Machine progression: ${progType}`)
  const prog = transposeProgression(rawProg, key)

  const targetEighths = prog.reduce((s, ch) => s + (ch.beats || 8), 0)
  const blockChords = assignChordsToBlocks(formula, prog)

  let allNotes = []
  const blockLog = []
  const landingRoot = prog[prog.length - 1].root

  formula.forEach((blockType, i) => {
    const { chord } = blockChords[i]
    const fn = BLOCK_FNS[blockType]
    if (!fn) return

    const notes = blockType.startsWith("land") ? fn(landingRoot) : fn(chord.root, chord, variation, rng)

    if (i > 0 && allNotes.length > 0 && notes.length > 0) {
      const lastNote = allNotes[allNotes.length - 1].note
      const firstNote = notes[0].note
      const connectors = makeConnector(lastNote, firstNote, variation, rng, chord)
      const currentTotal = allNotes.reduce((s, n) => s + (n.dur || 1), 0)
      const blockTotal = notes.reduce((s, n) => s + (n.dur || 1), 0)
      const connTotal = connectors.reduce((s, n) => s + (n.dur || 1), 0)
      if (currentTotal + connTotal + blockTotal <= targetEighths + 4) {
        allNotes = allNotes.concat(connectors)
      }
    }

    allNotes = allNotes.concat(notes)
    blockLog.push({
      type: blockType,
      chord: chord.symbol,
      cat: BLOCK_CAT[blockType],
      startBeat: blockChords[i].startBeat,
    })
  })

  // The prototype used `|| 5` here, not `?? 5` — LANDING_OFFSETS.beat1 is 0,
  // which `||` treats as falsy and collapses to the and3 default. Kept
  // verbatim: "beat1"/"beat3" were never reachable from the prototype's own
  // <select id="sel-land"> (and1/and3/late3 only), so this is dormant either
  // way, but a faithful port shouldn't silently change behavior even in a
  // dead branch.
  const landingOffset = LANDING_OFFSETS[landing] || 5
  const lastBarStart = targetEighths - 8
  const landingBeat = lastBarStart + landingOffset
  allNotes = enforcePhraseLengthAndLanding(allNotes, landingBeat)

  return { notes: allNotes, blockLog, targetEighths, prog }
}

// ─── Presentation-adjacent, still pure ──────────────────────────────────────
// Data, not DOM — used by PhraseMachineTree.jsx for chip/heat-bar colors.

const CAT_COLORS = {
  opener: "#c0a060", arp: "#5b9bd5", scale: "#6abf69", triad: "#d47fbe",
  cell: "#e08c5a", pivot: "#5ec4c4", triplet: "#a07fd4", rhythm: "#d47f7f",
}

export function chipColor(type) {
  return CAT_COLORS[BLOCK_CAT[type] || "rhythm"] || "#888"
}
