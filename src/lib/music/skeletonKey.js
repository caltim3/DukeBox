// Skeleton Key — the curriculum, as data.
//
// DukeBox already had a name for the thing every Line Lab device decorates:
// the bebop skeleton — chord tones on strong beats, approach material on the
// upbeats, guide tones as the rail underneath. This is the master key to it:
// ten chapters, ordered, each segment one pedagogue's angle on one skill.
//
// Nothing here is an engine. Every exercise reduces to one call:
//
//   improvise({ measures, devices, level, profileId, controls, seed, tag })
//
// which is rule-based, offline, free, and reproducible from its seed — so a
// segment can be drilled the same way in twelve keys without a network round
// trip or a bill. That is the whole reason the curriculum doesn't go through
// /api/generate-line: a lesson you can't repeat exactly isn't a lesson.
//
// ── On "direction seeds" ──────────────────────────────────────────────────
// The source outline gave each exercise a sentence of direction ("root-
// position arpeggio only, no chromatic material"). Those were prompts for a
// language model. Here the devices ARE the direction — `devices: ["triads"]`
// with `level: 1` is that sentence, enforced rather than requested. The
// sentence survives as `listenFor`: what the student should hear, not an
// instruction to a generator.
//
// ── On `ready` ────────────────────────────────────────────────────────────
// Segments whose devices exist today are playable now. The rest carry their
// full teaching text and their gate, and say plainly what they're waiting
// on — so the arc is visible from day one without the app pretending to
// teach something it can't yet generate. `needs` names the missing piece.

// A segment's measures as bars the rhythm section can play: one entry per
// CHORD, not per measure, because a measure holding two chords is two entries
// of two beats each — the same split forms.js makes for every other tune in
// the app. Getting this wrong is silent: the band simply sits on the first
// chord of a split bar while the neck and the generated line move on without
// it, and nothing errors.
export function measuresToBandBars(measures, parseChord) {
  return (measures || []).flatMap((measure) => {
    const tokens = String(measure).trim().split(/\s+/).filter(Boolean)
    const beats = tokens.length > 1 ? Math.max(1, Math.floor(4 / tokens.length)) : 4
    return tokens.map((token) => {
      const parsed = parseChord(token, "A")
      return parsed
        ? { ...parsed, beats }
        : { root: "C", quality: "maj7", symbol: token, section: "A", beats }
    })
  })
}

// Which measure each of those entries belongs to, so a bar-change callback
// counting chords can be mapped back onto a strip counting measures.
export function chordToMeasureIndex(measures) {
  return (measures || []).flatMap((measure, m) =>
    String(measure).trim().split(/\s+/).filter(Boolean).map(() => m)
  )
}

// Cycling one static quality is how Chapter 1 drills raw material: four bars
// of one chord, so the ear has nowhere to hide.
const staticBars = (symbol) => [symbol, symbol, symbol, symbol]

const II_V_I = (ii, V, I) => [ii, V, I, I]

