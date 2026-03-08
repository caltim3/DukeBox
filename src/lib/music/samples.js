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
  kick:         "/samples/drums/kick.mp3",
  snare:        "/samples/drums/snare.mp3",
  hihat:        "/samples/drums/hihat.mp3",
  "hihat-open": "/samples/drums/hihat-open.mp3",
  ride:         "/samples/drums/ride.mp3",
}

// Bass uses the synth — add BASS_URLS + _bass here when good samples are ready

let _piano = null
let _drums  = null
let _loadPromise = null

/**
 * Load piano and drum samplers independently.
 * Each loads in its own try/catch so one failure won't affect the other.
 * Safe to call multiple times — reuses the in-flight promise.
 */
export async function initSamplers() {
  if (_loadPromise) return _loadPromise

  _loadPromise = Promise.allSettled([
    // Piano
    (async () => {
      const s = new Tone.Sampler({ urls: PIANO_URLS, release: 1.2 }).toDestination()
      s.volume.value = -14
      await Tone.loaded()
      _piano = s
    })(),
    // Drums
    (async () => {
      const p = new Tone.Players({ urls: DRUM_URLS, fadeOut: 0.04 }).toDestination()
      p.volume.value = -10
      await Tone.loaded()
      _drums = p
    })(),
  ]).then((results) => {
    const labels = ["Piano", "Drums"]
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        console.warn(`DukeBox: ${labels[i]} samples failed — using synth fallback.`, r.reason)
      }
    })
  })

  return _loadPromise
}

/**
 * Returns { piano, drums } — null for any that failed to load.
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
