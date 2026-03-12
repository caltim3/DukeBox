import * as Tone from "tone"

// Piano sample map — files live at public/samples/piano/
const PIANO_URLS = {
  "A2":  "/samples/piano/a2.mp3",
  "C3":  "/samples/piano/c3.mp3",
  "Eb3": "/samples/piano/ds3.mp3",
  "Gb3": "/samples/piano/fs3.mp3",
  "A3":  "/samples/piano/a3.mp3",
  "C4":  "/samples/piano/c4.mp3",
  "Eb4": "/samples/piano/ds4.mp3",
  "Gb4": "/samples/piano/fs4.mp3",
  "A4":  "/samples/piano/a4.mp3",
  "C5":  "/samples/piano/c5.mp3",
  "Eb5": "/samples/piano/ds5.mp3",
  "Gb5": "/samples/piano/fs5.mp3",
}

// Drum sample map — files live at public/samples/drums/.
// Only instruments emitted by drumEvents() are listed; loading unused samples
// wastes a network request on startup.
// (jazzsnare.mp3 exists on disk — add it here + to drumEvents() when a 2-&-4
//  snare pattern is desired.)
const DRUM_URLS = {
  kick:  "/samples/drums/jazzkick.mp3",  // beat 1
  ride:  "/samples/drums/jazzhat.mp3",   // ride cymbal pattern
  hihat: "/samples/drums/HiHat.mp3",     // closed hi-hat (beats 2 & 4)
}

// Bass sample map — files live at public/samples/bass/
// 21 pitches (E1–C3) × 2 velocities (soft/hard) × 2 round robins = 84 files
const BASS_PITCHES = ["E1","F1","Fs1","G1","Gs1","A1","As1","B1","C2","Cs2","D2","Ds2","E2","F2","Fs2","G2","Gs2","A2","As2","B2","C3"]
const BASS_URLS = {}
for (const p of BASS_PITCHES)
  for (const v of ["soft","hard"])
    for (const r of [1,2])
      BASS_URLS[`${p}_${v}_rr${r}`] = `/samples/bass/${p}_${v}_rr${r}.mp3`

let _piano = null
let _drums  = null
let _bass   = null
let _loadPromise = null

/**
 * Load piano and drum samplers.
 * Both instruments are created synchronously (all URLs registered) before the
 * single Tone.loaded() call, so there's no race between the two buffers sets.
 * Assigns whichever buffers succeeded even if some files 404'd.
 * Safe to call multiple times — reuses the in-flight promise.
 */
export async function initSamplers() {
  if (_loadPromise) return _loadPromise

  _loadPromise = (async () => {
    // 1. Create both instruments synchronously — registers all URLs with Tone
    let pianoRef = null
    let drumsRef = null
    let bassRef  = null

    try {
      pianoRef = new Tone.Sampler({ urls: PIANO_URLS, release: 1.2 }).toDestination()
      pianoRef.volume.value = -14
    } catch (err) {
      console.warn("DukeBox: Piano sampler creation failed.", err)
    }

    try {
      drumsRef = new Tone.Players({ urls: DRUM_URLS, fadeOut: 0.04 }).toDestination()
      drumsRef.volume.value = -10
    } catch (err) {
      console.warn("DukeBox: Drums player creation failed.", err)
    }

    try {
      bassRef = new Tone.Players({ urls: BASS_URLS, fadeOut: 0.04 }).toDestination()
      bassRef.volume.value = -8
    } catch (err) {
      console.warn("DukeBox: Bass player creation failed.", err)
    }

    // 2. Single await — waits for ALL registered buffers together
    try {
      await Tone.loaded()
    } catch (err) {
      // Some files may have 404'd; assign anyway — Sampler interpolates from neighbours
      console.warn("DukeBox: One or more sample files failed to load.", err)
    }

    // 3. Assign regardless of partial failures — null stays null if creation failed
    _piano = pianoRef
    _drums = drumsRef
    _bass  = bassRef
  })()

  return _loadPromise
}

/**
 * Returns { piano, drums, bass } — null for any that failed to create.
 */
export function getSamplers() {
  return { piano: _piano, drums: _drums, bass: _bass }
}

export function disposeSamplers() {
  try { _piano?.dispose() } catch {}
  try { _drums?.dispose() } catch {}
  try { _bass?.dispose()  } catch {}
  _piano = _drums = _bass = null
  _loadPromise = null
}