export const SK_CHAPTERS = [
  {
    n: 1,
    title: "Chord-Tone Vocabulary",
    subtitle: "Arpeggios, triads & the minor-conversion lens",
    goal: "Own the raw materials cold, and collapse the shape-count using Martino before anything else is added.",
    welcome:
      "Before you can bend the changes, you have to be able to spell them without thinking. " +
      "This chapter is inventory, not artistry — arpeggios, triads, and one trick that quietly " +
      "cuts your workload by three-quarters.",
    segments: [
      {
        id: "1.1",
        title: "Scale & arpeggio practice",
        pedagogue: "Ligon",
        voice:
          "Every idea you'll ever play is decorated scale or arpeggio motion. Drill the raw " +
          "material first — diatonic triads and their elaborations, 7th and 9th chord " +
          "arpeggios — so later everything is recombination, not invention.",
        brief:
          "An arpeggio is the chord itself played one note at a time — the " +
          "raw material every line you will ever play is decorated from. " +
          "Today's exercise is inventory, not artistry: play the bare triad " +
          "of each chord quality in root position, ascending and descending, " +
          "quarter notes only, naming each note out loud as you strike it. " +
          "Over Cmaj7 that is C–E–G and nothing else; the 7th is deliberately " +
          "withheld until you can spell the triad without looking for it. Run " +
          "all five qualities, then move the whole thing to a new position " +
          "and run them again.",
        task:
          "Off-app first: sing or finger the arpeggio of every diatonic 7th chord in a key, " +
          "root position, ascending and descending, before you open this.",
        listenFor: "Root-position arpeggio motion in quarter notes. No chromatic material at all.",
        ready: true,
        exercise: {
          devices: ["triads"], level: 1, profileId: "bebop",
          controls: { space: 30, altered: 0, intensity: 45 },
          tempo: 76, neckPosition: 3,
          variants: [
            { label: "maj7", measures: staticBars("Cmaj7") },
            { label: "m7", measures: staticBars("Cm7") },
            { label: "dom7", measures: staticBars("C7") },
            { label: "m7b5", measures: staticBars("Cm7b5") },
            { label: "dim7", measures: staticBars("Cdim7") },
          ],
        },
        gate: [
          "Name every chord tone out loud while playing, all five qualities",
          "Three neck positions, each quality",
          "Clean at 76 bpm with no hunting",
        ],
      },
      {
        id: "1.2",
        title: "The grammar layer",
        pedagogue: "Baker",
        voice:
          "Before a formula has a name, it's just the sound of a scale meeting a chord. Learn " +
          "the raw scales, chords and modes common to bebop as vocabulary — the specific licks " +
          "come later, once your ear already expects this grammar.",
        brief:
          "Before a lick has a name it is just a scale meeting a chord. " +
          "Today's exercise is to play the correct scale for each chord " +
          "quality in straight eighth notes, with no approach notes and no " +
          "decoration — dorian over m7, mixolydian over dom7, major over " +
          "maj7, locrian over m7b5. Over a Dm7 vamp that is D–E–F–G–A–B–C, up " +
          "and down, until the shape is automatic. The goal is that your hand " +
          "finds the right seven notes before your brain names them.",
        listenFor: "Diatonic scale tones only, straight 8ths, no approach notes yet.",
        ready: true,
        exercise: {
          devices: [], level: 2, profileId: "bebop",
          controls: { space: 30, altered: 0, intensity: 50 },
          tempo: 84, neckPosition: 3,
          variants: [
            { label: "Dorian vamp", measures: ["Dm7", "Dm7", "Dm7", "Dm7"] },
            { label: "Blues, first 4", measures: ["F7", "Bb7", "F7", "F7"] },
            { label: "maj7", measures: staticBars("Cmaj7") },
            { label: "m7b5", measures: staticBars("Cm7b5") },
          ],
        },
        gate: [
          "Play the correct scale for maj7 / m7 / dom7 / m7b5 / dim7 from memory",
          "No chart in view",
        ],
      },
      {
        id: "1.3",
        title: "Minor conversion, applied to 1.1's arpeggios",
        pedagogue: "Martino",
        voice:
          "Reduce every chord you just drilled to its minor or diminished equivalent, and the " +
          "rest of your career is one system moved around the neck instead of four chord " +
          "qualities memorised separately: maj7 becomes the relative minor, dom7 becomes the " +
          "minor a fifth above, m7 stays home, m7b5 and dim become symmetric extensions of the " +
          "same minor system.",
        brief:
          "Martino's insight is that you do not need four chord shapes, you " +
          "need one minor shape and a rule about where to put it. Today's " +
          "exercise is to play the ii minor over BOTH the ii and the V of a " +
          "major ii-V-I, then flip a single note on the I. In C major: D " +
          "minor material over Dm7, the same D minor material over G7 — where " +
          "it sounds as G9 — then raise F to F# over Cmaj7 and it becomes " +
          "lydian. One shape, three chords. Take it round four keys in the " +
          "cycle of 4ths at 100 bpm before you move on.",
        listenFor:
          "The ii minor sounding over BOTH the ii and the V. The real 3rd and 7th still land " +
          "at each change — only the colour around them moves.",
        ready: true,
        exercise: {
          devices: ["minor-conversion"], level: 2, profileId: "bebop",
          controls: { space: 30, altered: 0, intensity: 55 },
          tempo: 100, neckPosition: 3,
          variants: [
            { label: "C", measures: II_V_I("Dm7", "G7", "Cmaj7") },
            { label: "F", measures: II_V_I("Gm7", "C7", "Fmaj7") },
            { label: "Bb", measures: II_V_I("Cm7", "F7", "Bbmaj7") },
            { label: "Eb", measures: II_V_I("Fm7", "Bb7", "Ebmaj7") },
          ],
        },
        gate: [
          "Full Martino-converted II-V-I in four keys around the cycle of 4ths",
          "At 100 bpm, no hesitation at the conversion",
        ],
      },
      {
        id: "1.4",
        title: "Triad pairs as a seed",
        pedagogue: "Vincent",
        voice:
          "Two adjacent arpeggios played back to back are the seed of everything you'll do with " +
          "hexatonics in Chapter 4. Don't fuse them into one scale yet — alternate them, " +
          "cleanly, so your ear hears them as two separate objects first.",
        brief:
          "Two triads a whole step apart, played back to back, are the seed " +
          "of every hexatonic you will build in Chapter 4. Today's exercise " +
          "is to alternate them strictly — three notes of one, three notes of " +
          "the other, never blended into a single run. Over Cmaj7 that is C " +
          "major (C–E–G) then D major (D–F#–A); over C7 it is Bb major then C " +
          "major. Keep them audibly separate: someone listening should be " +
          "able to name both triads.",
        listenFor: "Two triads alternating strictly, never blending into a single run.",
        ready: true,
        exercise: {
          devices: ["triad-pairs"], level: 2, profileId: "bebop",
          controls: { space: 30, altered: 0, intensity: 55 },
          tempo: 84, neckPosition: 3,
          variants: [
            { label: "maj7 (C+D)", measures: staticBars("Cmaj7") },
            { label: "dom7 (Bb+C)", measures: staticBars("C7") },
            { label: "m7 (Bb+Cm)", measures: staticBars("Cm7") },
          ],
        },
        gate: ["Identify which two triads are being alternated by ear alone, 8 of 8 trials"],
      },
    ],
  },

  {
    n: 2,
    title: "Guide-Tone Voice Leading & Forward Motion",
    goal: "Move smoothly and land correctly before any colour is added.",
    welcome:
      "A great line is really just two rails — the 3rd and the 7th — with everything else hung " +
      "off them. This chapter is about the rails, and about arriving at the next chord already " +
      "in motion rather than starting fresh.",
    segments: [
      {
        id: "2.1",
        title: "Guide tones & forward motion",
        pedagogue: "Galper",
        voice:
          "The downbeat is a point of arrival, not departure. Start your phrase on the 'and' of " +
          "the beat before the chord change, and let a guide tone — the 3rd or the 7th — land on " +
          "the strong beat of the new chord. You are always already moving when the harmony " +
          "changes under you.",
        brief:
          "The downbeat is a place you arrive, not a place you start from. " +
          "Today's exercise is to begin every phrase on the 'and' of the beat " +
          "before the chord changes, and land a guide tone — the 3rd or the " +
          "7th — squarely on beat 1 of the new chord. Over Dm7–G7–Cmaj7 that " +
          "means entering on the & of 4 and landing B, the 3rd of G7, on the " +
          "downbeat; then F, its 7th, falling a half step to E, the 3rd of " +
          "Cmaj7. You should always already be moving when the harmony " +
          "changes underneath you.",
        listenFor:
          "Phrases entering off the beat, guide tones landing on the change. Watch the reasoning " +
          "strip: bars that say 'guide tone' are the rail doing its job.",
        ready: true,
        exercise: {
          devices: [], level: 2, profileId: "bebop",
          controls: { space: 35, altered: 15, intensity: 55 },
          tempo: 100, neckPosition: 3,
          variants: [
            { label: "C", measures: II_V_I("Dm7", "G7", "Cmaj7") },
            { label: "Autumn Leaves opening", measures: ["Cm7", "F7", "Bbmaj7", "Ebmaj7"] },
          ],
        },
        gate: ["Sing the guide-tone line — 3rds and 7ths only — through a full chorus before adding notes"],
      },
      {
        id: "2.2",
        title: "Guide-tone lines & 3-5-7-9 elaboration",
        pedagogue: "Ligon",
        voice:
          "Decorate the guide-tone skeleton without losing it. The 3-5-7-9 arpeggio elaboration " +
          "is the first layer of decoration that still keeps the rail audible underneath.",
        brief:
          "Now decorate the rails without losing them. Today's exercise is to " +
          "take the guide-tone line from 2.1 and elaborate it with 3–5–7–9 " +
          "arpeggio motion while the 3rds and 7ths still land exactly where " +
          "they landed before. Over Dm7 that is F–A–C–E; over G7, B–D–F–A. " +
          "Play 2.1 and 2.2 back to back at the same tempo — if the " +
          "elaboration no longer arrives on the same notes on the same beats, " +
          "you have added too much.",
        listenFor: "More notes than 2.1, same landings. If the rail disappears, it's too much.",
        ready: true,
        exercise: {
          devices: [], level: 2, profileId: "bebop",
          controls: { space: 20, altered: 10, intensity: 60 },
          tempo: 100, neckPosition: 3,
          variants: [
            { label: "C", measures: II_V_I("Dm7", "G7", "Cmaj7") },
            { label: "Bb", measures: II_V_I("Cm7", "F7", "Bbmaj7") },
          ],
        },
        gate: [
          "Play 2.1's skeleton and 2.2's elaboration back to back, same bars, same tempo",
          "The elaboration still lands on the same guide tones",
        ],
      },
      {
        id: "2.3",
        title: "The bebop-intuition formula",
        pedagogue: "Peña",
        voice:
          "One formula, three parts: an arpeggio with chord tones on strong beats, a chromatic " +
          "enclosure that starts the line or meets the target, and a guide-tone landing on the " +
          "3rd of the next chord, right on beat 1.",
        brief:
          "Peña's formula is three tools in a fixed order, and once you hear " +
          "it you cannot unhear it. Today's exercise is to build every bar " +
          "from exactly those three: chord tones holding beats 1 and 3, a " +
          "chromatic enclosure on the offbeats leading into the target, and a " +
          "guide-tone landing on the 3rd of the NEXT chord right on its " +
          "downbeat. Over Dm7 into G7 that means outlining Dm7 on the strong " +
          "beats, caging B from above and below across beats 3 and 4, and " +
          "arriving on B as G7 begins. Say which of the three tools is " +
          "happening in each bar, out loud, as you play it.",
        listenFor:
          "Three things at once: chord tones holding beats 1 and 3, an encirclement caging the " +
          "target on the offbeats before it, and the landing on the next chord's 3rd.",
        ready: true,
        exercise: {
          devices: ["pena"], level: 3, profileId: "bebop",
          controls: { space: 25, altered: 10, intensity: 60 },
          tempo: 92, neckPosition: 3,
          variants: [
            { label: "C", measures: II_V_I("Dm7", "G7", "Cmaj7") },
            { label: "F", measures: II_V_I("Gm7", "C7", "Fmaj7") },
            { label: "Blues in F", measures: ["F7", "Bb7", "F7", "F7", "Bb7", "Bb7", "F7", "D7"] },
          ],
        },
        gate: ["Say out loud which of the three formula parts is happening in each bar"],
      },
      {
        id: "2.4",
        title: "Linking formulas",
        pedagogue: "Baker",
        voice:
          "These patterns exist for one job: connecting one chord's guide tone to the next " +
          "chord's guide tone. Nothing decorative — just the handoff.",
        brief:
          "A linking formula has one job — hand the guide tone of one chord " +
          "to the guide tone of the next — and nothing decorative belongs in " +
          "it. Today's exercise is to play plainly through each bar and save " +
          "all your connective chromatic material for the barline itself. " +
          "Over Dm7–G7, hold ordinary Dm7 material through beats 1 and 2, " +
          "then use beats 3 and 4 only to walk into B, the 3rd of G7. Every " +
          "handoff should be traceable: you should be able to point at the " +
          "note that did the work.",
        listenFor: "Connective chromatic material at the barline, plainer material in between.",
        ready: true,
        exercise: {
          devices: [], level: 3, profileId: "bebop",
          controls: { space: 40, altered: 10, intensity: 55 },
          tempo: 96, neckPosition: 3,
          variants: [
            { label: "C", measures: II_V_I("Dm7", "G7", "Cmaj7") },
            { label: "Eight bars", measures: ["Dm7", "G7", "Cmaj7", "Am7", "Dm7", "G7", "Cmaj7", "Cmaj7"] },
          ],
        },
        gate: ["Play an 8-bar stretch of a real tune with every barline handoff traceable"],
      },
      {
        id: "2.5",
        title: "Jazz line, introductory pass",
        pedagogue: "Bergonzi",
        voice:
          "A first taste of voice leading through light chromatic connective tissue. Don't go " +
          "deep yet — that's Chapter 3's job. Here, just notice that a single passing tone can " +
          "carry a line across the barline.",
        brief:
          "A first taste, not the deep dive — that is Chapter 3's job. " +
          "Today's exercise is to play a mostly diatonic line and allow " +
          "yourself exactly one chromatic passing tone per two-bar phrase. " +
          "One. Choose it deliberately and put it where it carries the line " +
          "across the barline, not where it decorates the middle of a bar. " +
          "Over Dm7–G7 the strongest single choice is usually a half step " +
          "above or below the 3rd of G7, played on the & of 4.",
        listenFor: "At most one chromatic passing tone per two-bar phrase.",
        ready: true,
        exercise: {
          devices: [], level: 2, profileId: "sparse-lyrical",
          controls: { space: 45, altered: 10, intensity: 45 },
          tempo: 92, neckPosition: 3,
          variants: [
            { label: "C", measures: II_V_I("Dm7", "G7", "Cmaj7") },
            { label: "Minor ii-V-i", measures: ["Dm7b5", "G7", "Cm7", "Cm7"] },
          ],
        },
        gate: ["Completes Chapter 2 — play a full chorus of a ii-V-I-heavy standard using only 2.1–2.5 material"],
      },
    ],
  },

  {
    n: 3,
    title: "Chromatic Approach & Enclosures",
    goal:
      "Internalise each approach-note type in isolation — the core Parker-vocabulary building " +
      "block everything from Chapter 4 onward depends on.",
    welcome:
      "Every great bebop line is chord tones with chromatic gravity pulling into them. This " +
      "chapter studies that gravity one type at a time, so you can name what you're doing " +
      "instead of just imitating the sound of it.",
    segments: [
      {
        id: "3.1",
        title: "The full approach-note menu",
        pedagogue: "Ligon",
        voice:
          "Upper neighbour, lower neighbour, double chromatic, and full encirclement from both " +
          "sides — four distinct devices, not one blurry habit. Practise each alone.",
        brief:
          "There are four distinct approach notes, not one blurry habit, and " +
          "the only way to own them is to practise each completely alone. " +
          "Today's exercise is four separate passes over the same changes: " +
          "upper neighbour only (the scale tone above, falling in), lower " +
          "neighbour only (a half step below, pushing up), double chromatic " +
          "(two half steps from below), and full encirclement (the target " +
          "caged from both sides before it arrives). Aiming at B, the 3rd of " +
          "G7, those are C–B, Bb–B, A–Bb–B, and Bb–C–A–Bb–B. Run one type for " +
          "a whole chorus before you switch to the next.",
        listenFor:
          "One type at a time, and only that type — the reasoning strip names it in every bar, " +
          "so if you hear something else you can check.",
        ready: true,
        exercise: {
          devices: [], level: 3, profileId: "bebop",
          controls: { space: 30, altered: 0, intensity: 55 },
          tempo: 88, neckPosition: 3,
          // The four exercises the segment asks for, as four variants — the
          // point is drilling them apart, not choosing a key.
          variants: [
            { label: "Upper neighbour", measures: II_V_I("Dm7", "G7", "Cmaj7"), devices: ["upper-neighbour"] },
            { label: "Lower neighbour", measures: II_V_I("Dm7", "G7", "Cmaj7"), devices: ["lower-neighbour"] },
            { label: "Double chromatic", measures: II_V_I("Dm7", "G7", "Cmaj7"), devices: ["double-chromatic"] },
            { label: "Full encirclement", measures: II_V_I("Dm7", "G7", "Cmaj7"), devices: ["encirclement"] },
          ],
        },
        gate: [
          "On request, produce any one of the four types in isolation, cold, in any key",
          "Name which type you just played, every time",
        ],
      },
      {
        id: "3.2",
        title: "The bebop scale",
        pedagogue: "Baker",
        voice:
          "One added chromatic passing tone per octave is the whole secret — it's not " +
          "decoration, it's the rhythmic reason your chord tones keep landing on the strong " +
          "beats even when you're playing straight 8ths.",
        brief:
          "The bebop scale is a seven-note scale with one chromatic passing " +
          "tone added, and its purpose is rhythmic rather than decorative: " +
          "eight notes to the octave means your chord tones keep landing on " +
          "strong beats while you play continuous eighths. Today's exercise " +
          "is straight eighth notes — no rests, no phrasing, just the scale — " +
          "letting the passing tone do its job. Over G7 that is " +
          "G–A–B–C–D–E–F–F#, and if you start on G on beat 1 you will find B, " +
          "D and F all arriving on strong beats without you steering them " +
          "there.",
        listenFor:
          "Eight notes to the octave. The reasoning strip names the passing tone the scale added.",
        ready: true,
        exercise: {
          devices: ["bebop-scale"], level: 2, profileId: "bebop",
          controls: { space: 15, altered: 0, intensity: 65 },
          tempo: 104, neckPosition: 3,
          variants: [
            { label: "Blues in F", measures: ["F7", "Bb7", "F7", "F7", "Bb7", "Bb7", "F7", "D7"] },
            { label: "II-V-I in C", measures: II_V_I("Dm7", "G7", "Cmaj7") },
          ],
        },
        gate: [
          "A full chorus of blues changes in continuous 8th notes",
          "Every chord tone landing on a strong beat",
        ],
      },
      {
        id: "3.3",
        title: "Jazz line, full depth",
        pedagogue: "Bergonzi",
        voice:
          "Now go all the way in: the complete chromatic connective vocabulary linking arpeggio " +
          "tones across the barline, not just the light taste from Chapter 2.",
        brief:
          "Now take the one-per-phrase cap off 2.5. Today's exercise is " +
          "continuous chromatic connective tissue: approach material wherever " +
          "it wants to be, not only at the barline, with no gap longer than " +
          "two beats without an approach tone pulling into something. Over " +
          "Dm7–G7–Cmaj7 you should be leaning into F and A across the Dm7, " +
          "into B and F across the G7, and into E as Cmaj7 arrives. If you " +
          "can play four beats of plain scale with nothing pulling toward a " +
          "target, tighten it.",
        listenFor: "Dense chromatic connective tissue throughout, not only at the barline.",
        ready: true,
        exercise: {
          devices: ["bebop-scale"], level: 3, profileId: "bebop",
          controls: { space: 12, altered: 15, intensity: 70 },
          tempo: 108, neckPosition: 3,
          variants: [
            { label: "Eight bars in C", measures: ["Dm7", "G7", "Cmaj7", "Am7", "Dm7", "G7", "Cmaj7", "Cmaj7"] },
            { label: "Blues in F", measures: ["F7", "Bb7", "F7", "F7", "Bb7", "Bb7", "F7", "D7"] },
          ],
        },
        gate: ["A full 32-bar standard with no gap longer than two beats without an approach tone"],
      },
      {
        id: "3.4",
        title: "Random Chromatic Approach",
        pedagogue: "Garzone",
        voice:
          "Stay inside a major 3rd of your target. Never repeat the same interval direction " +
          "twice in a row. That's it — that's the whole rule, and it's the softest possible " +
          "door into everything we'll do together in Chapter 4.",
        brief:
          "This is the softest possible door into Garzone's language, and the " +
          "entire system is two rules. Today's exercise is to improvise using " +
          "chromatic motion that never strays more than a major 3rd from the " +
          "note you are heading for, and never moves the same direction twice " +
          "in a row. Heading for B you might play D–C#–D#–C–B: every note " +
          "within four semitones of the target, every move reversing the one " +
          "before it. Do not try to make it sound like anything yet — obey " +
          "the two rules and let the landing take care of itself.",
        listenFor:
          "Chromatic motion that never strays more than a major 3rd from where it's going, and " +
          "never moves the same way twice running. It always lands — the engine places the " +
          "target before it writes the approach.",
        ready: true,
        exercise: {
          devices: ["rca"], level: 3, profileId: "bebop",
          controls: { space: 25, altered: 20, intensity: 60 },
          tempo: 84, neckPosition: 3,
          variants: [
            { label: "C", measures: II_V_I("Dm7", "G7", "Cmaj7") },
            { label: "Blues in F", measures: ["F7", "Bb7", "F7", "F7", "Bb7", "Bb7", "F7", "D7"] },
            { label: "Static dominant", measures: staticBars("G7") },
          ],
        },
        gate: ["Completes Chapter 3 — improvise 8 bars using only RCA motion, landing correctly on every change"],
      },
    ],
  },

  {
    n: 4,
    title: "Triad Pairs, Superimposition & Hexatonics",
    goal:
      "Pivot chapter: fuse the chromatic vocabulary of Chapter 3 with the triad vocabulary of " +
      "Chapter 1 into the most outside-sounding material so far.",
    welcome:
      "Two triads, one chromatic rule, and suddenly you're not playing scales anymore — you're " +
      "playing colour. This is where the curriculum stops sounding like an exercise and starts " +
      "sounding like a solo.",
    segments: [
      {
        id: "4.1", title: "The full hexatonic system", pedagogue: "Vincent",
        voice:
          "Fuse the two adjacent triads from Chapter 1 into one 6-note scale — not alternated " +
          "anymore, played as a single continuous line. Then build melodic cells directly from " +
          "that hexatonic and move them around the neck.",
        brief:
          "The two triads from 1.4 are also a single six-note scale, and that " +
          "is the whole idea. Today's exercise is to stop alternating them " +
          "and play the fusion as one continuous line. Over Cmaj7, C major " +
          "plus D major becomes C–D–E–F#–G–A, and it should sound like a " +
          "scale rather than two arpeggios taking turns. Then build a four- " +
          "note cell out of those six notes and move that cell to three " +
          "positions on the neck.",
        listenFor:
          "The same two triads as 1.4 — but now one continuous line, not two objects. The " +
          "reasoning strip names the pair the scale came from.",
        ready: true,
        exercise: {
          devices: ["hexatonics"], level: 4, profileId: "bebop",
          controls: { space: 20, altered: 10, intensity: 62 },
          tempo: 88, neckPosition: 3,
          variants: [
            { label: "maj7", measures: staticBars("Cmaj7") },
            { label: "m7", measures: staticBars("Cm7") },
            { label: "dom7", measures: staticBars("C7") },
            { label: "m7b5", measures: staticBars("Cm7b5") },
            { label: "II-V-I in C", measures: II_V_I("Dm7", "G7", "Cmaj7") },
          ],
        },
        gate: ["Construct and play the correct hexatonic for maj7 / m7 / dom7 / m7b5 from memory"],
      },
      {
        id: "4.2", title: "Triadic superimposition", pedagogue: "Ligon",
        voice:
          "Systematically, over every chord quality — which triad, built on which scale degree, " +
          "gives you which colour? Learn the map, not just a handful of favourites.",
        brief:
          "Superimposition is a map, not a handful of favourites: for every " +
          "chord quality, which triad built on which scale degree gives which " +
          "colour. Today's exercise is to play a triad built a step or a " +
          "third above the chord root and name the colour tones it produces " +
          "BEFORE you sound it. D major over Cmaj7 gives you the 9, the #11 " +
          "and the 13; Bb major over C7 gives you the b7, the 9 and the 11. " +
          "Say the colour, then play it — in that order.",
        listenFor:
          "Which triad sits over which chord, and what colour it makes — the strip names the " +
          "triad on every note, so you can build the map by reading it back.",
        ready: true,
        exercise: {
          devices: ["triad-pairs"], level: 4, profileId: "bebop",
          controls: { space: 25, altered: 20, intensity: 60 },
          tempo: 92, neckPosition: 3,
          variants: [
            { label: "II-V-I in C", measures: II_V_I("Dm7", "G7", "Cmaj7") },
            { label: "Altered V", measures: ["Dm7", "G7alt", "Cmaj7", "Cmaj7"] },
            { label: "m7b5", measures: staticBars("Cm7b5") },
          ],
        },
        gate: ["For any chord quality called out, name the superimposed triad and its colour tones before playing"],
      },
      {
        id: "4.3", title: "Hexatonics — cross-check & extend", pedagogue: "Bergonzi",
        voice:
          "Vincent gave you the system. Now extend it — hexatonics built from non-adjacent triad " +
          "relationships, and hexatonic-over-hexatonic superimposition for a denser colour.",
        brief:
          "Vincent gave you triads a whole step apart; Bergonzi's extension " +
          "pulls them further apart. Today's exercise is to play a hexatonic " +
          "built from two triads a tritone apart instead — over Cmaj7 that is " +
          "C major and F# major — which still gives you six notes but with " +
          "far more tension, and stops sounding like a scale altogether. Play " +
          "the standard hexatonic and this one back to back so the difference " +
          "is unmistakable.",
        listenFor:
          "A hexatonic built from triads a tritone apart instead of a step — denser, and it " +
          "stops sounding like a scale.",
        ready: true,
        exercise: {
          devices: [{ id: "hexatonics", spread: 6 }], level: 5, profileId: "bebop",
          controls: { space: 20, altered: 30, intensity: 68 },
          tempo: 92, neckPosition: 3,
          variants: [
            { label: "maj7, tritone pair", measures: staticBars("Cmaj7") },
            { label: "dom7, tritone pair", measures: staticBars("C7") },
            { label: "II-V-I in C", measures: II_V_I("Dm7", "G7", "Cmaj7") },
          ],
        },
        gate: ["Distinguish by ear a standard hexatonic from an extended one"],
      },
      {
        id: "4.4", title: "Triadic Chromatic Approach — full chain", pedagogue: "Garzone",
        voice:
          "Chain any of the four triad qualities — major, minor, augmented, diminished — " +
          "connected only by half-step, and never repeat the same inversion twice in a row. " +
          "This is the engine underneath everything I do.",
        brief:
          "This is the engine underneath everything Garzone does, and it has " +
          "exactly three rules. Today's exercise is to chain triads — any of " +
          "the four qualities: major, minor, augmented, diminished — " +
          "connected only by half-step motion, never repeating the same " +
          "inversion twice running and never the same quality twice running. " +
          "Play C major (C–E–G), move a half step from G to G# and play a " +
          "minor triad from there, move a half step from ITS last note and " +
          "play an augmented, and keep going. Start at 76 bpm and do not " +
          "rush. Do not take this to full speed until Chapter 6 is solid — " +
          "that is Garzone's own rule, not ours.",
        listenFor:
          "Triads you can name, connected by nothing but half steps. The strip names the " +
          "quality and the inversion as each one starts — read it back and you can spell the " +
          "chain you just heard.",
        ready: true,
        exercise: {
          devices: ["tca"], level: 5, profileId: "bebop",
          controls: { space: 25, altered: 30, intensity: 65 },
          tempo: 76, neckPosition: 3,
          variants: [
            { label: "Static maj7", measures: staticBars("Cmaj7") },
            { label: "Static dominant", measures: staticBars("G7") },
            { label: "II-V-I in C", measures: II_V_I("Dm7", "G7", "Cmaj7") },
          ],
        },
        gate: [
          "Chain four triads by half-step motion, cold, from any starting triad",
          "Resolve cleanly onto the next chord's chord tone",
          "Do NOT take this to full speed until Chapter 6 is solid — Garzone's own rule",
        ],
      },
    ],
  },

  {
    n: 5,
    title: "Pentatonic & Intervallic Expansion",
    goal: "Widen the melodic palette beyond stepwise and triadic motion.",
    welcome:
      "Everything so far has moved by step or by triad. This chapter breaks that habit on " +
      "purpose — wider intervals, pentatonic fragments, and colour that comes from leaping, " +
      "not running.",
    segments: [
      {
        id: "5.1", title: "Pentatonics & the intervallic thesaurus", pedagogue: "Bergonzi",
        voice:
          "A pentatonic scale off an unexpected scale degree gives you a whole new harmonic " +
          "colour for free. And once you can do that, force yourself to leap — 4ths, 5ths, 6ths " +
          "— instead of stepping. The ear hears space and confidence in leaps.",
        brief:
          "Two habits break here. First, a pentatonic built off a degree that " +
          "is not the root hands you a whole new colour for free — D minor " +
          "pentatonic over Cmaj7, or Bb major pentatonic over C7. Second, " +
          "forbid yourself to step at all. Today's exercise is two passes: " +
          "one drawing only on the colour pentatonic, and one where no " +
          "interval between consecutive notes is smaller than a 4th. The " +
          "leaps will feel wrong for about a chorus, and then they will start " +
          "to sound like confidence.",
        listenFor:
          "First half: a pentatonic off a degree that isn't the root, so the colour arrives free. " +
          "Second half: nothing smaller than a 4th between consecutive notes.",
        ready: true,
        exercise: {
          devices: ["pentatonic"], level: 4, profileId: "bebop",
          controls: { space: 25, altered: 15, intensity: 60 },
          tempo: 92, neckPosition: 3,
          variants: [
            { label: "Pentatonic, II-V-I", measures: II_V_I("Dm7", "G7", "Cmaj7"), devices: ["pentatonic"] },
            { label: "Wide interval, II-V-I", measures: II_V_I("Dm7", "G7", "Cmaj7"), devices: ["wide-interval"] },
            { label: "Both, blues in F", measures: ["F7", "Bb7", "F7", "F7", "Bb7", "Bb7", "F7", "D7"], devices: ["pentatonic", "wide-interval"] },
          ],
        },
        gate: ["A 4-bar phrase using only leaps of a 4th or larger that still resolves correctly"],
      },
      {
        id: "5.2", title: "Pentatonic-flavoured cells", pedagogue: "Vincent",
        voice:
          "Take a melodic cell you already know and re-voice it with wider intervals, or rebuild " +
          "it from a pentatonic fragment instead of a triad. Same shape, new colour.",
        brief:
          "A cell is a shape, and a shape can be rebuilt out of different " +
          "material. Today's exercise is to take a four-note cell you already " +
          "know from chord tones and rebuild it using pentatonic tones only, " +
          "then again with the intervals widened. Same contour, three " +
          "different colours. Play the triadic version and the pentatonic " +
          "version back to back so you can hear it is one idea wearing " +
          "different clothes.",
        listenFor:
          "The Chapter 6 cell shape, rebuilt out of pentatonic tones instead of chord tones. " +
          "Same contour, different colour — play the two variants back to back.",
        ready: true,
        exercise: {
          devices: ["cyclic-quadruplets"], level: 4, profileId: "bebop",
          controls: { space: 20, altered: 10, intensity: 60 },
          tempo: 88, neckPosition: 3,
          variants: [
            { label: "Triadic cell", measures: staticBars("Cmaj7"), devices: ["cyclic-quadruplets"] },
            { label: "Pentatonic cell", measures: staticBars("Cmaj7"), devices: ["pentatonic", "cyclic-quadruplets"] },
            { label: "Wide-interval cell", measures: staticBars("Cmaj7"), devices: ["pentatonic", "wide-interval"] },
          ],
        },
        gate: ["The same cell in its triadic form and its pentatonic-rebuilt form, back to back"],
      },
      {
        id: "5.3", title: "Pentatonic / blues combinations", pedagogue: "Ligon",
        voice:
          "Combine the pentatonic with the blues scale deliberately, and notice that you can " +
          "still build ordinary diatonic triads on top of pentatonic scale degrees — it's not " +
          "an either/or.",
        brief:
          "Pentatonic and blues are not a choice you make once and stick to. " +
          "Today's exercise is to alternate them deliberately over a 12-bar " +
          "blues — one bar of pure pentatonic, one bar of blues scale — and " +
          "to notice that you can still build ordinary diatonic triads on top " +
          "of pentatonic scale degrees. Over F7: F major pentatonic, then F " +
          "blues, bar by bar, with no two consecutive bars using the same " +
          "material.",
        listenFor:
          "Pentatonic and blues are not an either/or — run one variant then the other over the " +
          "same bars and hear where they overlap.",
        ready: true,
        exercise: {
          devices: ["pentatonic"], level: 4, profileId: "bebop",
          controls: { space: 25, altered: 10, intensity: 62 },
          tempo: 96, neckPosition: 3,
          variants: [
            { label: "Pentatonic, blues in F", measures: ["F7", "Bb7", "F7", "F7", "Bb7", "Bb7", "F7", "D7"], devices: ["pentatonic"] },
            { label: "Blues scale, blues in F", measures: ["F7", "Bb7", "F7", "F7", "Bb7", "Bb7", "F7", "D7"], devices: [{ id: "pentatonic", blues: true }] },
            { label: "Last four", measures: ["Gm7", "C7", "F7", "C7"], devices: [{ id: "pentatonic", blues: true }] },
          ],
        },
        gate: ["Completes Chapter 5 — a full 12-bar chorus with no two consecutive bars using the same device"],
      },
    ],
  },

  {
    n: 6,
    title: "Rhythm, Phrasing & Displacement",
    goal:
      "Force every pitch idea built so far through real bebop rhythm before substitution is " +
      "introduced — otherwise substitution just becomes more shapes to memorise.",
    welcome:
      "Every device so far has been about WHAT notes. This chapter is entirely about WHEN. The " +
      "same pitches, displaced by an 8th note, are a different phrase.",
    segments: [
      {
        id: "6.1",
        title: "Deep forward-motion phrasing",
        pedagogue: "Galper",
        voice:
          "Now the full version, not just the landing-note taste from Chapter 2: consistently " +
          "playing behind the beat, every phrase, every chorus, until it's not a technique " +
          "anymore, it's just how you play.",
        brief:
          "Chapter 2 gave you the landing note; this is the full version. " +
          "Today's exercise is to play a complete chorus in which every " +
          "single phrase entrance is off the beat — not one phrase beginning " +
          "on a downbeat. Over a blues in F that means every entry lands on " +
          "an 'and': the & of 4 going into the F7, the & of 2 in the middle " +
          "of it, never on the 1. Push everything a half beat early and let " +
          "the guide tones land where they always landed. It will feel like " +
          "rushing for about two choruses, and then it stops being a " +
          "technique and becomes how you play.",
        listenFor: "Maximum anticipation — phrase entrances pushed off the beat, nearly without exception.",
        ready: true,
        exercise: {
          devices: [], level: 3, profileId: "bebop",
          controls: { space: 20, altered: 20, intensity: 70 },
          tempo: 112, neckPosition: 3,
          variants: [
            { label: "Blues in F", measures: ["F7", "Bb7", "F7", "F7", "Bb7", "Bb7", "F7", "D7"] },
            { label: "II-V-I in C", measures: II_V_I("Dm7", "G7", "Cmaj7") },
          ],
        },
        gate: ["A full chorus where every single phrase entrance is off the beat"],
      },
      {
        id: "6.2", title: "Melodic rhythms", pedagogue: "Bergonzi",
        voice:
          "Take a melodic idea you already own and restate it against a different rhythmic grid " +
          "entirely. The pitches don't change — the placement does, and that's the whole lesson.",
        brief:
          "The same pitches in a different place are a different phrase, and " +
          "this is the exercise that proves it. Today's exercise is to play a " +
          "short phrase — over Cmaj7, say E–F–G–A starting on beat 1 — then " +
          "restate it with identical pitch content, the same notes in the " +
          "same order, starting on the & of 1 instead. Then again, another " +
          "eighth later. Nothing about WHAT you play changes; only when. " +
          "Check that the notes really are identical, because the urge to " +
          "improve the restatement is enormous and giving in to it defeats " +
          "the entire point.",
        listenFor:
          "The same notes coming back in a different place. The reasoning strip marks every " +
          "restated note, so you can check the pitches really didn't move.",
        ready: true,
        exercise: {
          devices: ["displacement"], level: 3, profileId: "bebop",
          controls: { space: 30, altered: 15, intensity: 60 },
          tempo: 92, neckPosition: 3,
          variants: [
            { label: "Eight bars in C", measures: ["Dm7", "G7", "Cmaj7", "Cmaj7", "Dm7", "G7", "Cmaj7", "Cmaj7"] },
            { label: "Blues in F", measures: ["F7", "Bb7", "F7", "F7", "Bb7", "Bb7", "F7", "D7"] },
            { label: "Static chord", measures: staticBars("Cmaj7") },
          ],
        },
        gate: ["One phrase in two rhythmic placements, the notes provably identical"],
      },
      {
        id: "6.3", title: "Rhythm inside the linking formulas", pedagogue: "Baker",
        voice:
          "Go back to the linking formulas from Chapter 2 and notice — really notice — the " +
          "rhythm they're built on. It was never just about which notes connect; it's when they land.",
        brief:
          "Go back to the linking formula from 2.4 and notice what you did " +
          "not notice then: the rhythm underneath it. Today's exercise is to " +
          "play that same handoff — the same approach into B, the 3rd of G7 — " +
          "but syncopated, entering on the & of 3 rather than on beat 3. The " +
          "notes do not change at all, only where they sit. Then have someone " +
          "play one at you and say whether it landed on or off the beat, " +
          "without looking.",
        listenFor:
          "Chapter 2.4's linking formula — the same encirclement into the same targets — now " +
          "entering off the beat. Only the placement changed.",
        ready: true,
        exercise: {
          devices: ["encirclement", "displacement"], level: 3, profileId: "bebop",
          controls: { space: 35, altered: 10, intensity: 58 },
          tempo: 96, neckPosition: 3,
          variants: [
            { label: "C", measures: II_V_I("Dm7", "G7", "Cmaj7") },
            { label: "Eight bars in C", measures: ["Dm7", "G7", "Cmaj7", "Am7", "Dm7", "G7", "Cmaj7", "Cmaj7"] },
          ],
        },
        gate: ["Identify by ear whether a played linking formula lands on- or off-beat"],
      },
      {
        id: "6.4", title: "Cyclic quadruplets", pedagogue: "Ligon",
        voice:
          "A 4-note cell restated against a rotating downbeat — the shape stays fixed, but where " +
          "it starts in the bar keeps moving. This is how one small idea generates a whole chorus.",
        brief:
          "One small idea generates a whole chorus if you keep moving where " +
          "it starts. Today's exercise is to take a single four-note cell — " +
          "over Cmaj7, say E–G–A–G — and restate it over and over with one " +
          "extra note between restatements, so its first note lands an eighth " +
          "later in the bar each time. The shape never changes; its downbeat " +
          "walks around the bar. At every restatement, be able to say exactly " +
          "where beat 1 of the original cell now falls.",
        listenFor:
          "One four-note shape, over and over, with a single hinge note between restatements — " +
          "which is what keeps walking its first note around the bar. Over a static chord the " +
          "four pitches are literally identical every time.",
        ready: true,
        exercise: {
          devices: ["cyclic-quadruplets"], level: 4, profileId: "bebop",
          controls: { space: 15, altered: 10, intensity: 65 },
          tempo: 88, neckPosition: 3,
          variants: [
            { label: "Static chord", measures: staticBars("Cmaj7") },
            { label: "Dorian vamp", measures: staticBars("Dm7") },
            { label: "Eight bars in C", measures: ["Dm7", "G7", "Cmaj7", "Cmaj7", "Dm7", "G7", "Cmaj7", "Cmaj7"] },
          ],
        },
        gate: ["Completes Chapter 6 — a full chorus from one cell, and you can say where beat 1 of the original falls in every restatement"],
      },
    ],
  },

  {
    n: 7,
    title: "Harmonic Substitution & the Unified Minor System",
    goal:
      "Martino-centric capstone of the harmony track: substitution should feel like an extension " +
      "of material already under the fingers, not new shapes.",
    welcome:
      "You already have one system that covers every chord quality — Chapter 1's minor " +
      "conversion. This chapter proves it also covers every substitution, so you never have to " +
      "learn a fifth shape.",
    segments: [
      {
        id: "7.1",
        title: "Minor conversion extended to substitution",
        pedagogue: "Martino",
        voice:
          "Dominant, half-diminished, altered — every one of them still reduces to a converted " +
          "minor or diminished shape. One fingering system, moved around the neck, now also " +
          "covers the substitutions.",
        brief:
          "The tritone substitution is one of the most common ways to bring " +
          "the altered sound into your playing, and it turns up almost " +
          "entirely over the functioning dominant of a major or minor ii-V-I. " +
          "Today's exercise is to glide your minor phrases smoothly over the " +
          "ii chord and straight into the tritone sub of the V — in C major " +
          "that is D minor material over Dm7, then Db7 (the tritone of G7), " +
          "then home to C major. The conversion itself does not change: you " +
          "treat the substituted dominant exactly as you treated the " +
          "original, and the shared tritone — B and F, in both chords — is " +
          "the hinge that makes the two shapes relatives rather than " +
          "strangers.",
        listenFor:
          "The substituted dominant converted the same way as the original. The reasoning strip " +
          "names both moves: the sub, then the minor it converts to.",
        ready: true,
        exercise: {
          devices: ["tritone-sub", "minor-conversion"], level: 5, profileId: "bebop",
          controls: { space: 25, altered: 40, intensity: 65 },
          tempo: 100, neckPosition: 3,
          variants: [
            { label: "C", measures: II_V_I("Dm7", "G7", "Cmaj7") },
            { label: "F", measures: II_V_I("Gm7", "C7", "Fmaj7") },
            { label: "Bb", measures: II_V_I("Cm7", "F7", "Bbmaj7") },
          ],
        },
        gate: [
          "Play the same II-V-I twice — once with the original V, once with its tritone sub",
          "Visibly related minor-conversion shapes both times",
        ],
      },
      {
        id: "7.2",
        title: "Tritone substitution & melodic-minor applications",
        pedagogue: "Ligon",
        voice:
          "Beyond Martino's fingering shortcut, understand the harmony itself: why the tritone " +
          "sub works, and which melodic-minor mode replaces the altered scale over it.",
        brief:
          "Now understand why the substitution works instead of just " +
          "fingering it. Today's exercise is to name the melodic-minor mode " +
          "in play before you sound a single note over each substituted " +
          "dominant. Over G7 altered you are in Ab melodic minor; over its " +
          "tritone sub, Db7, you are in the lydian dominant mode of that same " +
          "parent scale — which is precisely why the two chords are " +
          "interchangeable. Say the parent scale, then play it. Five called- " +
          "out dominants, no chart in front of you.",
        listenFor: "Every dominant reading from the altered scale, deliberately — not sometimes.",
        ready: true,
        exercise: {
          devices: ["tritone-sub", "altered"], level: 5, profileId: "bebop",
          controls: { space: 25, altered: 70, intensity: 65 },
          tempo: 96, neckPosition: 3,
          variants: [
            { label: "C", measures: II_V_I("Dm7", "G7", "Cmaj7") },
            { label: "Minor ii-V-i", measures: ["Dm7b5", "G7", "Cm7", "Cm7"] },
          ],
        },
        gate: ["Name the correct melodic-minor mode for five called-out substituted dominants, no chart"],
      },
      {
        id: "7.3", title: "Turnaround vocabulary", pedagogue: "Baker",
        voice:
          "Turnarounds are where substitution shows up constantly in real tunes. Learn the " +
          "vocabulary formulas built specifically for them, not abstract theory.",
        brief:
          "Turnarounds are where substitution earns its keep, because they " +
          "come round every eight bars in real tunes. Today's exercise is to " +
          "play a I-VI-ii-V and substitute alternating dominants so the roots " +
          "walk down chromatically instead of leaping about. In C that turns " +
          "Cmaj7–A7–Dm7–G7 into Cmaj7–Eb7–Dm7–Db7, and the descending roots " +
          "do most of the work for you. Then take it into a full rhythm- " +
          "changes A section, where the turnaround arrives every eight bars " +
          "whether you are ready or not.",
        listenFor:
          "The turnaround's roots walking down chromatically — that's the substitution every " +
          "turnaround formula is built on. The formulas themselves are vocabulary: play them " +
          "from the Licktionary over these changes.",
        ready: true,
        exercise: {
          devices: ["turnaround"], level: 4, profileId: "bebop",
          controls: { space: 25, altered: 30, intensity: 62 },
          tempo: 100, neckPosition: 3,
          variants: [
            { label: "I-VI-ii-V in C", measures: ["Cmaj7", "A7", "Dm7", "G7"] },
            { label: "I-VI-ii-V in Bb", measures: ["Bbmaj7", "G7", "Cm7", "F7"] },
            { label: "Rhythm changes A", measures: ["Bbmaj7 G7", "Cm7 F7", "Bbmaj7 G7", "Cm7 F7", "Bbmaj7 Bb7", "Ebmaj7 Edim7", "Bbmaj7 F7", "Bbmaj7"] },
          ],
        },
        gate: ["A full rhythm-changes A section using only turnaround-formula material at the turnarounds"],
      },
      {
        id: "7.4", title: "TCA as a substitution device", pedagogue: "Garzone",
        voice:
          "The triad chain from Chapter 4 isn't just melodic colour — use it as a harmonic " +
          "substitution tool over static or altered dominant chords. Same chain, new job.",
        brief:
          "The triad chain from 4.4 was melodic colour. Today it does a " +
          "harmonic job. Today's exercise is to sit on a static or vamping " +
          "dominant and use the chain as the substitute harmony — not " +
          "decorating the chord but replacing it — then resolve cleanly the " +
          "moment the real changes return. Eight bars over G7 with the chain " +
          "running, then land on Cmaj7 as though nothing had happened. The " +
          "resolution is the entire difference between this and noise.",
        listenFor:
          "The same chain as 4.4, but doing a harmonic job: colour over a static dominant that " +
          "resolves the moment the real harmony returns.",
        ready: true,
        exercise: {
          devices: ["tca"], level: 5, profileId: "bebop",
          controls: { space: 20, altered: 40, intensity: 70 },
          tempo: 92, neckPosition: 3,
          variants: [
            { label: "Static dominant", measures: staticBars("G7") },
            { label: "Vamp, then resolve", measures: ["G7", "G7", "G7", "G7", "G7", "G7", "Cmaj7", "Cmaj7"] },
          ],
        },
        gate: ["Completes Chapter 7 — 8 bars over a static dominant using TCA-as-substitution, resolving cleanly"],
      },
    ],
  },

  {
    n: 8,
    title: 'Controlled "Outside" Playing',
    goal:
      "The highest-risk material in the curriculum. Comes after chord-tone landing (Chapter 2) " +
      "and rhythm (Chapter 6) are solid — Garzone's own rule.",
    welcome:
      "Everything up to here has taught you control. This chapter spends it — deliberately, on " +
      "purpose, with a hard rule that you always come back.",
    segments: [
      {
        id: "8.1", title: "TCA combined with Random Chromatic Approach", pedagogue: "Garzone",
        voice:
          "Sustained outside lines that resolve back to chord tones by design, not luck. Combine " +
          "the triad chain with the random chromatic approach, and never let go of the " +
          "resolution rule.",
        brief:
          "Both Garzone systems at once, with the resolution rule non- " +
          "negotiable. Today's exercise is to run the triad chain and the " +
          "random chromatic approach together over a blues in F: sustain " +
          "outside motion for up to two beats, then land on a named chord " +
          "tone — A or Eb over the F7, D or Ab over the Bb7 — before the " +
          "chord changes. Every time, by design, not by luck. Do three " +
          "excursions in a row and name the chord tone each one landed on. If " +
          "you cannot name it, you did not resolve, you just stopped.",
        listenFor:
          "Triad chain and random chromatic approach at once. The resolution is not a matter of " +
          "luck or discipline here — the landing is chosen before the excursion is written, so " +
          "there is nowhere for it to run.",
        ready: true,
        exercise: {
          devices: ["tca", "rca"], level: 5, profileId: "bebop",
          controls: { space: 20, altered: 50, intensity: 75 },
          tempo: 88, neckPosition: 3,
          variants: [
            { label: "II-V-I in C", measures: II_V_I("Dm7", "G7", "Cmaj7") },
            { label: "Blues in F", measures: ["F7", "Bb7", "F7", "F7", "Bb7", "Bb7", "F7", "D7"] },
            { label: "Static dominant", measures: staticBars("G7") },
          ],
        },
        gate: ["Three outside excursions in a row, each resolving to a chord tone within one beat of the change"],
      },
      {
        id: "8.2", title: "Outside and back", pedagogue: "Bergonzi",
        voice:
          "The wide-interval and vocabulary-building material from earlier chapters, repurposed " +
          "with one new constraint: it has to come back. That constraint is the whole skill.",
        brief:
          "The same wide-interval material as 5.1, with one new constraint " +
          "that changes everything about it: it has to come back. Today's " +
          "exercise is to leap your way outside at full intensity and then " +
          "land, every time, on a chord tone at the change — over " +
          "Dm7–G7–Cmaj7, whatever happens in between, arrive on B as the G7 " +
          "begins and on E as the Cmaj7 does. The constraint is the skill: " +
          "anyone can leap outside, the discipline is arriving somewhere on " +
          "purpose.",
        listenFor:
          "Wide-interval material at full intensity that still lands. It cannot escape: the " +
          "engine places the guide-tone anchors before it writes anything between them.",
        ready: true,
        exercise: {
          devices: ["wide-interval"], level: 5, profileId: "bebop",
          controls: { space: 20, altered: 60, intensity: 75 },
          tempo: 100, neckPosition: 3,
          variants: [
            { label: "II-V-I in C", measures: II_V_I("Dm7", "G7", "Cmaj7") },
            { label: "Blues in F", measures: ["F7", "Bb7", "F7", "F7", "Bb7", "Bb7", "F7", "D7"] },
          ],
        },
        gate: ["The same resolution standard as 8.1, using wide-interval material"],
      },
      {
        id: "8.3", title: "Borrowed hexatonics as controlled outside", pedagogue: "Vincent",
        voice:
          "A hexatonic borrowed from a different key centre, dropped in briefly, then released " +
          "back to the real harmony. Same discipline as Garzone's — sound outside, resolve inside.",
        brief:
          "Borrow a hexatonic from a key centre that is not yours, use it " +
          "briefly, and give it back. Today's exercise is to take the " +
          "hexatonic from a half step or a tritone away, drop it in for no " +
          "more than two beats, and resolve into the real harmony. Over " +
          "Cmaj7, borrow the Db hexatonic, then release it. Afterwards, name " +
          "which key centre you borrowed from — if you cannot, you were not " +
          "borrowing, you were guessing.",
        listenFor:
          "A hexatonic lifted a half step or a tritone away from home, dropped in, and released. " +
          "The strip names how far it was borrowed, so you can answer the gate from it.",
        ready: true,
        exercise: {
          devices: [{ id: "hexatonics", borrow: 1 }], level: 5, profileId: "bebop",
          controls: { space: 25, altered: 40, intensity: 70 },
          tempo: 96, neckPosition: 3,
          variants: [
            { label: "Borrowed a half step", measures: II_V_I("Dm7", "G7", "Cmaj7"), devices: [{ id: "hexatonics", borrow: 1 }] },
            { label: "Borrowed a tritone", measures: II_V_I("Dm7", "G7", "Cmaj7"), devices: [{ id: "hexatonics", borrow: 6 }] },
            { label: "Static chord", measures: staticBars("Cmaj7"), devices: [{ id: "hexatonics", borrow: 1 }] },
          ],
        },
        gate: ["Demonstrate the borrowed hexatonic and name which key centre it came from"],
      },
      {
        id: "8.4",
        title: "Symmetrical shapes as an outside resource",
        pedagogue: "Martino",
        voice:
          "The conversion system already gave you diminished and augmented symmetric shapes. Use " +
          "them here on purpose, as colour, always inside the same resolution discipline.",
        brief:
          "The conversion system already handed you diminished and augmented " +
          "shapes. They are symmetric, which means they repeat evenly up the " +
          "neck and sound deliberately unmoored from any key. Today's " +
          "exercise is to use them on purpose as outside colour over an " +
          "altered dominant: over G7alt run the Ab diminished and augmented " +
          "shapes, then resolve into Cmaj7 under exactly the same discipline " +
          "as the rest of this chapter. Move between all four Chapter 8 " +
          "devices across a single eight-bar phrase, resolving every " +
          "excursion.",
        listenFor:
          "Outside colour that never escapes the next landing — the engine places the guide-tone " +
          "anchors first, so an excursion is bounded by construction.",
        ready: true,
        exercise: {
          devices: ["minor-conversion", "altered"], level: 5, profileId: "bebop",
          controls: { space: 30, altered: 85, intensity: 70 },
          tempo: 96, neckPosition: 3,
          variants: [
            { label: "Static dominant", measures: staticBars("G7") },
            { label: "II-V-I in C", measures: II_V_I("Dm7", "G7", "Cmaj7") },
          ],
        },
        gate: ["Completes Chapter 8 — an 8-bar phrase moving between the Chapter 8 devices, every excursion resolved"],
      },
    ],
  },

  {
    n: 9,
    title: "Vocabulary Synthesis & Personal Language",
    goal:
      "Where the systems stop being separate and get filtered into one personal vocabulary " +
      "through transcription — the actual point of the whole curriculum.",
    welcome:
      "Everything so far has been someone else's system. This chapter is where it becomes " +
      "yours — by listening, copying, and only then, changing it.",
    segments: [
      {
        id: "9.1", title: "Developing a jazz language", pedagogue: "Bergonzi",
        voice:
          "Transcription is not homework, it's the method. Take a phrase you didn't write, get " +
          "it note-perfect, then change one thing about it on purpose.",
        brief:
          "Transcription is not homework, it is the method — and the " +
          "Workbench is where you drill the mechanism before taking it to a " +
          "record. Today's exercise is call and response: a phrase plays over " +
          "Dm7–G7–Cmaj7 with the notation hidden, you work it out on the " +
          "guitar, you enter what you heard, and only then do you reveal it. " +
          "Do not reveal early. Being wrong and seeing exactly where you were " +
          "wrong is the entire value. Five phrases, and once each is note- " +
          "perfect, change one thing about it on purpose.",
        listenFor:
          "Nothing, at first — that's the point. The phrase plays with the notation hidden. Work " +
          "it out on the guitar, enter what you heard, then reveal and see exactly which notes " +
          "you missed and which you put in the wrong octave.",
        ready: true,
        workbench: true,
        gate: [
          "Transcribe five reference phrases",
          "At least one deliberate personal variation on each",
        ],
      },
      {
        id: "9.2",
        title: "Applying everything to tunes",
        pedagogue: "Baker",
        voice:
          "Every device from every chapter, now over a real tune, not an isolated exercise. If " +
          "you can't do it over a tune, you don't actually own it yet.",
        brief:
          "Every device from every chapter, now over a real tune instead of " +
          "an isolated exercise. Today's exercise is to solo a full chorus of " +
          "Autumn Leaves — Cm7–F7–Bbmaj7–Ebmaj7 and onward — choosing your " +
          "own devices as you go, and then, afterwards rather than during, " +
          "label which chapter each phrase came from. If you cannot trace a " +
          "phrase to a segment, that is the diagnostic: go back and re-drill " +
          "that segment rather than adding anything new on top.",
        listenFor: "Your own choice of devices. Then read the strip back and see whether you can name them.",
        ready: true,
        exercise: {
          devices: [], level: 4, profileId: "bebop",
          controls: { space: 30, altered: 35, intensity: 65 },
          tempo: 104, neckPosition: 3,
          variants: [
            { label: "Autumn Leaves opening", measures: ["Cm7", "F7", "Bbmaj7", "Ebmaj7", "Am7b5", "D7", "Gm7", "Gm7"] },
            { label: "Blues in F", measures: ["F7", "Bb7", "F7", "F7", "Bb7", "Bb7", "F7", "D7"] },
          ],
        },
        gate: ["Solo a full chorus, then correctly label which chapter each phrase came from"],
      },
      {
        id: "9.3",
        title: "Until it stops sounding like an exercise",
        pedagogue: "Galper",
        voice:
          "Forward motion should be invisible by now — not a technique you're doing, just how " +
          "you hear. If it still feels like an exercise, that's fine: go back to Chapter 2 and " +
          "Chapter 6 and keep going.",
        brief:
          "Forward motion should be invisible by now. Today's exercise " +
          "deliberately has no device and no direction: play a full chorus " +
          "and try to notice nothing. If phrasing behind the beat still feels " +
          "like something you are doing rather than simply how you hear, that " +
          "is not a failure, it is information — go back to Chapter 2 and " +
          "Chapter 6 and keep going.",
        listenFor: "Nothing in particular. That's the test.",
        ready: true,
        exercise: {
          devices: [], level: 4, profileId: "bebop",
          controls: { space: 35, altered: 30, intensity: 70 },
          tempo: 120, neckPosition: 3,
          variants: [
            { label: "II-V-I in C", measures: II_V_I("Dm7", "G7", "Cmaj7") },
            { label: "Blues in F", measures: ["F7", "Bb7", "F7", "F7", "Bb7", "Bb7", "F7", "D7"] },
          ],
        },
        gate: ["A listener can no longer identify which device produced a given phrase"],
      },
      {
        id: "9.4", title: "Real solo excerpts as templates", pedagogue: "Ligon",
        voice:
          "Study excerpts from real recorded solos — Adderley, Harrell, Gordon — the same way " +
          "you studied the Workbench's generated phrases. A great line is a specific, namable " +
          "choice made by a specific player, and you can make that same choice.",
        brief:
          "A great line is a specific choice made by a specific player, and " +
          "you can make that same choice once you know what it was. Today's " +
          "exercise is to put on a record — Adderley, Harrell, Gordon — and " +
          "take four bars down by ear using exactly the mechanism you drilled " +
          "in 9.1: listen, work it out on the guitar, write it down, then " +
          "check it. Save it, tag it, and then change one thing about it " +
          "deliberately. Three excerpts.",
        listenFor:
          "Bring your own excerpts. Put on Adderley, Harrell or Gordon, take four bars down by " +
          "ear the same way you took down the Workbench's phrases, and save it. The library " +
          "ships empty deliberately — DukeBox will not hand you a transcription of a real " +
          "player's solo and call it study material, because taking it down yourself IS the " +
          "study. Use the Workbench to drill the mechanism, then do it to a record.",
        ready: true,
        workbench: true,
        gate: ["Completes Chapter 9 — transcribe and personally vary three excerpts, saved to the Licktionary"],
      },
    ],
  },

  {
    n: 10,
    title: "Full-Tune Integration & Capstone Repertoire",
    goal: "Revisited indefinitely as new tunes are added; the test of whether the curriculum landed.",
    welcome:
      "This is the only chapter that never really ends. Every tune you add here is a fresh test " +
      "of everything above it.",
    segments: [
      {
        id: "10.1",
        title: "Twelve-bar blues",
        pedagogue: "Repertoire",
        voice:
          "The whole toolkit over the form everything else is measured against. Point at any " +
          "four-bar stretch and name the chapter its reasoning tag traces to.",
        brief:
          "The form everything else is measured against. Today's exercise is " +
          "to solo a full 12-bar chorus using whatever you now own, then " +
          "point at any four-bar stretch and name the chapter and segment its " +
          "phrases came from. Start with bars 1–4 and the move to the Bb7 in " +
          "bar 5, where the first real chord change happens. This is a " +
          "diagnostic rather than a lesson: you are testing whether the " +
          "curriculum landed, and any stretch you cannot trace tells you " +
          "exactly which chapter to go back to.",
        listenFor: "Your own reading of the strip — this chapter is a diagnostic, not a lesson.",
        ready: true,
        exercise: {
          devices: ["bebop-scale"], level: 4, profileId: "bebop",
          controls: { space: 25, altered: 30, intensity: 65 },
          tempo: 112, neckPosition: 3,
          variants: [
            { label: "Blues in F, first 8", measures: ["F7", "Bb7", "F7", "F7", "Bb7", "Bb7", "F7", "D7"] },
            { label: "Blues in F, last 4", measures: ["Gm7", "C7", "F7", "C7"] },
          ],
        },
        gate: ["Point at any 4-bar stretch and name the chapter/segment its tag traces to"],
      },
      {
        id: "10.2",
        title: "Rhythm changes",
        pedagogue: "Repertoire",
        voice: "The same test over the other form every player is expected to own.",
        brief:
          "Rhythm changes moves twice as fast harmonically and punishes " +
          "anything you only half know. Today's exercise is the same test as " +
          "10.1 over the A section, with one added constraint: where the " +
          "harmony moves two chords to the bar, compress to one device per " +
          "chord rather than trying to cram a whole formula into two beats. " +
          "Then trace every turnaround back to Chapter 7.",
        listenFor: "Fast harmonic rhythm — two chords per bar means one device per chord.",
        ready: true,
        exercise: {
          devices: [], level: 4, profileId: "bebop",
          controls: { space: 25, altered: 30, intensity: 68 },
          tempo: 120, neckPosition: 3,
          variants: [
            { label: "A section, Bb", measures: ["Bbmaj7 Gm7", "Cm7 F7", "Bbmaj7 Gm7", "Cm7 F7", "Bbmaj7 Bb7", "Ebmaj7 Edim7", "Bbmaj7 F7", "Bbmaj7"] },
            { label: "Bridge, first 4", measures: ["D7", "D7", "G7", "G7"] },
          ],
        },
        gate: ["Every turnaround traceable to a chapter"],
      },
      {
        id: "10.3", title: "Tune Up / Have You Met Miss Jones", pedagogue: "Repertoire",
        voice:
          "A ii-V-I-heavy standard and a string-of-dominants standard — the two forms that test " +
          "whether the substitution chapter actually landed.",
        brief:
          "Two tunes that test opposite things. Today's exercise is a full " +
          "chorus of each, tracing every four-bar stretch back to a chapter. " +
          "Tune Up is three plain ii-V-Is descending by whole step — " +
          "Em7–A7–Dmaj7, then Dm7–G7–Cmaj7, then Cm7–F7–Bbmaj7 — so there is " +
          "nowhere for weak substitution to hide. Have You Met Miss Jones has " +
          "a bridge that drops through three key centres a major third apart " +
          "(Bb, then Gb, then D), which nothing else in the library does; " +
          "treat each as its own key rather than straining to hear a single " +
          "tonal centre. Both tunes are in the Songbook now, so play them " +
          "with the band.",
        listenFor:
          "Tune Up is three plain ii-V-Is descending — the substitution chapter has nowhere to " +
          "hide. Miss Jones's bridge drops through three key centres a major third apart, which " +
          "nothing else in the library does.",
        ready: true,
        exercise: {
          devices: [], level: 4, profileId: "bebop",
          controls: { space: 30, altered: 30, intensity: 65 },
          tempo: 120, neckPosition: 3,
          variants: [
            { label: "Tune Up, first 8", measures: ["Em7", "A7", "Dmaj7", "Dmaj7", "Dm7", "G7", "Cmaj7", "Cmaj7"] },
            { label: "Tune Up, last 8", measures: ["Cm7", "F7", "Bbmaj7", "Bbmaj7", "Em7b5", "A7alt", "Dmaj7", "Dmaj7"] },
            { label: "Miss Jones, A section", measures: ["Fmaj7", "F#dim7", "Gm7", "C7", "Am7 D7", "Gm7 C7", "Fmaj7", "Gm7 C7"] },
            { label: "Miss Jones, the bridge", measures: ["Bbmaj7", "Abm7 Db7", "Gbmaj7", "Em7 A7", "Dmaj7", "Abm7 Db7", "Gbmaj7", "Gm7 C7"] },
          ],
        },
        gate: [
          "A full chorus of each, every 4-bar stretch traceable",
          "Both tunes are in the Songbook now — play them there with the band",
        ],
      },
    ],
  },
]

