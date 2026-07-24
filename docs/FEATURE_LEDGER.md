# Feature Parity Ledger — Tonal (Bebop Blueprint) → DukeBox

Every Tonal capability, its source location, its destination in DukeBox, and
its status. Tonal (`caltim3/tonal`, single-file `index.html`) is read-only —
line references point at the frozen source.

Status: ✅ ported · 🟡 partial / adapted · ⏳ planned · ⛔ superseded (not lost — replaced by a strictly more capable DukeBox feature)

## Playback & rhythm

| Feature | Tonal source | DukeBox destination | Status |
|---|---|---|---|
| Walking bass: 5 bassist personalities (Chambers, Brown, Carter, Mingus, Pettiford) | `index.html:2949` | `src/lib/music/bassStyles.js` | ✅ |
| Bass complexity dial (0–1, 2-feel omissions, passing tones) | `index.html:3257` | `bassStyles.js` + UI slider | ✅ |
| Beat-4 approach logic (chromatic / enclosure / anticipation / diatonic) | `index.html:3344` | `bassStyles.js` | ✅ |
| Mingus octave punctuation | `index.html:3368` | `bassStyles.js` | ✅ |
| Rhythmic styles: Freddie Green, Charleston, Son Clave 3:2 | `index.html:2644–2691` | `audioConstants.js` DRUM_STYLES | 🟡 snare voiced on ride sample (DukeBox kit has kick/ride/hihat) |
| Rhythmic styles: Quarter Notes, Standard Swing, Bossa | `index.html:2623–2674` | already covered by Four on Floor / Jazz Ride / Bossa Nova patterns | ✅ |
| Two-bar drum patterns (clave spans 2 bars) | `index.html:2677` | `audio.js` drumEvents multi-bar support | ✅ |
| Piano comping personalities (13) | `index.html:4086` | `comping.js` (12 present; `legacy_single` = single sustained hit) | ✅ |
| Voice-led voicing engine (held/common-tone scoring) | `index.html:3995` | `comping.js getVoiceLedVoicing` (pre-existing) | ✅ |
| v2.1 register re-ranker (comping window, crunch penalty, guide-tone reward) | `index.html:7855` | `comping.js refineVoicingRegister` | ✅ |
| Metronome click/woodblock modes, per-instrument volume stack, tap tempo | `index.html:1156` | standalone Practice/metronome workspace | ⏳ |
| Slow practice 50 BPM | `index.html:4572` | Practice Mode (pre-existing) | ✅ |
| Swing feel | hidden toggle | swing slider (pre-existing, more capable) | ✅ |
| Loop over measure range | `index.html:5742` | loop start/end (pre-existing) | ✅ |
| Reverb dial | `index.html:3561` | ⏳ (Tone.js reverb send) | ⏳ |
| 3 drum kits (Drums / Makaya / PhillyJoe) | `index.html:1558` | ⏳ (alternate sample banks) | ⏳ |

## Fretboard & scale recommendation during playback

| Feature | Tonal source | DukeBox destination | Status |
|---|---|---|---|
| Fretboard follows current chord during playback | `index.html:4797` | pre-existing (`page.js` fretboardBarIndex) | ✅ |
| Chord-quality → recommended scale | `index.html:3794` | `getRecommendedScalesFromQuality` (pre-existing) | ✅ |
| Guide-tone highlighting (3/7, 6-chord & dim7 aware) | `index.html:6290` | +Guide Tones overlay (pre-existing) | ✅ |
| Barry Harris 6th-diminished overlay (maj/min/dom 8-note scales + passing tone) | `index.html:4455–4502` | `tonal.js barryHarrisScale` + Barry filter button | ✅ |
| Chord-aware Hex mode (Locrian/Altered/WholeTone/Mixo/Dorian/Major hex) | `index.html:5869, 5915` | `tonal.js hexChoiceForChord` + Hex·Chord filter | ✅ |
| Anticipate fretboard (next chord, loop-aware) | `index.html:5981, 6041` | Anticipate board in `page.js` | ✅ |
| Guide-tone direction arrows | `index.html:6212` (disabled in source for artifacts) | ⏳ port-and-fix | ⏳ |
| Runway chord strip (7 quality categories, colors, progress fill) | `index.html:8050–8180` | `src/components/Runway.jsx` | ✅ |
| Next-chord text display | `index.html:5016` | Runway + Anticipate label | ✅ |
| Tunings: standard, drop D, open G, DADGAD, open D, open E | `index.html:1525` | `Fretboard.js` TUNINGS (open D / open E added) | ✅ |
| FretFlow (4 independent scale boards) | `index.html:6372` | pre-existing FretFlow | ✅ |
| 30+ scale dictionary incl. Persian, Hirajoshi, Egyptian, minor-bebop blues | `index.html:1506` | FRET_FLOW_SCALES + `ints:` namespace | ✅ |

## Songs & progressions

| Feature | Tonal source | DukeBox destination | Status |
|---|---|---|---|
| ~70 built-in progressions | `index.html:1564–2582` | `forms.js` (overlap deduped; unique ones ported) | ✅ |
| Practice: I-V7, VI-II-V-I, minor ii-V-i, 251 All-Keys Cycle | `index.html:1566–1632` | forms "From Bebop Blueprint" | ✅ |
| Same Old Blues (Freddie King) | `index.html:1682` | forms | ✅ |
| Impressions | `index.html:2093` | forms | ✅ |
| Rose Room (Traditional) — alternate arrangement | `index.html:1738` | forms (Django version pre-existing) | ✅ |
| I'll See You In My Dreams (Django Alt.) | `index.html:1727` | forms | ✅ |
| Althea, Scarlet Begonias, Loser (Grateful Dead), Dead Flowers (Stones) | `index.html:2441–2528` | forms Rock & Pop | ✅ |
| Roman-numeral progression parser (slash/secondary dominants) | `index.html:3695` | superseded — forms are stored as absolute changes; Desert Noir has its own Roman resolver | ⛔ |
| User-saved songs (localStorage) | `index.html:5644` | DukeBox library (pre-existing); importer for `userBebopProgressions` | ⏳ importer |
| Split measures (two chords per bar) | `index.html:5548` | pre-existing split-bar model | ✅ |
| Transpose progression to any key | `index.html:5293` | pre-existing transposeChart | ✅ |

## Export

| Feature | Tonal source | DukeBox destination | Status |
|---|---|---|---|
| Improv Guide markdown (5 levels, summary table, lead-sheet map, drills) | `index.html:7277` | `src/lib/music/improvGuide.js` + export button | ✅ |
| Notion export | `index.html:7388` | ⏳ | ⏳ |
| Self-download offline copy | `index.html:8022` | superseded — DukeBox is deployed; PWA/offline is a later phase | ⛔ |
| ChordScribe AI modal (unwired stub) | `index.html:7776` | superseded by working AI chart generator (`/api/generate-chart`) | ⛔ |
