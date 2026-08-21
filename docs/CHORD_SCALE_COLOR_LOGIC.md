# Chord & Scale Color Logic

How the fretboard decides what color (and size, and stroke, and glow) every
note gets — chord tones vs. non-chord tones, the 3rd/7th guide-tone pair, the
root, and the marks that point at the *upcoming* chord — and how those
decisions shift with the kind of progression the bar sits in.

Source of truth for everything below:

| Concern | File |
|---|---|
| Dot roles, colors, sizes, paint order, ghosts, routes, arrows | `src/components/Fretboard.js` |
| The color tokens themselves (`--n-*`, `--fb-*`) | `src/app/globals.css` (":root — Constant sub-systems") |
| Which notes land in each role set per bar | `src/app/page.js` (fretboard card section) |
| Guide-tone / 3rd Hunter / melody selection per bar | `src/components/MelodyPaths.jsx` |
| One-landing-note voice-lead path (target + bridge) | `src/lib/music/voiceLeadPath.js` |
| Progression analysis (function labels, cadences) | `src/lib/music/harmony.js` |
| Scale recommendation & filters per chord quality | `src/lib/music/tonal.js` |
| 3:2 System boards (their own separate color set) | `src/lib/music/threeTwoSystem.js` |

---

## 1. The design rule everything follows

**Color ranks notes by what they are *for*, not by what they *are*.**

A resolution target and the guide tones outrank the root, even though the root
is "more fundamental" in theory terms — because the bass player is already
covering the root, which makes it the least useful note on the screen to a
soloist. The hierarchy is about where your next note should come from, not
about spelling the chord correctly.

Three consequences:

