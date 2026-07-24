# Music Suite Integration — Master Plan

DukeBox is the unified home for the music-making suite. Capabilities from
**Tonal / Bebop Blueprint** (`caltim3/tonal`) are transferred *into* DukeBox;
the Tonal repository itself is frozen and never modified — it stays live at
https://caltim3.github.io/tonal/ until the parity ledger (FEATURE_LEDGER.md)
is fully green.

## Principles

1. **Strangler fig** — no source app is touched or retired until its features
   are verified working here. Transfer is by porting code, never rewriting
   from memory.
2. **Zero loss** — every playback, chord, songwriting, fretboard, rhythm,
   song-playing, and scale-recommendation behavior is tracked in
   `FEATURE_LEDGER.md` with source line references and a status.
3. **One scheduler** — all timing runs on the Tone.js Transport (fixes the
   `setInterval` drift in the Tonal original).
4. **Keep both arrangements** — where DukeBox and Tonal harmonize the same
   standard differently, both versions ship, labeled. Merging arrangements is
   where silent loss happens.

## Architecture

DukeBox module map after integration:

| Module | Role | Absorbed from Tonal |
|---|---|---|
| `src/lib/music/tonal.js` | theory core | Barry Harris 6th-dim scales, chord-aware hexatonics, exotic scales (Persian, Hirajoshi, Egyptian, minor-bebop blues) |
| `src/lib/music/comping.js` | voice-led piano voicings | v2.1 register re-ranker (jazz comping window E3–C4 / G4–C5, crunch penalties, guide-tone rewards) |
| `src/lib/music/bassStyles.js` | walking bass personalities | BASS_STYLES (Chambers, Brown, Carter, Mingus, Pettiford), complexity dial, enclosure/anticipation/2-feel line generator |
| `src/lib/music/audioConstants.js` | drum patterns | Freddie Green, Charleston, Son Clave 3:2 (two-bar pattern) |
| `src/lib/music/audio.js` | Tone.js engine | styled-bass scheduling, multi-bar drum patterns |
| `src/lib/music/improvGuide.js` | markdown export | 5-level Improv Guide generator (summary table, lead-sheet map, chord-by-chord roadmap, drills) |
| `src/lib/music/forms.js` | song library | Tonal-unique progressions (practice patterns, Same Old Blues, Impressions, alternate gypsy arrangements, Grateful Dead / Stones catalog) |
| `src/components/Fretboard.js` | fretboard display | Open D / Open E tunings |
| `src/components/Runway.jsx` | chord-anticipation strip | Runway quality-category colors + progress fill |
| `src/app/page.js` | app shell | Anticipate (next-chord) fretboard, Barry/Hex filter buttons, bass style + complexity UI, Improv Guide button |

## Later phases (not in this pass)

- **Gig mode** — absorb Rhino Gig Book (setlists, stage themes, print) from
  Jupiter; its songs import into the unified song schema, gaining playback.
- **Persistence** — replace localStorage silos (`dukebox-library`,
  Tonal's `userBebopProgressions`) with Supabase tables + one-click importers.
- **Jupiter seam** — point Jupiter's sidebar/cockpit/command-palette links at
  the unified app; add it to `/api/suite`.
- **Retirement** — only after every FEATURE_LEDGER row is ✅: banner+redirect
  on the GitHub Pages Tonal, Jupiter Gig Book route redirect.

Out of scope permanently (per owner): tutorials (Melodia, Jazz Cells,
melodia-fretboard). Tonal's ChordScribe AI modal is superseded by DukeBox's
working AI chart generator, not ported.
