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
