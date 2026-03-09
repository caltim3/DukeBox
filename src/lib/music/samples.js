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

// Drum sample map — files live at public/samples/drums/
const DRUM_URLS = {
  kick:  "/samples/drums/jazzkick.mp3",   // jazz kick drum
  ride:  "/samples/drums/jazzhat.mp3",    // jazz ride cymbal (using hat sample)
  hihat: "/samples/drums/HiHat.mp3",      // closed hi-hat (beats 2 & 4)
  snare: "/samples/drums/jazzsnare.mp3",  // jazz snare
}

// Bass always uses the synth — add BASS_URLS + _bass here when good samples are ready

let _piano = null
let _drums  = null
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
  })()

  return _loadPromise
}

/**
 * Returns { piano, drums } — null for any that failed to create.
 * Bass is intentionally omitted; the walking-bass synth is always used.
 */
export function getSamplers() {
  return { piano: _piano, drums: _drums }
}

export function disposeSamplers() {
  try { _piano?.dispose() } catch {}
  try { _drums?.dispose() } catch {}
  _piano = _drums = null
  _loadPromise = null
}
