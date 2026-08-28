// The jazz time signatures the playback mechanism can swing to — kept in
// their own tiny, dependency-free module rather than living in audio.js
// (the playback engine) so:
//   - UI code (ChartRibbon's Meter picker) can read the option list without
//     pulling in audio.js's Tone.js dependency, which page.js's loadAudio()
//     keeps out of the initial bundle via a dynamic import.
//   - Pure-data song modules (desertNoir.js) can validate/normalize a
//     song's `meter` field the same way, without importing the engine.
//
// Every meter here is "simple" (the beat is a quarter note) except 6/8,
// which is treated as 6 straight quarter-note-equivalent pulses per bar
// rather than a true two-big-beat compound lilt — see audio.js's
// startPlayback for what that trade-off buys (every hit-plan, walking-bass
// and drum-groove calculation in there works in "pulses per bar" and stays
// correct for any of these four without a second, dotted-beat unit to carry
// through all of them).
export const JAZZ_METERS = ["4/4", "3/4", "5/4", "6/8"]
export const DEFAULT_METER = "4/4"
export const METER_BEATS = { "4/4": 4, "3/4": 3, "5/4": 5, "6/8": 6 }

export function meterBeatsPerBar(meter) {
  return METER_BEATS[meter] ?? METER_BEATS[DEFAULT_METER]
}
