// BeatForge metronome engine — ported from Bebop Blueprint's metronome section,
// rebuilt on the Tone.js Transport (replacing the original setInterval scheduler,
// which drifted at extreme tempos).
//
// Cells are the unit of programming: one per subdivision, each 0 = off,
// 1 = normal hit, 2 = accent. Click/woodblock modes voice every active cell on
// one sample; drums mode voices accents as kick+ride and normal hits as hi-hat.

import * as Tone from "tone"
import { DRUM_KITS, DEFAULT_DRUM_KIT } from "./samples"

const CLICK_URL     = "/samples/drums/Click.mp3"
const WOODBLOCK_URL = "/samples/drums/woodblock.mp3"

let _players = null
let _loadPromise = null
let _repeatId = null
let _running = false
let _cellIndex = 0

// Live-updatable settings (read inside the scheduled callback)
const _cfg = {
  cells: [2, 0, 1, 0, 1, 0, 1, 0],
  sound: "click",           // "click" | "woodblock" | "drums"
  kit: DEFAULT_DRUM_KIT,
  volume: 0.8,
  accentIntensity: 1.35,
}

async function ensurePlayers() {
  if (_loadPromise) return _loadPromise
  _loadPromise = (async () => {
    const urls = { click: CLICK_URL, woodblock: WOODBLOCK_URL }
    for (const [kit, insts] of Object.entries(DRUM_KITS))
      for (const [inst, url] of Object.entries(insts))
        urls[`${kit}:${inst}`] = url
    _players = new Tone.Players({ urls, fadeOut: 0.03 }).toDestination()
    _players.volume.value = -8
    try { await Tone.loaded() } catch { /* partial loads still play */ }
  })()
  return _loadPromise
}

function trigger(key, time, vel) {
  try {
    const p = _players.player(key)
    p.volume.value = Tone.gainToDb(Math.max(0.01, vel))
    p.start(time)
  } catch { /* missing sample — skip the hit */ }
}

function playCell(state, time) {
  const accent = state === 2
  const vel = _cfg.volume * (accent ? _cfg.accentIntensity : 1)
  if (_cfg.sound === "drums") {
    if (accent) {
      trigger(`${_cfg.kit}:kick`, time, vel)
      trigger(`${_cfg.kit}:ride`, time, vel * 0.9)
    } else {
      trigger(`${_cfg.kit}:hihat`, time, vel * 0.8)
    }
  } else {
    trigger(_cfg.sound === "woodblock" ? "woodblock" : "click", time, vel)
  }
}

/** Update settings while running — takes effect on the next cell. */
export function updateMetronome(partial) {
  Object.assign(_cfg, partial)
}

export function setMetronomeTempo(bpm) {
  Tone.getTransport().bpm.value = bpm
}

export function isMetronomeRunning() {
  return _running
}

/**
 * Start the metronome. Owns the shared Transport — callers must stop chart
 * playback first (and vice versa).
 *
 * @param {object} opts { tempo, cells, subdivision ("4n"|"8n"), sound, kit,
 *                        volume, accentIntensity, onTick(cellIndex) }
 */
export async function startMetronome({
  tempo = 120,
  cells,
  subdivision = "8n",
  sound = "click",
  kit = DEFAULT_DRUM_KIT,
  volume = 0.8,
  accentIntensity = 1.35,
  onTick = null,
} = {}) {
  await Tone.start()
  await ensurePlayers()
  stopMetronome()

  updateMetronome({ cells, sound, kit, volume, accentIntensity })
  _cellIndex = 0

  const tr = Tone.getTransport()
  const draw = Tone.getDraw()
  tr.cancel(0)
  tr.position = 0
  tr.bpm.value = tempo
  tr.swing = 0

  _repeatId = tr.scheduleRepeat((time) => {
    const list = _cfg.cells
    if (!list?.length) return
    const i = _cellIndex % list.length
    const state = list[i]
    if (state) playCell(state, time)
    if (onTick) draw.schedule(() => onTick(i), time)
    _cellIndex++
  }, subdivision)

  _running = true
  tr.start()
}

export function stopMetronome() {
  const tr = Tone.getTransport()
  if (_repeatId != null) { try { tr.clear(_repeatId) } catch {} }
  _repeatId = null
  if (_running) { tr.stop(); tr.cancel(0) }
  _running = false
  _cellIndex = 0
}