1. **One role per dot.** A note that qualifies for several roles (say, a note
   that is both a chord tone and this transition's landing target) gets
   exactly one color — the highest-priority role wins (§3).
2. **Size carries the same ranking as color**, so the hierarchy survives in
   peripheral vision and for anyone who can't separate the hues.
3. **The palette never changes.** All note-role colors are fixed `--n-*`
   tokens, deliberately independent of the app's six switchable UI palettes —
   a Bb7 diagram looks identical whichever palette is active
   (`globals.css` "Constant sub-systems", spec `PRACTICE_REDESIGN_V3.md` §4.7).

---

## 2. The color vocabulary

All tokens live in `globals.css`; the hues were chosen for contrast against
the two maple wood stops (`--fb-wood-1: #EEC788`, `--fb-wood-2: #DDA85A`),
which is why several "obvious" colors (bright gold, amber, teal) were rejected
— the comments in `globals.css` record the measured contrast ratios.

### Current-chord roles

| Token | Hex | Role | Meaning to the player |
|---|---|---|---|
| `--n-root` | `#DC2626` red | Root of the current chord | Home base — but ranked *below* guide tones (the bass has it covered) |
| `--n-chord` | `#16A34A` green | Chord tone (3-5-7, and the root when a higher role claims red away) | Safe to land on any beat |
| `--n-scale` | `#047857` deep teal-green | Scale tone that is **not** a chord tone | Pass-through material — connect, don't sit |
| `--n-target` | `#2563EB` blue | The lit guide tone (the current chord's **3rd**) — and, in Voice Leading path mode, the one landing note | The note that defines the chord's quality |
| `--n-seventh` | `#8A6100` gold-bronze | The current chord's **7th**, when guide tones are lit | The 3rd's partner; same size, different hue, so the pair reads as a pair |
| `--n-passing` | `#57534E` warm gray | Chromatic **bebop / Barry passing tone** added by an overlay | Chromatic glue between scale tones — never a resting place |
| `--n-enclosure` | `#9333EA` purple | Enclosure notes (½ step either side of a target) and 3rd Hunter's lead-in | The chromatic cage / walk-in around a target |
| `--n-bridge` / `--n-bridge-fill` | `#A855F7` on pale lavender | The **chromatic bridge** — the springboard a half step from the landing note | Same purple family as enclosure (both mean "chromatic approach") but deliberately pale: a stepping stone, never a destination |

### Upcoming-chord marks

| Token | Hex | Role |
|---|---|---|
| `--n-next` / `--n-next-fill` | `#821767` magenta, near-white fill | Everything that belongs to the **next** chord: ghost dots, the routes drawn into them, and the "hold this note" ring. Hue 315 was picked because it sits in the only real gap left on the role wheel (44° from its nearest neighbors, enclosure at 271° and root at 0°) |
| `--n-target-glow` | `rgba(37,99,235,.45)` | The soft pulse behind targets and guide tones — glow is reserved for landing notes only; the bridge never glows |

### The 3:2 System's separate world

When the 3:2 System drives the board it **replaces this entire vocabulary**
with the exact colors of the reference page it was ported from
(`public/reference/pentatonic-32-navigator.html`) — the point is that the
board reads identically to the standalone page:

| Token | Hex | Role |
|---|---|---|
| `--n-32-red` / `--n-32-red-band` | `#E2402F` / pale band | The "red" pentatonic group (roots drawn hollow inside their band) |
| `--n-32-blue` / `--n-32-blue-band` | `#1D9BF0` / pale band | The "blue" pentatonic group; on the Level-0 chord-scale board, plain chord tones |
| `--n-32-tension` | `#FBFAF6` off-white, gray stroke | Level-0 tensions (non-chord scale tones) — smaller, quieter |
| `--n-32-green` | `#5FE08C` light green | The **blue note**: the b3 of a minor pentatonic "chased" onto a dominant chord's own root, or Level 2's deliberately-bendable tweak 3rd |

---

## 3. Role priority — how one dot picks its color

`Fretboard.js` computes membership in every role set, then resolves each
fret/string position top-down. First match wins:

```
resolution target  >  guide tone  >  chromatic bridge  >  bebop passing
                   >  enclosure   >  root              >  scale / chord tone
```

Concretely (`Fretboard.js`, the dot-building loop):

```js
const color = isSeventh ? "var(--n-seventh)"     // guide-tone 7th: gold
            : isTarget  ? "var(--n-target)"      // landing note: blue
            : isGuide   ? "var(--n-target)"      // guide-tone 3rd: blue
            : isBridge  ? "var(--n-bridge-fill)" // chromatic springboard
            : isPassing ? "var(--n-passing)"     // bebop/Barry chromatic
            : isEnclosure ? "var(--n-enclosure)" // chromatic cage / lead-in
            : isRoot    ? "var(--n-root)"        // root, red
            : view === "scale" && !chordSet.has(noteName)
                        ? "var(--n-scale)"       // non-chord scale tone
            : "var(--n-chord)"                   // chord tone
```

Notes on the deliberate choices in that ladder:

- **Guide tones and targets share blue** (`--n-target`); **size** is what
  tells them apart — guide tone r=11, target r=10, everything ordinary r=8.5,
  enclosure r=8, bridge r=7. The bridge is intentionally the smallest marked
  note on the board: a stepping stone, not a destination.
- **The 7th is a guide tone like the 3rd and the same size; only the hue
  differs** — so the 3rd/7th pair reads as a pair without collapsing into one
  note. The `seventhNotes` set only recolors a dot that is already a guide
  tone or target.
- **The bridge outranks a coinciding bebop passing tone.** Both mean
  "chromatic", but the bridge is *this transition's* springboard.
- **The root loses red whenever a higher role claims the same pitch** — e.g.
  when the next chord's landing target happens to be the current root, the
  dot is blue, not red. Function over identity.
- **Paint order repeats the ranking**: dots are sorted so targets and guide
  tones are drawn last and always paint over lesser dots; routes and ghosts
  are drawn *under* the dots so a line never hides a note.
- **Glow repeats it again**: only targets and guide tones pulse with
  `--n-target-glow`.

### Chord tones vs. non-chord tones

- **Chord view** (`view="chord"`): only the chord's own spelling is lit —
  root red, the rest green (or blue/gold if guide tones are lit on top).
- **Scale view** (`view="scale"`): the full recommended scale (or the active
  filter's subset — pentatonic, hexatonic, Martino, Hex·Chord, Barry) is
  drawn, but chord tones **stay green inside the scale carpet** while
  non-chord scale tones drop to the darker `--n-scale`. The intended reading:
  *chord tones to bounce around, scale tones to pass through* — two colors on
  purpose, even in scale view.
- **Chromatic non-scale tones** only appear via an explicit overlay, each
  with its own color: bebop/Barry passing tones (gray), enclosure notes
  (purple), the voice-lead bridge (pale lavender). Gray = "generic chromatic
  glue"; purple family = "chromatic approach aimed at a specific target".

---

## 4. 3rds, 7ths, roots — the guide-tone layer

`MelodyPaths.jsx` analyzes every bar (`analyzeChord`) and hands the fretboard
per-bar note maps. Interval reading is pragmatic, not pedantic: sus2/sus4
stand in for a missing 3rd, a 6th stands in for a missing 7th.

- **`notesByBar`** — the lit guide tones. Both the 3rd **and** the 7th, at
  equal weight: they are the pair that spells the chord's quality and the
  pair that voice-leads (7→3 one way, 3→7 the other). Emphasizing one over
  the other hid half of every resolution, so the board doesn't.
- **`seventhsByBar`** — which of those is the 7th, so it renders gold
  (`--n-seventh`) instead of blue at the same size.
- The chart line above the board still picks a single strand per bar
  (**7/3 mode** alternates sevenths and thirds; **smooth mode** minimizes
  degree movement bar-to-bar, with a small built-in bonus for the classic
  7→3 move), but the fretboard always lights the full pair.

**Why the root ranks last among the "important" notes:** the red root dot
survives only when nothing above it claims the pitch. It draws a slightly
heavier stroke and slightly larger label than plain chord tones — findable
when you want an anchor, never competing with the notes that actually carry
the harmony (3rd/7th) or the change (target/bridge).

---

## 5. Upcoming-chord targets — the connection layer

This is the layer that answers "how do I get from this chord into the next
one", and it is where most of the color system's precision is spent. The next
sounding bar is found loop-aware (`anticipateBarIndex` in `page.js` wraps
inside the loop range, skipping `NC` bars), so the "next chord" is always the
one you will actually hear next.

### 5.1 Voice Leading path mode (the default)

`voiceLeadPath.js` collapses the old "light both guide tones, ghost both of
the next chord's guide tones everywhere" display into **one path per
transition** — the board never shows more than two future marks:

- **One landing note** (`--n-target` blue, glowing): a role of the *next*
  chord — its **3rd, root, or 7th** — chosen by `targetPref`:
  - `nearest` (default): the role reachable by the smallest *real* motion
    from any current chord tone. Weighting: **half step beats whole step
    beats common tone beats leap**. A common tone ranks below actual motion
    on purpose — a ii–V shares tones constantly, and if "hold that note" won
    every time, the mode would never teach the 7→3 move it exists for. Ties
    break 3rd > root > 7th.
  - `third` / `root` / `seventh`: pinned to that role, falling back through
    the same order when the chord lacks it (a sus has no 3rd).
  - `random`: seeded per transition, so one loop pass keeps its choices but
    the second chorus can't be played from memory.
- **At most one chromatic bridge** (`--n-bridge` pale lavender, dashed
  stroke, smallest dot on the board), added *only when needed*:
  - target is already a current chord tone → **held**, no bridge;
  - a current chord tone sits a half step away → no bridge, the move is
    direct ("slide in");
  - anything farther → bridge = the chromatic note a half step from the
    target, on the side facing the nearest current chord tone (so the gesture
    flows one way), defaulting to **below** — the classic bebop approach —
    when there's nothing to face.
- A **bridge → target link** is drawn as one short curve under the dots, in
  the bridge purple: the two-note path, which at a half step usually reads as
  the adjacent fret on the same string.
- Meanwhile the current chord's tones all render at **equal weight** — no lit
  guide tones in this mode. While the chord sounds, any chord tone is as good
  as any other; the only moment that carries weight is beat 1 of the
  transition. A prose readout under the board says the same sentence the
  colors are drawing: "land on **X** (3rd) · via **Y**".

### 5.2 Ghosts, routes, arrows, and the held ring

The board has a general "next chord" drawing system, all in `--n-next`
magenta so future material can never be confused with present material:

- **Ghosts** — hollow magenta-ringed dots for next-chord notes, drawn on
  *this same neck* rather than on a second board, so there is no mental
  register-mapping between two graphics at tempo: at the bar change they are
  already where your eye is. A ghost's degree label is computed against the
  **next** chord's root (`ghostRootNote`), not the current one — labelling
  the next chord's 3rd against the current root would name it something you'd
  never call it.
- **Routes** — magenta curves from a live guide tone to its ghost: literally
  the shortest *playable* voice-leading path. A route is only drawn within
  3 frets / 1 string crossing (crossing a string costs more than sliding a
  fret); beyond that the "shortest path" stops being a path you'd actually
  play, and the line would lie about the fingering.
- **Resolution arrows** (`guideToneDirections`) — glyphs above a guide tone:
  `→` up a semitone, `→→` up a whole tone, `←`/`←←` down, `=` common tone.
  **Only motion of a semitone or whole tone counts as a resolution** — an
  earlier version marked the cyclically nearest guide tone, which could be up
  to six semitones away and would confidently label a fourth a "resolution";
  now a bigger leap yields no arrow at all. Arrow direction matches the
  direction you physically move along the neck. Where a route or a held ring
  already shows the resolution, the arrow is suppressed for that dot — it
  would only repeat the information.
- **The held ring** — a guide tone the next chord *also* contains gets a
  magenta ring drawn inside the dot: nothing to move, so it gets a ring
  rather than a route. "Stay put" is information worth drawing.

### 5.3 3rd Hunter and the enclosure cage

3rd Hunter re-purposes the same layers for a targeting drill
(`computeHunter3` in `MelodyPaths.jsx`):

- The lit blue guide tone is **this chord's own 3rd** (no arrow on it).
- The **lead-in** — the note over *this* chord that walks into the *next*
  bar's 3rd — draws in enclosure purple and carries the arrow. Candidate
  lead-ins are the chord's own tones, 7th considered first so the classic
  7→3 resolution wins an otherwise-equal tie; a half step from either side
  qualifies, a whole step only from above (falling into the target — a whole
  step from below is too far to read as a resolution).
- **+Enclosure** adds the Peña chromatic cage: the half step below *and*
  above the next bar's target 3rd, both purple with a dashed halo ring, shown
  on the **current** bar's board so the cage is visible before the chord
  arrives. The previewed target itself renders blue so the arrow has
  somewhere to point.

### 5.4 The bar-phase animation — *when* colors appear

When the transport is playing, the connection layer is time-gated to the
bar's actual duration (CSS keyframes scaled to `barSeconds`, no JS animation
loop). The bar has a shape:

- **Beats 1–2** — the playground: current chord/scale colors only.
- **Beat 3** — the ghosts and the landing target fade up; routes start
  drawing themselves along the neck; the bridge follows a touch dimmer.
- **Beat 4** — routes at full; the bridge ticks up to full ("you're up") in
  the order you'll actually play the two notes; and **everything that isn't a
  guide tone or target dims to 40%**, so you are pulled into the change
  instead of being surprised by it.

Dimming only happens when something stays lit (`hasLitLayer`) — with no
guide/target layer on the board there is nothing to step back for, and the
whole neck would otherwise fade once a bar. `prefers-reduced-motion` disables
all of it.

---

## 6. How progression type changes the coloring

The role sets above are *computed* per bar from the surrounding progression,
so the same chord symbol colors differently depending on what it is doing.
`harmony.js` (`analyzeProgressionContext` → `detectLocalFunction`,
`detectCadenceAt`) supplies the read.

### Function labels (per bar, context-aware)

| Situation | Label | Downstream color consequences |
|---|---|---|
| Dominant resolving down a 5th | `dominant` (+ cadence flag) | Eligible for the **Altered** overlay; 3:2 Level 3 gives it the altered-pentatonic treatment |
| Dominant resolving down a half step | `tritone sub` | Recognized as functional; V–I / V–i cadence detection accepts the sub |
| Dominant moving **up** a half step | `backdoor` | Labelled but not treated as a resolving cadence |
| Minor chord a 4th below a following dominant | `subdominant` (a functioning **ii**) | The Hexatonic filter hands it the Dorian-flavored minor hex from its own root — it is *going somewhere*, so it gets the sound that leans forward |
| Minor chord not feeding a dominant | `minor` (tonic-ish) | Hexatonic instead reaches for the melodic-minor hex a minor ii–V–i actually resolves to |
| Major after a resolving dominant | `tonic` | Post-cadence arrival; substitution engine offers maj6 "landing" color |
| Anything else | `color` | Neutral treatment |

### Cadences (`ii–V–I`, `iiø–V–i`, `V–I`, `V–i`, ii–V fragments)

- **Altered overlay** (`alteredMap` in `page.js`) only activates on a bar
  whose function is `dominant` **and** which sits in a detected cadence — a
  non-resolving dominant never gets the altered treatment. When active:
  chord view re-spells the board as the **tritone sub's** chord tones from
  root+6; scale/pentatonic views draw the **melodic minor a half step above**
  the dominant's root (and its m6-pentatonic reduction, 1 b3 4 5 6). The
  board's red root moves to the substitute root — the coloring follows the
  reharmonization, not the written symbol.
- **Minor ii–V–i** (`iiø–V–i`): the cadence's resolution tonic
  (`resolvesToMinorTonic`) is surfaced on **all three** bars, so the
  harmonic-minor-251 scale strategy colors the whole three-bar unit as one
  harmonic-minor collection — whichever of the three bars is selected, the
  scale carpet (and therefore the green/teal chord-vs-scale split) is built
  from the *i* chord's harmonic minor.
- **Voice-lead targets across a ii–V**: because a ii–V shares tones
  constantly, the `nearest` weighting's demotion of common tones (§5.1) is
  what keeps the blue landing note showing the 7→3 half-step move instead of
  repeatedly saying "hold".

### Scale recommendation per quality (the base carpet)

`getRecommendedScalesFromQuality` picks the default scale whose non-chord
tones become the teal layer: maj7 → major/Lydian; min7 → Dorian first;
min(maj7) → melodic minor; min7b5 → Locrian/Locrian ♮2; dim7 → diminished;
7alt/7b9 → altered; plain 7/9 → Mixolydian. A per-bar user override
(`userScale`/`userTonic`) beats all of it.

### Bebop / Barry passing tones (quality-dependent chromatics)

The gray `--n-passing` dots are placed by chord family: dominants and minor
chords get the major 7th between b7 and root; major chords get the #5 between
5 and 6. Six-note systems (Hexatonic, Hex·Chord, Martino) switch to a
dedicated **two-note** passing rule (`getHexatonicBebopNotes`) tuned to
six-note scales. Barry Harris's 6th-diminished scale ships with its passing
tone built in and shows it in the same gray.

### The 3:2 System's form-level read

`classifySongForm` classifies the *whole chart* (blues, minor blues, jazz
blues, major/minor standard, modal vamp) and its level ladder decides the
board per bar:

- **Level 1 (blues)** — one blanket pentatonic colored over the entire form;
  with Voice Leading on, the *current* chord's own spelling ghosts in magenta
  over the fixed box (an E7 in an A blues ghosts E–G#–B–D over A minor
  pentatonic). No routes — nothing is resolving, it is showing what's here.
- **Levels 2–3** — per-chord pentatonics; a **resolving dominant** (function
  `dominant` + cadence, again) gets the altered b3-up pentatonic and the
  green `--n-32-green` blue-note callout.
- **3:2 + Voice Leading** — ghosts every position of the **next chord's
  3rd** (one note, not the 3rd/7th pair — a pentatonic shape doesn't reliably
  contain the 7th to pair it with) and draws the single shortest playable hop
  from the current shape onto it.

---

## 7. Quick legend (what the player is told)

The on-screen legend under the board is the compressed version of this whole
document:

> ● Root · ● Chord tone · ● Scale tone · ● Bebop/Barry passing ·
> ● 3rd of this chord (blue) / Land here on beat 1 · ● 7th of this chord
> (gold) · ◌ Chromatic bridge — the springboard in · ◌ Enclosure (½ step
> around next target) · ○ magenta = next chord (ghosts, routes, hold-ring) ·
> → up a semitone · →→ up a whole tone · ← ←← down · = stays

One sentence to remember it by: **green/teal is now, blue/gold is what
defines now, purple is how you sneak in, magenta is what's coming, red is
where home is — and the more saturated and larger the dot, the more the next
note you play should care about it.**
