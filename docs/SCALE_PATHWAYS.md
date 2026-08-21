# Scale Pathways — engine spec

> Engine: `src/lib/music/pathways.js` · Harness: `node scripts/check-pathways.mjs`
> The playbook below (from the user's *Scale Line Approaches* notes) is the
> spec of record; this header records how it maps onto the engine.

## The model

One **global rung** (1–5) applies to the whole chart, with **per-chord
overrides**: a bar's `userScale`/`userTonic` — the same fields the rest of the
app already honors — beats every rule on every rung.

| Rung | Name | What it resolves to |
|---|---|---|
| 1 | Key Center | One parent collection per harmonic window (cadence-aware modal routing). Blues forms blanket the tonic minor-blues scale. |
| 2 | Guide Tones | A **view**, not a scale — chord tones (`view: "chord"`), aim at 3rds and 7ths. |
| 3 | Pentatonic | Per-quality pentatonics; dominants get the dominant pentatonic (1 2 3 5 ♭7), built by hand since Tonal has no name for it. |
| 4 | Bebop | Dominant/major/minor bebop scales per quality. |
| 5 | Color | The dominant decision tree by suffix **and** resolution (altered / Phrygian dominant / Lydian dominant / half-whole diminished). |

Per-bar precedence: `override > written symbol > blues blanket (rung 1) > the rung's logic`.

## How the playbook's rules landed

- **"The written chord quality outranks the generic progression"** —
  `forcedBySymbol()`. Hard demands (`7alt`, `7b9`, `dim7`, `maj7#11`) win on
  every rung, including through the blues blanket. Soft demands (`m6`,
  `m(maj7)` → melodic minor) yield to the rung-1 blues blanket and to rung 3's
  own five-note answers (minor-six pentatonic; the maj7♯11 → major pentatonic
  off the 9 trick).
- **Cadence windows** — `buildCadenceWindows()` on top of harmony.js's
  `detectCadenceAt`: a ii-V-I is one major collection, a iiø-V-i one
  harmonic-minor collection (Locrian ♮6 → Phrygian dominant → harmonic
  minor); longer cadences claim their bars first. A ii-V fragment infers its
  tonic a fifth below the V.
- **Dominant resolution** — `dominantContext()` reads where the root goes
  next, **wrapping around the form** so a turnaround V7 in the last bar knows
  it resolves to bar 1. Kinds: resolves-major → altered (rung 5),
  resolves-minor → Phrygian dominant, whole-step-up to major → backdoor →
  Lydian dominant, half-step-down → tritone sub → Lydian dominant, static →
  Lydian dominant (or Mixolydian inside a blues, where non-resolving
  dominants keep the blues identity).
- **Key estimate** — opening bar (dominant tonic reads major), refined by the
  chart's final cadence so a bare ii-V-I snippet doesn't read as "key of the
  ii". Diatonic bars outside any window get the mode of the key; off-key bars
  fall back to their quality's plainest scale.
- **Not modeled yet** (quality vocabulary doesn't carry them): `13♭9`
  vs `7♭9` distinction (`7♭9` → half-whole unless resolving to minor),
  `7♯5`/whole-tone, `7♯11` as a written dominant quality. Adding those
  qualities to `QUALITIES` makes them decision-tree branches, not redesigns.
- **Known quirk, not touched here**: harmony.js's `detectLocalFunction`
  labels motion +1 "backdoor"; the true backdoor (♭VII7 → I) is motion +2,
  which is what `dominantContext()` tests.

## What consumes it (next step, not yet wired)

The play-time rung selector (radio chips 1–5 in the Focus HUD), the freeze +
per-chord alternative picker writing `userScale` overrides, and "save
treatment" as a library save-as carrying `pathwayDefault` + overrides.

---

# The Jazz Improviser’s Scale-Pathway Playbook

## The most common ways through common progressions, ranked from foundational to colorful

This guide consolidates and expands the two earlier **Scale Line Approaches** notes. Its organizing question is:

> **When an improviser sees this progression and these exact chord symbols, what are the three to five most common ways to navigate it?**

The pathways are ranked roughly from the most foundational and widely usable to the more harmonically specific, colorful, or modern. The ranking is not a quality judgment. A great player may use Pathway 1 for an entire chorus and sound more convincing than someone indiscriminately using Pathway 5.

The most important rule in the guide is this:

> **The written chord quality and tensions outrank the generic progression.**

`G13`, `G7alt`, `G7sus`, `G7♯11`, and `G7♭9♭13` may all function as V in C, but they do **not** ask for the same scale.

---

## 1. How to choose a pathway on the bandstand

Use this order of operations:

1. **Read the exact chord symbol.** Start with the chord tones and any written tensions.
2. **Identify the function.** Is it tonic, predominant, dominant, a secondary dominant, a backdoor dominant, or a static/modal chord?
3. **Choose the simplest pathway that fits the musical moment.** Key-center playing is often right at fast tempos or in pop. Chord-specific playing is usually clearer when changes last longer.
4. **Aim for the 3rd and 7th.** These usually reveal the chord’s identity more clearly than the root.
5. **Use the scale as a pitch pool, not as the line.** Rhythm, contour, motifs, rests, enclosures, arpeggios, and resolution make the line sound like music.
6. **Let the melody and rhythm-section voicings settle disputes.** If a melody note or piano voicing contradicts a theoretical scale choice, follow the music that is actually sounding.

### One pitch collection can have several functional names

Over `Dm7 | G7 | Cmaj7`, the labels **D Dorian**, **G Mixolydian**, and **C Ionian** describe the same seven notes: the C major scale. The modal labels are still useful because they redirect attention toward the root, 3rd, 7th, and characteristic tensions of the current chord.

---

## 2. Master chord-symbol-to-scale map

This is the core lookup table. It should control the more general progression pathways that follow.

| Chord symbol or function | First-call scale | Common alternatives | What the symbol is telling you |
|---|---|---|---|
| `C6`, `C6/9`, `Cmaj7` | C Ionian | C major pentatonic; C major bebop; tonic triad plus diatonic neighbors | Stable major tonic. On `maj7`, treat 4 as a passing or resolving tone unless the harmony welcomes it. |
| `Cmaj7♯11` | C Lydian | C major pentatonic; D major pentatonic | The chord explicitly wants F♯ rather than F natural. D major pentatonic supplies 9, 3, ♯11, 13, and 7. |
| `Cmaj7♯5` | C Lydian augmented | C augmented triad cells | The augmented 5th is structural. C Lydian augmented comes from A melodic minor. |
| `Cm7` as a ii chord | C Dorian | C minor pentatonic; chord-tone lines | The natural 6 is the characteristic color and usually reflects the parent major key. |
| `Cm7` as tonic minor | C Aeolian or C Dorian | C minor pentatonic/blues | Use Aeolian when A♭ is part of the tune; use Dorian when A natural is part of the vamp, melody, or voicing. |
| `Cm6`, `Cm6/9` as jazz tonic | C melodic minor | C Dorian; C minor pentatonic with A natural added | The chord requires A natural. B natural from melodic minor is a color, not a mandatory landing note. |
| `Cm(maj7)` | C melodic minor | C harmonic minor when A♭ is desired | The chord requires B natural. The 6th degree determines whether the sound is melodic minor or harmonic minor. |
| `Cm7♭5` | C Locrian ♮2 | C Locrian | Locrian ♮2 is the common modern choice when D natural is welcome. Plain Locrian supplies D♭ and is darker. |
| `G7`, `G9`, `G13` | G Mixolydian | G dominant bebop; G dominant pentatonic | Plain dominant with natural 9, 5, and 13. This is the default unless the chart or context says otherwise. |
| `G7sus`, `G9sus`, `G13sus` | G Mixolydian with the 3rd delayed | D minor pentatonic; G suspended pentatonic | Emphasize 1, 2, 4, 5, and ♭7. B natural is usually a resolution from C, not the starting identity. |
| `G7♯11` or `G13♯11` | G Lydian dominant | D melodic minor; A major triad over G7 | The chord wants C♯. A major supplies 9, ♯11, and 13. This sound is common on non-resolving dominants and tritone-sub colors. |
| `G7alt`, `G7♭9♯9♭5♯5` | G altered | A♭ melodic minor | Use when the chord explicitly says altered or the resolving dominant invites maximum tension. |
| `G7♭9♭13` | G Phrygian dominant | C harmonic minor | Classic minor-key V sound. It contains B natural, A♭, and E♭. |
| `G13♭9` or `G7♭9` with natural 13 | G half-whole diminished | B diminished-7 arpeggio plus G or E | The natural 13, E, distinguishes this from the ♭13 sound of Phrygian dominant or altered. |
| `G7♯5`, `G9♯5` with no ♭9/♯9 | G whole-tone | G altered if altered 9ths are also implied | Whole-tone supplies natural 9, 3, ♯11/♭5, ♯5, and ♭7. |
| `Cdim7` | C whole-half diminished | Cdim7 arpeggio with chromatic approaches | For a diminished chord, use whole-half from the chord root. For a dominant chord, the symmetrical diminished form is half-whole from the dominant root. |

### The dominant decision tree

Dominants carry the most possible scale choices. Read the suffix before choosing:

| If the chord says... | The usual first response is... | Example over G |
|---|---|---|
| `7`, `9`, or `13` | Mixolydian or dominant bebop | G A B C D E F |
| `7sus` or `13sus` | Mixolydian with 4 emphasized and 3 delayed | G A C D E F, with B used as resolution |
| `7♯11` | Lydian dominant | G A B C♯ D E F |
| `7alt` | Altered | G A♭ B♭ B D♭ E♭ F |
| `7♭9♭13` resolving to minor | Phrygian dominant | G A♭ B C D E♭ F |
| `13♭9` | Half-whole diminished | G A♭ B♭ B D♭ D E F |
| `7♯5` with natural 9 | Whole-tone | G A B C♯ D♯ F |

**Do not automatically play altered over every V chord.** Altered is powerful because it removes the natural 5 and natural 13 and supplies both altered 9ths. That is ideal for `V7alt`; it can contradict a clearly voiced `V13`, `V7sus`, or `V7♯11`.

---

## 3. Scale formulas used throughout

| Scale | Formula |
|---|---|
| Major pentatonic | 1 2 3 5 6 |
| Dominant pentatonic | 1 2 3 5 ♭7 |
| Suspended pentatonic | 1 2 4 5 ♭7 |
| Minor pentatonic | 1 ♭3 4 5 ♭7 |
| Major blues | 1 2 ♭3 3 5 6 |
| Minor blues | 1 ♭3 4 ♭5 5 ♭7 |
| Ionian | 1 2 3 4 5 6 7 |
| Dorian | 1 2 ♭3 4 5 6 ♭7 |
| Mixolydian | 1 2 3 4 5 6 ♭7 |
| Lydian | 1 2 3 ♯4 5 6 7 |
| Lydian augmented | 1 2 3 ♯4 ♯5 6 7 |
| Locrian | 1 ♭2 ♭3 4 ♭5 ♭6 ♭7 |
| Locrian ♮2 | 1 2 ♭3 4 ♭5 ♭6 ♭7 |
| Melodic minor | 1 2 ♭3 4 5 6 7 |
| Harmonic minor | 1 2 ♭3 4 5 ♭6 7 |
| Phrygian dominant | 1 ♭2 3 4 5 ♭6 ♭7 |
| Lydian dominant | 1 2 3 ♯4 5 6 ♭7 |
| Altered | 1 ♭9 ♯9 3 ♭5/♯11 ♯5/♭13 ♭7 |
| Half-whole diminished | 1 ♭9 ♯9 3 ♯11 5 13 ♭7 |
| Whole-half diminished | 1 2 ♭3 4 ♭5 ♭6 6 7, interpreted around a dim7 chord |
| Whole-tone | 1 2 3 ♯4 ♯5 ♭7 |
| Dominant bebop | 1 2 3 4 5 6 ♭7 7 |
| Major bebop | 1 2 3 4 5 ♯5 6 7 |

**Bebop-scale warning:** the added chromatic note is a rhythmic device. Starting degree, direction, and phrase length determine whether chord tones actually land on strong beats. Merely playing all eight notes does not automatically create bebop phrasing.

---

## 4. Major ii-V-I

### Example: `Dm7 | G7 | Cmaj7`

### Ranked pathways

| Rank | Pathway | Dm7 | G7 | Cmaj7 | Vibe and best use |
|---:|---|---|---|---|---|
| **1** | **Parent-major / modal routing** | D Dorian | G Mixolydian | C Ionian | The foundational sound. It is one C major pitch collection with chord-specific emphasis. |
| **2** | **Chord tones and guide-tone voice leading** | Dm7 arpeggio, especially F and C | G7 arpeggio, especially B and F | Cmaj7 arpeggio, especially E and B | The clearest “playing the changes” sound. Connect C to B and F to E across the cadence. |
| **3** | **Pentatonic pathway** | D minor pentatonic | G dominant pentatonic | C major pentatonic | Open, melodic, and less scale-like. It omits some extensions but clearly preserves each chord quality. |
| **4** | **Bebop pathway** | D Dorian plus chromatic approaches | G dominant bebop | C major bebop or C major-sixth vocabulary | Forward-moving eighth-note language with chord tones deliberately placed on strong beats. |
| **5** | **Altered cadence** | D Dorian or Fmaj7 arpeggio | G altered if the chord is `G7alt` | C Ionian, or C Lydian only when `Cmaj7♯11` is intended | Maximum V-to-I tension and release. Use the I scale that matches the actual tonic symbol. |

### Critical chord-variation calls

| Written middle and final chords | Recommended route |
|---|---|
| `Dm7 \| G13 \| Cmaj7` | D Dorian → G Mixolydian or dominant bebop → C Ionian |
| `Dm7 \| G7alt \| Cmaj7` | D Dorian → A♭ melodic minor / G altered → C Ionian |
| `Dm7 \| G13♭9 \| Cmaj7` | D Dorian → G half-whole diminished → C Ionian |
| `Dm7 \| G7♭9♭13 \| Cm` | This is really a minor resolution: D Locrian-family sound → G Phrygian dominant → C minor |
| `Dm7 \| G7♯11 \| Cmaj7` | D Dorian → G Lydian dominant → C Ionian. The C♯ on G is a strong chromatic color that resolves to C or D. |
| `Dm7 \| G7♯5 \| Cmaj7` | D Dorian → G whole-tone if natural 9 is intended → C Ionian |
| `Dm7 \| G7sus \| Cmaj7` | D Dorian → G Mixolydian with C emphasized and B delayed → C Ionian |
| `Dm7 \| G7alt \| Cmaj7♯11` | D Dorian → G altered → C Lydian |

### Why “G major pentatonic over G7” needs a warning

G major pentatonic is `G A B D E`. It is a sweet upper-structure sound, but it omits F, the ♭7 that defines `G7`. More importantly, guitarists often instinctively add F♯ from the G major scale, which directly contradicts the chord’s F natural. For a clean pentatonic dominant sound, use **G dominant pentatonic** (`G A B D F`). Use G major pentatonic freely over a G major triad, G6, or a dominant voicing that deliberately leaves the ♭7 ambiguous.

### Useful 3-to-9 arpeggios

Starting on the 3rd produces rootless extensions without changing the basic harmony:

| Chord | Arpeggio from its 3rd | Resulting chord degrees |
|---|---|---|
| Dm7 | Fmaj7: F A C E | 3 5 ♭7 9 |
| G7 | Bm7♭5: B D F A | 3 5 ♭7 9 |
| Cmaj7 | Em7: E G B D | 3 5 7 9 |

---

## 5. Minor ii-V-i

### Example: `Dm7♭5 | G7alt | Cm6` or `Cm(maj7)`

The final tonic symbol matters more in minor than many simplified charts admit. `Cm7`, `Cm6`, and `Cm(maj7)` imply different pitch collections.

### Ranked pathways

| Rank | Pathway | Dm7♭5 | G7 | C minor tonic | Vibe and best use |
|---:|---|---|---|---|---|
| **1** | **One harmonic-minor key center** | C harmonic minor, heard from D as D Locrian ♮6 | G Phrygian dominant | C harmonic minor | The simplest unified minor-key route. Classic ♭9 and ♭13 on V. Treat E♭, the ♭9 of Dm7♭5, carefully if held. |
| **2** | **Chord-specific modern default** | D Locrian ♮2, from F melodic minor | G altered for `G7alt`; G Phrygian dominant for `G7♭9♭13` | C melodic minor for `Cm6` or `Cm(maj7)`; C Dorian/Aeolian for `Cm7` | The most precise chord-scale route. It follows the written tensions instead of forcing one parent scale. |
| **3** | **Arpeggio and diminished route** | Dm7♭5 arpeggio | Bdim7 arpeggio over G7♭9 | Cm6 or Cm(maj7) arpeggio | Strong bebop clarity with fewer scale decisions. Bdim7 gives 3, 5, ♭7, and ♭9 of G7. |
| **4** | **Tonic-minor pentatonic / blues generalization** | C minor pentatonic, with D and A♭ targeted as needed | C minor blues vocabulary, resolving B natural into C | C minor pentatonic or blues | Earthy, simple, and melodic. The line must acknowledge B natural on V if the harmony clearly voices it. |
| **5** | **Symbol-driven dominant color** | D Locrian ♮2 | Altered, half-whole diminished, Phrygian dominant, or whole-tone according to the suffix | Resolve into the exact tonic quality | The advanced route is not “more altered.” It is choosing the dominant collection that matches the voicing. |

### Exact minor-tonic choices

| Final tonic symbol | First-call scale | Important note |
|---|---|---|
| `Cm7` with A♭ in the melody or harmony | C Aeolian | The ♭6 is structural. |
| `Cm7` with A natural in the melody or vamp | C Dorian | The natural 6 is structural. |
| `Cm6` or `Cm6/9` | C melodic minor or C Dorian | Both contain A natural. Melodic minor adds B natural; Dorian adds B♭. |
| `Cm(maj7)` | C melodic minor | B natural is required; A natural provides the modern tonic-minor sound. |
| `Cm(maj7♭13)` or a distinctly harmonic-minor tonic | C harmonic minor | B natural and A♭ define the sound. |

### Exact minor-dominant choices

| Dominant symbol | Scale over G | Parent-scale shortcut |
|---|---|---|
| `G7♭9♭13` | G Phrygian dominant | C harmonic minor |
| `G7alt` | G altered | A♭ melodic minor |
| `G13♭9` | G half-whole diminished | Start half-step, then alternate half and whole steps |
| `G7♯5` with natural 9 | G whole-tone | Any whole-tone collection containing G |
| Plain `G7` resolving to Cm | G Mixolydian is legal, but G Phrygian dominant is more idiomatically minor | Let the melody determine A versus A♭ and E versus E♭ |

---

## 6. Major jazz blues

### Example: B♭ jazz blues

A blues contains two overlapping harmonic truths:

- B♭ is the tonal home.
- B♭7, E♭7, and F7 are also individual dominant chords with their own 3rds and ♭7ths.

The pathways below move from emphasizing the first truth to emphasizing the second.

### Ranked pathways

| Rank | Pathway | I7: B♭7 | IV7: E♭7 | V7: F7 | Vibe and best use |
|---:|---|---|---|---|---|
| **1** | **Tonic minor-blues generalization** | B♭ minor blues | B♭ minor blues | B♭ minor blues | The most universal blues answer. The D♭ rubs against D natural on B♭7, creating the central major/minor blues tension. |
| **2** | **Major/minor blues blend** | B♭ major blues plus B♭ minor blues | E♭ major blues or chord tones, mixed with B♭ blues language | F major blues or dominant pentatonic, mixed with B♭ blues language | Sweeter and more chord-aware. Move ♭3 to 3 deliberately rather than treating both as neutral. |
| **3** | **Chord-specific dominant route** | B♭ Mixolydian or dominant bebop | E♭ Mixolydian or dominant bebop | F Mixolydian or dominant bebop | The standard changes-running approach. Target each chord’s 3rd and ♭7. |
| **4** | **Minor-conversion lens** | F Dorian vocabulary | B♭ Dorian vocabulary | C Dorian vocabulary | A guitaristic Pat Martino-style organization. Each Dorian set is the same pitch collection as the current dominant’s Mixolydian, but the minor shapes suggest different lines. |
| **5** | **“3 plus altered” changes route** | Target D, then stay blues/mixolydian unless the chart alters the chord | Target G, then stay blues/mixolydian unless altered | Target A, then use altered only when F7 is functioning as a strongly resolving `F7alt` | Clearly state the major 3rd of each dominant, then add altered tension on secondary dominants and turnarounds where it has somewhere to resolve. |

### The major-pentatonic detail that matters

Major pentatonic built on the current chord root sounds bright, but it omits the ♭7 of a dominant chord:

- B♭ major pentatonic over B♭7 gives `1 2 3 5 6`, but omits A♭.
- E♭ major pentatonic over E♭7 gives `1 2 3 5 6`, but omits D♭.
- F major pentatonic over F7 gives `1 2 3 5 6`, but omits E♭.

That is not wrong. It is a **sweet dominant** sound. Add or target the ♭7 when you want the line to state the full dominant quality. A dominant pentatonic, `1 2 3 5 ♭7`, makes that identity explicit.

### Common added chords in a bebop blues

The exact 12-bar reharmonization varies. When these chords appear, use the symbol-specific choice:

| Chord in B♭ blues | Function | First-call choice |
|---|---|---|
| `B♭7` | Tonic dominant | B♭ blues blend, B♭ Mixolydian, or B♭ dominant bebop |
| `E♭7` | IV7 | E♭ Mixolydian or dominant bebop; E♭ major/minor blues blend |
| `Edim7` | ♯IV°7 passing chord | E whole-half diminished or Edim7 arpeggio |
| `Dm7` | iii | D Phrygian if strictly in B♭ major; D Dorian when functioning in a local ii-V context suggested by the chart |
| `G7alt` | VI7, usually resolving to Cm7 | A♭ melodic minor / G altered |
| `Cm7` | ii | C Dorian |
| `F13` | V7 with natural 13 | F Mixolydian or dominant bebop |
| `F13♭9` | V7 with ♭9 and natural 13 | F half-whole diminished |
| `F7alt` | Altered V resolving to B♭ | G♭ melodic minor / F altered |

### A useful priority order inside every blues pathway

1. Keep the rhythmic and vocal character of blues language.
2. State the new chord’s 3rd when IV7 or V7 arrives.
3. Use the ♭7 to complete the dominant identity.
4. Add scale extensions only after the chord change can already be heard in the line.

---

## 7. Minor blues

### Example center: C minor

| Rank | Pathway | Tonic minor | iv minor | V dominant | Vibe and best use |
|---:|---|---|---|---|---|
| **1** | **Tonic minor-blues scale throughout** | C minor blues | C minor blues | C minor blues, resolving B natural to C when needed | Raw and idiomatic. |
| **2** | **Chord-specific Dorian route** | C Dorian over `Cm7` | F Dorian over `Fm7` | G Phrygian dominant or altered | Soul-jazz and post-bop color with clear natural 6s on the minor-7 chords. |
| **3** | **Aeolian minor-key route** | C Aeolian | F Dorian or F Aeolian according to the chart | G Phrygian dominant | Darker minor sound with A♭ emphasized on tonic. |
| **4** | **Tonic melodic-minor route** | C melodic minor over `Cm6` or `Cm(maj7)` | F Dorian or chord tones | G altered or Phrygian dominant | Modern tonic-minor color. Do not use B natural as a resting tone against a clearly voiced `Cm7`. |
| **5** | **Arpeggio, diminished, and altered route** | Cm6/Cm7 arpeggios | Fm7 arpeggio | Bdim7 on `G7♭9`, altered on `G7alt` | Clear changes-running language with concentrated dominant tension. |

---

## 8. Diatonic pop: I-IV-V

### Example: `C | F | G` or `C | F | G7`

### Ranked pathways

| Rank | Pathway | C | F | G or G7 | Vibe and best use |
|---:|---|---|---|---|---|
| **1** | **One key-center scale** | C major | C major | C major | The default pop approach. Emphasize each chord’s triad while keeping one pitch collection. |
| **2** | **Tonic major pentatonic throughout** | C major pentatonic | C major pentatonic | C major pentatonic | Smooth, vocal, and hard to overplay. |
| **3** | **Per-chord triad or pentatonic** | C major pentatonic | F major pentatonic | G major pentatonic over a G triad; G dominant pentatonic over G7 | Makes held chords sound more distinct without requiring full seven-note modes. |
| **4** | **Major-key blues overlay** | C minor blues mixed with C major blues | Preserve A natural when F arrives | Target B on G or G7, then resolve to C | Gospel, rock, country, and soul vocabulary. The ♭3-to-3 motion is central. |
| **5** | **Chord-specific color as written** | C Mixolydian only if the chord becomes C7 | F Lydian if B natural is featured; F minor vocabulary if the chord becomes Fm | G Mixolydian or dominant bebop on G7; altered only if the arrangement explicitly jazzes up the cadence | Follow borrowed chords and secondary dominants rather than forcing the original C major scale over them. |

### Triad versus dominant warning

`G` and `G7` are different instructions:

- Over a **G major triad**, G major pentatonic is a natural choice.
- Over **G7**, G dominant pentatonic or G Mixolydian is safer because F natural defines the chord.
- G major pentatonic does not contain F♯, but players who expand it to the full G major scale must avoid F♯ against a clearly voiced G7.

---

## 9. Diatonic pop and standards: I-vi-ii-V

### Example: `Cmaj7 | Am7 | Dm7 | G7`

### Ranked pathways

| Rank | Pathway | Cmaj7 | Am7 | Dm7 | G7 | Vibe and best use |
|---:|---|---|---|---|---|---|
| **1** | **One C major scale** | C major | C major | C major | C major | The most efficient route. The chords are heard through targets, not scale changes. |
| **2** | **One pentatonic collection** | C major pentatonic | A minor pentatonic | C major pentatonic as a color, adding F to state the minor 3rd; or D minor pentatonic | G dominant pentatonic or selected G7 chord tones | Clean pop/soul phrasing. C major pentatonic and A minor pentatonic contain the same notes but invite different centers. |
| **3** | **Modal relabeling and chord emphasis** | C Ionian | A Aeolian | D Dorian | G Mixolydian | Same parent notes as Pathway 1, but each chord’s 3rd and 7th become the melodic destinations. |
| **4** | **Arpeggio and guide-tone route** | Cmaj7 arpeggio | Am7 arpeggio | Dm7 arpeggio | G7 arpeggio or dominant bebop | More explicit changes-running without leaving the key. |
| **5** | **Jazz turnaround variants** | C Ionian/major bebop | If `A7`, choose A Mixolydian, A Phrygian dominant, or A altered by suffix | D Dorian | Choose the exact G dominant scale by suffix | This is no longer a purely diatonic `I-vi-ii-V`; `VI7` is V/ii and needs C♯. |

### `vi7` versus `VI7` is a decisive change

Compare:

- `Cmaj7 | Am7 | Dm7 | G7`: C major covers the entire progression.
- `Cmaj7 | A7 | Dm7 | G7`: A7 contains C♯, so C major alone no longer describes the harmony.
- `A7♭9♭13 → Dm`: use A Phrygian dominant from D harmonic minor.
- `A7alt → Dm`: use A altered from B♭ melodic minor.
- Plain `A7 → Dm`: A Mixolydian is the unaltered first call; harmonic-minor or altered tension may be added if the arrangement supports it.

The same logic applies to other common pop loops such as `I-V-vi-IV` and `vi-IV-I-V`: begin with the parent major scale or tonic major pentatonic, then depart only when the written chord, melody, or arrangement departs from the key.

---

## 10. Rhythm changes A sections

### Basic turnaround: `B♭6 | G7 | Cm7 | F7`

At fast tempos, many players simplify the A section. The essential repair is B natural, the 3rd of G7 and the only G7 chord tone outside B♭ major. For a full G Mixolydian or G13 sound, E natural also replaces the key center’s E♭.

### Ranked pathways

| Rank | Pathway | B♭6 | G7 | Cm7 | F7 | Vibe and best use |
|---:|---|---|---|---|---|---|
| **1** | **One key plus an essential repair** | B♭ major | B♭ major language, but change B♭ to B natural and target B/F. Treat E♭ as ♭13, or change it to E natural for G13/Mixolydian. | C Dorian, same notes as B♭ major | F Mixolydian, same notes as B♭ major | Fast, uncluttered, and melodically coherent. The B natural is what makes VI7 audible. |
| **2** | **Arpeggios and guide tones** | B♭6/maj7 arpeggio | G7 arpeggio | Cm7 arpeggio | F7 arpeggio | The safest true changes-running method at high speed. |
| **3** | **Bebop-scale route** | B♭ major bebop or sixth-diminished vocabulary | G dominant bebop if plain; altered if marked | C Dorian with chromatic approaches | F dominant bebop | Classic continuous eighth-note language. |
| **4** | **Minor conversion** | G minor vocabulary over B♭ major | D Dorian vocabulary over G7 | C minor/Dorian vocabulary | C Dorian vocabulary over F7 | A fretboard and phrase-organization system. It still requires chord-tone targeting to prevent the harmony from becoming vague. |
| **5** | **Altered secondary dominants** | B♭ major | G altered when `G7alt`, or G half-whole when `G13♭9` | C Dorian | F altered when `F7alt`, or F dominant bebop when plain | Maximum cadence definition. Save the strongest altered colors for chords with clear resolutions. |

### Common A-section substitutions

| Chord symbol | First-call scale |
|---|---|
| `B♭6` or `B♭maj7` | B♭ Ionian, B♭ major pentatonic, or B♭ major-sixth vocabulary |
| `G7` | G Mixolydian or dominant bebop |
| `G7alt` | G altered / A♭ melodic minor |
| `G13♭9` | G half-whole diminished |
| `Cm7` | C Dorian |
| `F13` | F Mixolydian or dominant bebop |
| `F7alt` | F altered / G♭ melodic minor |
| `A♭7` as a backdoor color to B♭ | A♭ Lydian dominant is the smoothest modern choice; A♭ Mixolydian is a bluesier option |

---

## 11. Rhythm changes bridge

### Basic bridge: `D7 | G7 | C7 | F7`

Each chord is a dominant that resolves down a fifth to the next dominant. Because the roots change rapidly, guide tones often sound clearer than four unrelated scale runs.

### Ranked pathways

| Rank | Pathway | Scale or device on each dominant | Vibe and best use |
|---:|---|---|---|
| **1** | **3rds, 7ths, and arpeggios** | D7: F♯/C → G7: B/F → C7: E/B♭ → F7: A/E♭ | The clearest and most economical route. The guide-tone line tells the bridge’s story. |
| **2** | **Mixolydian per chord** | D Mixolydian → G Mixolydian → C Mixolydian → F Mixolydian | The foundational scale route through the cycle. |
| **3** | **Dominant bebop per chord** | D dominant bebop → G dominant bebop → C dominant bebop → F dominant bebop | Classic fast eighth-note bridge vocabulary. |
| **4** | **Minor conversion per chord** | A Dorian over D7 → D Dorian over G7 → G Dorian over C7 → C Dorian over F7 | The same pitches as the respective Mixolydian scales, organized as moving minor vocabulary. |
| **5** | **Selected dominant alteration** | Choose altered, half-whole diminished, Lydian dominant, or whole-tone separately for each chord according to its suffix and resolution | Modern color. Do not assume all four dominants should receive the same altered scale type. |

### A practical alteration strategy

On a plain bridge, begin with Mixolydian or dominant bebop. Alter only one or two dominants in a phrase, and resolve the altered tone into a chord tone of the next dominant. For example:

- E♭ from D altered can resolve to D or E over G7.
- A♭ from G altered can resolve to G or A over C7.
- D♭ from C altered can resolve to C or D over F7.

The resolution makes the outside note sound intentional.

---

## 12. Backdoor cadence

### Example: `Fm7 | B♭7 | Cmaj7`

This is `ivm7 | ♭VII7 | I` in C.

### Ranked pathways

| Rank | Pathway | Fm7 | B♭7 | Cmaj7 | Vibe and best use |
|---:|---|---|---|---|---|
| **1** | **Dorian to Lydian-dominant route** | F Dorian | B♭ Lydian dominant, from F melodic minor | C Ionian | Shift E♭ to E natural when B♭7 arrives. E is the bright ♯11 of B♭7 and resolves smoothly into C major. |
| **2** | **Shared parent-scale route** | F Dorian | B♭ Mixolydian | C Ionian | F Dorian and B♭ Mixolydian share the E♭ major pitch collection. This is the simpler, bluesier backdoor sound. |
| **3** | **Chord tones and voice leading** | Fm7 arpeggio | B♭7 arpeggio | Cmaj7 arpeggio | A♭ can resolve to G; D can resolve to E; F can resolve to E. |
| **4** | **Minor-pentatonic route** | F minor pentatonic | F minor pentatonic as a B♭7sus/9 color, then add D for the 3rd of B♭7 | C major pentatonic | Bluesy and vocal. Adding D keeps the backdoor dominant from sounding merely suspended. |

---

## 13. Tritone-sub ii-V-I

### Example: `A♭m7 | D♭7 | Cmaj7`

This substitutes `D♭7` for `G7` because the two dominants share the tritone B/F, enharmonically C♭/F.

| Rank | Pathway | A♭m7 | D♭7 | Cmaj7 | Vibe and best use |
|---:|---|---|---|---|---|
| **1** | **Chord-specific modes** | A♭ Dorian | D♭ Lydian dominant | C Ionian | The standard modern tritone-sub route. G natural is ♯11 on D♭7 and resolves smoothly to G on Cmaj7. |
| **2** | **Arpeggios and chromatic resolution** | A♭m7 arpeggio | D♭7 arpeggio | Cmaj7 arpeggio | Every D♭7 chord tone can resolve by half-step or common tone into Cmaj7 color. |
| **3** | **Dominant identity from the original V** | Treat D♭7 as the substitute shell for G7 and aim at the shared 3rd/7th | D♭7 or D♭ dominant pentatonic | C major | Useful when the chart substitutes the chord but the melodic logic still sounds like a V-I cadence. |

---

## 14. Static and modal chords

When one chord lasts for several measures, a single scale may be technically correct but melodically exhausting. Start with the chord’s identity, then contrast small pitch collections.

| Static chord | Ranked common options |
|---|---|
| `Dm7` modal vamp with B natural | **1.** D Dorian; **2.** D minor pentatonic; **3.** E minor pentatonic for 9, 11, 5, 13, and root colors; **4.** Dorian triad pairs such as F and G major, which preserve D, F, A, C, and the characteristic B natural while omitting E |
| `Dm7` vamp with B♭ | **1.** D Aeolian; **2.** D minor pentatonic; **3.** F major pentatonic; **4.** Aeolian triad and arpeggio cells |
| `Cmaj7` vamp | **1.** C Ionian; **2.** C major pentatonic; **3.** Cmaj7/Em7 arpeggios; **4.** C Lydian only if F♯ is supported |
| `Cmaj7♯11` vamp | **1.** C Lydian; **2.** D major pentatonic; **3.** C and D major triad pair; **4.** wide-interval Lydian cells |
| `G7` vamp | **1.** G Mixolydian; **2.** G dominant pentatonic; **3.** G minor/major blues blend; **4.** G Lydian dominant for a non-resolving ♯11 sound; **5.** altered only when tension and resolution are part of the phrase |
| `G7sus` vamp | **1.** G Mixolydian with C emphasized; **2.** D minor pentatonic; **3.** F major pentatonic; **4.** quartal cells from the Mixolydian collection |
| `Cm6` vamp | **1.** C melodic minor; **2.** C Dorian; **3.** C minor pentatonic plus A natural; **4.** Cm6 and Dm7 arpeggio cells |

**Triad-pair warning:** “hexatonic” should name the actual pair. For example, C and D major triads produce `C D E F♯ G A`, a six-note Lydian collection. “Play a hexatonic” is incomplete unless the two source triads or the six notes are identified.

---

## 15. Pat Martino minor conversion as a lens

Minor conversion is best understood as a way to organize vocabulary and fretboard shapes, not as permission to ignore the current chord.

| Sounding chord | Minor-family lens | What it produces |
|---|---|---|
| `Cmaj7` | A minor vocabulary | Relative-minor organization of the C major collection. Target E and B so Cmaj7 remains audible. |
| `G7` | D Dorian vocabulary | The same seven notes as G Mixolydian. Dm7 supplies G7’s 5, ♭7, 9, and 11; D Dorian also supplies B, the essential 3rd. |
| `Dm7` | D minor/Dorian vocabulary | Direct minor organization. |
| `Dm7♭5` | F melodic minor vocabulary | D Locrian ♮2 is the sixth mode of F melodic minor. |
| `G7alt` | A♭ melodic minor vocabulary | G altered is the seventh mode of A♭ melodic minor. |

The advantage is continuity: a guitarist can move familiar minor phrases through the harmony. The danger is vagueness: a D minor phrase over G7 that never reaches B may sound like `G7sus`, not a clearly stated G7. Minor conversion works best when the line still lands on the current chord’s defining tones.

---

## 16. Barry Harris and bebop-scale pathways

Barry Harris-style thinking often organizes harmony around tonic and dominant families rather than assigning a completely unrelated scale to every chord.

Three practical applications in this guide are:

1. **Dominant bebop on plain dominant chords.** The added natural 7 acts as a passing tone between root and ♭7.
2. **Major-sixth and diminished movement on tonic major.** Alternate the major-sixth chord tones with the related diminished structure to create voice movement and chromatic connectors.
3. **Diminished arpeggio from the 3rd of a 7♭9 chord.** Over G7♭9, Bdim7 supplies B, D, F, and A♭, which are 3, 5, ♭7, and ♭9.

This is a rhythmic and harmonic language, not merely an instruction to ascend and descend an eight-note scale.

---

## 17. At-a-glance ranked menu

| Progression | 1. Foundational | 2. Clearer harmony | 3. Common color | 4. Bebop/system route | 5. Advanced tension |
|---|---|---|---|---|---|
| Major ii-V-I | One parent major scale | Arpeggios and 3rd/7th voice leading | Minor → dominant → major pentatonics | Dominant bebop and chromatic approaches | Altered, diminished, Lydian dominant, or whole-tone on V according to suffix |
| Minor ii-V-i | One harmonic-minor key center | Locrian ♮2 → symbol-specific V → exact tonic minor | Arpeggio plus diminished on V7♭9 | Minor pentatonic/blues generalization | Altered versus Phrygian dominant versus half-whole selected by chord symbol |
| Major jazz blues | Tonic minor blues throughout | Major/minor blues blend | Mixolydian or dominant bebop per dominant | Minor conversion | Target 3rds, then alter functional dominants and turnarounds |
| Minor blues | Tonic minor blues throughout | Dorian or Aeolian by tonic color | Chord-specific minor scales | Arpeggio/diminished language | Melodic-minor tonic and altered V |
| Pop I-IV-V | One parent major scale | Tonic major pentatonic | Per-chord triad/pentatonic | Major/minor blues blend | Follow borrowed chords and secondary dominants exactly |
| Pop I-vi-ii-V | One parent major scale | One relative major/minor pentatonic set | Modal emphasis by chord | Arpeggios and guide tones | Treat `VI7` and altered V chords as true dominants |
| Rhythm A | B♭ major plus B natural on G7 | Arpeggios and guide tones | Bebop scales | Minor conversion | Altered secondary and final dominants |
| Rhythm bridge | Guide tones and arpeggios | Mixolydian per dominant | Dominant bebop per dominant | Minor conversion through the cycle | Selective, resolved dominant alteration |
| Backdoor cadence | F Dorian → B♭ Lydian dominant → C Ionian | Shared parent scale with F Dorian → B♭ Mixolydian | Arpeggios and voice leading | Minor pentatonic with dominant 3rd added | Lydian-dominant color into major tonic |

---

## 18. What each pathway tends to sound like

| Approach | Typical effect |
|---|---|
| One key-center scale | Melodic continuity; ideal for pop, fast changes, and thematic development |
| Blues scale generalization | Vocal grit, rhythmic directness, deliberate major/minor ambiguity |
| Pentatonic pathway | Open intervals, fewer avoid-note problems, strong motif development |
| Per-chord modes | Clear harmonic movement, especially when chords last a bar or longer |
| Arpeggios and guide tones | The changes are audible with very few notes |
| Bebop scales and enclosures | Propulsive eighth-note lines with chromatic approach motion |
| Minor conversion | Guitaristic continuity and long minor-shaped lines across changing harmony |
| Triad pairs and named hexatonics | Angular, intervallic, modern color without sounding like a seven-note scale run |
| Altered, diminished, and whole-tone dominants | Concentrated tension that must resolve clearly |

---

## 19. A practical way to practice the guide

For each progression, spend one full chorus on each level:

1. **Chorus 1:** Pathway 1 only. Make phrases and leave space.
2. **Chorus 2:** Use only arpeggios, 3rds, and 7ths with chromatic approach notes.
3. **Chorus 3:** Use the pentatonic or blues pathway.
4. **Chorus 4:** Use the bebop or minor-conversion pathway.
5. **Chorus 5:** Allow one advanced dominant color per phrase, and resolve it into the next chord.
6. **Chorus 6:** Mix pathways freely, but be able to name what you chose and why.

### The final test

Record a chorus with no accompaniment. If the chord changes are still audible from your target notes and resolutions, the pathway is working. If the line only sounds like a scale exercise, reduce the pitch collection, strengthen the rhythm, and aim more clearly at the 3rds and 7ths.

---

## 20. Condensed rulebook

1. **Plain major:** Ionian or major pentatonic.
2. **Major ♯11:** Lydian.
3. **Minor-7 as ii:** Dorian.
4. **Tonic minor-7:** Aeolian or Dorian according to ♭6 versus natural 6.
5. **Minor-6 or minor-major-7:** melodic minor is the first modern-jazz call.
6. **Half-diminished:** Locrian ♮2 is the common modern choice; Locrian is darker.
7. **Plain 7/9/13:** Mixolydian or dominant bebop.
8. **7sus:** Mixolydian with 4 emphasized and 3 delayed.
9. **7♯11:** Lydian dominant.
10. **7alt:** altered, from melodic minor a half-step above the dominant root.
11. **7♭9♭13 resolving to minor:** Phrygian dominant, from harmonic minor of the destination.
12. **13♭9:** half-whole diminished.
13. **7♯5 with natural 9:** whole-tone.
14. **dim7:** whole-half diminished.
15. **When uncertain:** play the arpeggio, target the 3rd and 7th, listen to the melody, and choose the least altered scale that fits the actual chord.

---

## Lineage and further study

The conceptual lineages named in the original notes remain central:

- **Chord-scale and functional harmony:** the broad jazz-theory tradition associated with Mark Levine and Berklee harmony pedagogy.
- **Bebop rhythm, sixth-diminished harmony, and dominant-diminished relationships:** Barry Harris.
- **Minor conversion and guitar-centered line organization:** Pat Martino.
- **Triad pairs, hexatonics, and melodic cells:** Randy Vincent and the wider post-bop vocabulary.

For a concise institutional overview of the dominant alternatives used here, see Berklee Online’s discussion of [Lydian ♭7, altered, and symmetrical diminished scales](https://online.berklee.edu/takenote/jazz-improvisation-10-scales/). Berklee’s summary also distinguishes half-whole diminished over dominant harmony from whole-half diminished over a diminished chord.

---

*This playbook is a hierarchy of practical choices, not a rule that every chord requires a new scale. The goal is to hear the progression, choose a coherent pathway, state the harmony, and make a line that sings.*