// Flat, ordered segment list — the curriculum is a single sequence, and the
// gate rule ("one segment fully drilled before the next unlocks") only makes
// sense against that ordering, not per chapter.
export const SK_SEGMENTS = SK_CHAPTERS.flatMap((chapter) =>
  chapter.segments.map((segment) => ({ ...segment, chapter: chapter.n, chapterTitle: chapter.title }))
)

export function skSegment(id) {
  return SK_SEGMENTS.find((s) => s.id === id) || null
}

// The tag stamped into every generated bar's reasoning, so a phrase can
// always be traced back to the segment that asked for it.
export function skTag(segment) {
  return `[Ch.${segment.chapter} · ${segment.id} ${segment.pedagogue}]`
}

// ─── Progress ─────────────────────────────────────────────────────────────
// Which gate boxes are ticked, per segment. Local to the browser: it's the
// student's own record of what they've drilled, not shared state.

const KEY = "dukebox.skeletonKey"

export function loadProgress() {
  if (typeof window === "undefined") return {}
  try {
    return JSON.parse(window.localStorage.getItem(KEY) || "{}") || {}
  } catch {
    return {}
  }
}

export function saveProgress(progress) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(KEY, JSON.stringify(progress))
  } catch {
    // storage unavailable — progress is a convenience, never the lesson
  }
}

export function segmentComplete(segment, progress) {
  const ticked = progress?.[segment.id] || []
  return segment.gate.every((_, i) => ticked.includes(i))
}

// A segment is available when every segment before it is complete. The first
// one is always available, and `unlockAll` is the escape hatch — being locked
// out of your own app is worse than skipping ahead.
export function segmentAvailable(segment, progress, unlockAll = false) {
  if (unlockAll) return true
  const index = SK_SEGMENTS.findIndex((s) => s.id === segment.id)
  if (index <= 0) return true
  return SK_SEGMENTS.slice(0, index).every((s) => segmentComplete(s, progress))
}
