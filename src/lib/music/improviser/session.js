// Continuous improviser session — the plan/commit controller from the build
// plan's Phase 2, kept PURE (no Tone.js, no React, no timers) so it can be
// tested with a fake clock and driven by any scheduler.
//
// The session thinks in ABSOLUTE beats: beat 67 of a 32-beat form is form
// beat 3 of chorus 3 (the form view handles the wrap, including the seam
// change from the last chord back to the first). Phrases are planned lazily
// ahead of a watermark; everything before the watermark is committed — the
// audio layer has scheduled it — and is never changed. Live control changes
// therefore only ever reshape phrases the listener hasn't heard scheduled
// yet, which is what makes dial moves feel responsive without ripping notes
// out from under the transport.
//
// Failure behavior: a phrase that generates nothing (all-N.C. bars, degenerate
// span) is simply silence — an intentional breath, never random filler.

import { createRng } from "./rng"
import { normalizeMeasures, createFormView } from "./chartTimeline"
import { blendStyle, IMPROV_PROFILES } from "./profiles"
import { planNextSpan } from "./rhythm"
import { generatePhrase, describePhrases } from "./generator"

// How far past a requested collection window planning runs, so anticipations
// and ringing landings near the edge already exist when their window comes.
const PLAN_AHEAD_BEATS = 8
// Fully-played phrases kept around for the UI (previous/current phrase).
const KEEP_PLAYED_PHRASES = 3

export function createImproviserSession({ measures, profileId = "bebop", controls = {}, seed = 1 }) {
  const timeline = normalizeMeasures(measures)
  const form = createFormView(timeline, { wrap: true })
  const rng = createRng(seed)

  let style = blendStyle(profileId, controls)
  let currentControls = { ...style.controls }
  let currentProfileId = style.id
  let controlRevision = 0

  const initialMemory = { prevMidi: style.register.center, prevSkeleton: null }

  // Planned phrases, in time order. Each carries the memory state AFTER it,
  // so a replan can resume from any kept phrase.
  let planned = [] // { span, events, trace, memoryAfter, revision }
  let planCursor = 0 // absolute beat where the next span starts planning
  let isFirstPhrase = true
  let collectedThrough = 0 // events before this are committed to audio

  function lastMemory() {
    return planned.length ? planned[planned.length - 1].memoryAfter : initialMemory
  }

  function planThrough(targetBeat) {
    if (!form.totalBeats) return
    while (planCursor < targetBeat) {
      const span = planNextSpan({ rng, style, cursor: planCursor, isFirst: isFirstPhrase })
      isFirstPhrase = false
      const result = generatePhrase({ rng, style, form, span, memory: lastMemory() })
      planned.push({
        span,
        events: result.events,
        trace: result.trace,
        memoryAfter: result.memory,
        revision: controlRevision,
      })
      planCursor = span.endBeat + span.gapAfter
    }
  }

  // Drop phrases that finished playing a while ago — the session must stay
  // bounded over an indefinite performance.
  function prune() {
    const doneCount = planned.filter((p) => p.span.endBeat + 4 < collectedThrough).length
    const drop = doneCount - KEEP_PLAYED_PHRASES
    if (drop > 0) planned = planned.slice(drop)
  }

  return {
    form,
    timeline,

    // Events with absolute beat in [collectedThrough, toBeat), exactly once.
    // The caller schedules them; from here on they're committed.
    collectEvents(toBeat) {
      planThrough(toBeat + PLAN_AHEAD_BEATS)
      const from = collectedThrough
      const out = []
      for (const p of planned) {
        if (p.span.endBeat < from - 4) continue
        for (const e of p.events) {
          if (e.t >= from && e.t < toBeat) out.push(e)
        }
      }
      collectedThrough = Math.max(collectedThrough, toBeat)
      prune()
      out.sort((a, b) => a.t - b.t)
      return out
    },

    // Live dial change. Committed events are untouched; planned-but-
    // uncollected phrases are discarded and replanned under the new style,
    // resuming the motif/voice-leading memory from the last kept phrase.
    updateControls(partial = {}) {
      controlRevision++
      if (partial.profileId && IMPROV_PROFILES[partial.profileId]) currentProfileId = partial.profileId
      currentControls = { ...currentControls, ...partial }
      style = blendStyle(currentProfileId, currentControls)

      const kept = []
      for (const p of planned) {
        // A phrase is committed once ANY of it has been collected.
        if (p.span.startBeat < collectedThrough) kept.push(p)
      }
      const dropped = planned.length - kept.length
      planned = kept
      if (dropped > 0 || planned.length === 0) {
        const last = planned[planned.length - 1]
        planCursor = last ? Math.max(collectedThrough, last.span.endBeat + last.span.gapAfter) : collectedThrough
      }
      return { revision: controlRevision, replannedFrom: planCursor }
    },

    // What's sounding at an absolute beat — for the live UI.
    infoAt(absBeat) {
      const total = form.totalBeats || 1
      const active = [...planned].reverse().find((p) => p.span.startBeat <= absBeat)
      return {
        chorus: Math.floor(absBeat / total) + 1,
        formBar: Math.floor((((absBeat % total) + total) % total) / 4) + 1,
        phrase: active ? describePhrases([active.trace], style) : null,
        resting: active ? absBeat >= active.span.endBeat : true,
      }
    },

    getSnapshot() {
      return {
        seed,
        profileId: currentProfileId,
        controls: { ...currentControls },
        controlRevision,
        collectedThrough,
        planCursor,
        plannedCount: planned.length,
      }
    },
  }
}
