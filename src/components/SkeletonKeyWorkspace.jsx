"use client"

// Skeleton Key — the curriculum's front door.
//
// Thin on purpose. This component navigates chapters and segments, speaks the
// pedagogue's part, tracks which gates are ticked, and hands one plain object
// to Line Lab. It generates nothing itself: the exercise below is a normal
// Line Lab result, so notation, TAB, the fretboard walkthrough, band playback,
// transpose, refingering, Add-to-Licktionary and MusicXML export all work
// without knowing a curriculum exists.
//
// The generation underneath is the rule-based Improviser, never the model
// route — an exercise has to come back identically, in any key, offline and
// free, or it can't be drilled. See src/lib/music/improviser/devices.js.

import { useEffect, useMemo, useState } from "react"
import LineLab from "@/components/LineLab"
import VocabularyWorkbench from "@/components/VocabularyWorkbench"
import { inferLineKey } from "@/lib/music/licktionary"
import {
  SK_CHAPTERS, SK_SEGMENTS, skTag,
  loadProgress, saveProgress, segmentAvailable, segmentComplete,
} from "@/lib/music/skeletonKey"

const SAVED_LICKS_KEY = "dukebox.licktionary.v1"
const UNLOCK_KEY = "dukebox.skeletonKey.unlockAll"

export default function SkeletonKeyWorkspace({
  stopPlayback, playLineSection, panelStyle, eyebrowStyle, selectStyle,
}) {
  const [progress, setProgress] = useState({})
  const [unlockAll, setUnlockAll] = useState(false)
  const [openChapter, setOpenChapter] = useState(1)
  const [segmentId, setSegmentId] = useState(SK_SEGMENTS[0].id)
  const [variantIdx, setVariantIdx] = useState(0)
  const [preset, setPreset] = useState(null)
  const [savedLicks, setSavedLicks] = useState([])
  const [selectedLickId, setSelectedLickId] = useState("")

  // Hydrate after mount, never during render — localStorage doesn't exist on
  // the server, and the same try//conditional shape the other workspaces use
  // keeps a corrupt blob from taking the tab down with it.
  useEffect(() => {
    try {
      const stored = loadProgress()
      if (stored && typeof stored === "object") setProgress(stored)
      if (window.localStorage.getItem(UNLOCK_KEY) === "1") setUnlockAll(true)
      const saved = JSON.parse(window.localStorage.getItem(SAVED_LICKS_KEY) || "[]")
      if (Array.isArray(saved)) setSavedLicks(saved)
    } catch { /* corrupt local data should never break the curriculum */ }
  }, [])

  const segment = useMemo(
    () => SK_SEGMENTS.find((s) => s.id === segmentId) || SK_SEGMENTS[0],
    [segmentId]
  )
  const variants = segment.exercise?.variants || []
  const variant = variants[Math.min(variantIdx, Math.max(0, variants.length - 1))] || null
  const available = segmentAvailable(segment, progress, unlockAll)

  function chooseSegment(next) {
    setSegmentId(next.id)
    setVariantIdx(0)
    setPreset(null)
    setOpenChapter(next.chapter)
  }

  function toggleGate(index) {
    setProgress((prev) => {
      const ticked = prev[segment.id] || []
      const next = {
        ...prev,
        [segment.id]: ticked.includes(index)
          ? ticked.filter((i) => i !== index)
          : [...ticked, index],
      }
      saveProgress(next)
      return next
    })
  }

  function setUnlock(value) {
    setUnlockAll(value)
    try { window.localStorage.setItem(UNLOCK_KEY, value ? "1" : "0") } catch {}
  }

  // The whole handoff: a segment plus a chosen key becomes one object. Line
  // Lab reads it, sets its own controls, and generates.
  function loadExercise() {
    const ex = segment.exercise
    if (!ex || !variant) return
    setPreset({
      nonce: Date.now(),
      measures: variant.measures,
      // A variant may name its own devices — Chapter 3.1 drills the four
      // approach types over the same bars, so the variant is the device, not
      // the key.
      devices: variant.devices ?? ex.devices,
      level: ex.level,
      profileId: ex.profileId,
      controls: ex.controls,
      tempo: ex.tempo,
      neckPosition: ex.neckPosition,
      tag: skTag(segment),
    })
  }

  function saveLick(entry) {
    const lick = {
      ...entry,
      id: `skeleton-key-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      baseKey: entry.baseKey || inferLineKey(entry.line),
      builtIn: false,
      createdAt: new Date().toISOString(),
    }
    setSavedLicks((prev) => {
      const next = [...prev, lick]
      try { window.localStorage.setItem(SAVED_LICKS_KEY, JSON.stringify(next)) } catch {}
      return next
    })
    setSelectedLickId(lick.id)
  }

  const doneCount = SK_SEGMENTS.filter((s) => segmentComplete(s, progress)).length
  const readyCount = SK_SEGMENTS.filter((s) => s.ready).length

  const card = {
    ...panelStyle,
    margin: 0,
  }
  const pill = (active, dim = false) => ({
    padding: "5px 12px", borderRadius: 999, fontSize: "var(--db-fs-sm)",
    cursor: dim ? "not-allowed" : "pointer", textAlign: "left",
    border: `1px solid ${active ? "var(--db-accent)" : "var(--db-panel-border)"}`,
    background: active ? "color-mix(in srgb, var(--db-accent) 16%, transparent)" : "transparent",
    color: active ? "var(--db-accent)" : "var(--db-text)",
    opacity: dim ? 0.4 : active ? 1 : 0.8,
  })

  return (
    <div style={{ display: "grid", gap: "16px", marginBottom: "20px" }}>
      {/* ── Where you are ────────────────────────────────────────────── */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "12px", flexWrap: "wrap" }}>
          <div style={{ ...eyebrowStyle, marginBottom: 0 }}>SKELETON KEY</div>
          <div style={{ fontSize: "var(--db-fs-sm)", opacity: 0.65 }}>
            {doneCount} of {SK_SEGMENTS.length} segments drilled · {readyCount} playable today
          </div>
          <label style={{ marginLeft: "auto", fontSize: "var(--db-fs-xs)", opacity: 0.7, display: "flex", alignItems: "center", gap: "6px" }}>
            <input type="checkbox" checked={unlockAll} onChange={(e) => setUnlock(e.target.checked)} />
            Unlock everything
          </label>
        </div>
        <div style={{ fontSize: "var(--db-fs-sm)", opacity: 0.7, marginTop: "8px", maxWidth: "62ch" }}>
          One skill per chapter, ordered from most concrete to most chromatic. A segment unlocks
          when the one before it is drilled. If a phrase in your solo can&apos;t be traced back to a
          segment, that&apos;s the signal to go back — not to add new material.
        </div>
      </div>

      {/* ── Chapters and segments ────────────────────────────────────── */}
      <div style={card}>
        <div style={{ display: "grid", gap: "10px" }}>
          {SK_CHAPTERS.map((chapter) => {
            const open = openChapter === chapter.n
            const chapterDone = chapter.segments.every(
              (seg) => segmentComplete(SK_SEGMENTS.find((s) => s.id === seg.id), progress)
            )
            return (
              <div key={chapter.n}>
                <button
                  onClick={() => setOpenChapter(open ? null : chapter.n)}
                  style={{
                    width: "100%", textAlign: "left", cursor: "pointer", padding: "8px 0",
                    background: "none", border: "none", color: "var(--db-text)",
                    display: "flex", alignItems: "baseline", gap: "10px", flexWrap: "wrap",
                  }}
                >
                  <span aria-hidden="true" style={{ color: "var(--db-accent)", fontSize: "1.1rem" }}>
                    {open ? "−" : "+"}
                  </span>
                  <strong style={{ fontSize: "var(--db-fs-md)" }}>
                    {chapter.n}. {chapter.title}
                  </strong>
                  {chapterDone && <span style={{ fontSize: "var(--db-fs-xs)", color: "var(--db-accent)" }}>drilled</span>}
                  {chapter.subtitle && (
                    <span style={{ fontSize: "var(--db-fs-xs)", opacity: 0.55 }}>{chapter.subtitle}</span>
                  )}
                </button>
                {open && (
                  <div style={{ paddingLeft: "24px" }}>
                    <div style={{ fontSize: "var(--db-fs-sm)", opacity: 0.7, margin: "2px 0 10px", maxWidth: "62ch" }}>
                      {chapter.welcome}
                    </div>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      {chapter.segments.map((raw) => {
                        const seg = SK_SEGMENTS.find((s) => s.id === raw.id)
                        const locked = !segmentAvailable(seg, progress, unlockAll)
                        const done = segmentComplete(seg, progress)
                        return (
                          <button
                            key={seg.id}
                            onClick={() => !locked && chooseSegment(seg)}
                            disabled={locked}
                            title={locked ? "Drill the segment before this one first" : seg.title}
                            style={pill(seg.id === segmentId, locked)}
                          >
                            {done ? "✓ " : locked ? "🔒 " : ""}{seg.id} {seg.title}
                            {!seg.ready && <span style={{ opacity: 0.6 }}> · soon</span>}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── The segment itself ───────────────────────────────────────── */}
      <div style={card}>
        <div style={{ ...eyebrowStyle }}>
          CH.{segment.chapter} · SEGMENT {segment.id} · {segment.pedagogue.toUpperCase()}
        </div>
        <h3 style={{ margin: "0 0 10px", fontSize: "var(--db-fs-lg)" }}>{segment.title}</h3>

        <blockquote style={{
          margin: "0 0 14px", padding: "10px 14px", maxWidth: "68ch",
          borderLeft: "3px solid var(--db-accent)", fontStyle: "italic",
          fontSize: "var(--db-fs-sm)", opacity: 0.88,
        }}>
          “{segment.voice}” <span style={{ fontStyle: "normal", opacity: 0.6 }}>— {segment.pedagogue}</span>
        </blockquote>

        {/* The quote says why this matters; the brief says what you are
            actually doing about it today. Without it a student got a
            philosophy and a device chip and had to infer the exercise. */}
        <div style={{
          fontSize: "var(--db-fs-sm)", lineHeight: 1.6, marginBottom: "14px",
          maxWidth: "68ch", padding: "12px 15px", borderRadius: "var(--db-r-md)",
          border: "1px solid var(--db-panel-border)",
          background: "color-mix(in srgb, var(--db-accent) 6%, transparent)",
        }}>
          <div style={{ ...eyebrowStyle, marginBottom: "6px", opacity: 0.75 }}>THE EXERCISE</div>
          {segment.brief}
        </div>

        {segment.task && (
          <div style={{ fontSize: "var(--db-fs-sm)", opacity: 0.75, marginBottom: "12px", maxWidth: "62ch" }}>
            <strong>Before the app:</strong> {segment.task}
          </div>
        )}

        {!available && (
          <div style={{ fontSize: "var(--db-fs-sm)", opacity: 0.75, marginBottom: "12px" }}>
            Locked — drill the segment before this one, or tick “Unlock everything” above.
          </div>
        )}

        {segment.ready && segment.workbench ? (
          <div style={{
            fontSize: "var(--db-fs-sm)", padding: "10px 14px", maxWidth: "64ch",
            borderRadius: "var(--db-r-md)", border: "1px solid var(--db-panel-border)",
          }}>
            <strong>What to listen for:</strong> {segment.listenFor}
            <div style={{ marginTop: "8px", opacity: 0.75 }}>
              This segment runs in the Vocabulary Workbench below rather than in Line Lab —
              there is nothing to load, because seeing it is the thing being withheld.
            </div>
          </div>
        ) : segment.ready ? (
          <>
            {segment.listenFor && (
              <div style={{ fontSize: "var(--db-fs-sm)", marginBottom: "12px", maxWidth: "62ch" }}>
                <strong>What to listen for:</strong> {segment.listenFor}
              </div>
            )}
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: "var(--db-fs-xs)", opacity: 0.62 }}>Key / variant</span>
              {variants.map((v, i) => (
                <button key={v.label} onClick={() => setVariantIdx(i)} aria-pressed={i === variantIdx} style={pill(i === variantIdx)}>
                  {v.label}
                </button>
              ))}
            </div>
            <div style={{ fontSize: "var(--db-fs-xs)", opacity: 0.6, margin: "10px 0" }}>
              {variant?.measures.join(" | ")} · L{segment.exercise.level}
              {(variant?.devices ?? segment.exercise.devices).length > 0 &&
                ` · ${(variant?.devices ?? segment.exercise.devices).join(", ")}`}
              {` · ${segment.exercise.tempo} bpm`}
            </div>
            <button
              onClick={loadExercise}
              disabled={!available}
              style={{
                padding: "9px 18px", borderRadius: "var(--db-r-md)", fontWeight: 700,
                border: "1px solid var(--db-accent)", cursor: available ? "pointer" : "not-allowed",
                background: "var(--db-accent)", color: "var(--db-bg)", opacity: available ? 1 : 0.45,
              }}
            >
              Load this exercise into Line Lab
            </button>
          </>
        ) : (
          <div style={{
            fontSize: "var(--db-fs-sm)", padding: "10px 14px", maxWidth: "62ch",
            borderRadius: "var(--db-r-md)", border: "1px dashed var(--db-panel-border)", opacity: 0.8,
          }}>
            <strong>Not generatable yet.</strong> This segment needs {segment.needs}. Its teaching
            text and its gate are here so the arc is visible — the exercise arrives when the device does.
          </div>
        )}

        {/* ── The gate ───────────────────────────────────────────────── */}
        <div style={{ fontSize: "var(--db-fs-xs)", opacity: 0.62, margin: "18px 0 7px" }}>
          Gate — tick these when they&apos;re true, and the next segment unlocks
        </div>
        <div style={{ display: "grid", gap: "7px" }}>
          {segment.gate.map((line, i) => {
            const ticked = (progress[segment.id] || []).includes(i)
            return (
              <label key={line} style={{ display: "flex", gap: "9px", alignItems: "flex-start", fontSize: "var(--db-fs-sm)", cursor: "pointer", opacity: ticked ? 0.65 : 1 }}>
                <input type="checkbox" checked={ticked} onChange={() => toggleGate(i)} style={{ marginTop: "3px" }} />
                <span style={{ textDecoration: ticked ? "line-through" : "none" }}>{line}</span>
              </label>
            )
          })}
        </div>
      </div>

      {/* ── Chapter 9 runs in the Workbench; everything else in Line Lab ── */}
      {segment.workbench && (
        <VocabularyWorkbench
          playLineSection={playLineSection}
          onStopPlayback={stopPlayback}
          onSaveLick={saveLick}
          panelStyle={panelStyle}
          eyebrowStyle={eyebrowStyle}
          selectStyle={selectStyle}
        />
      )}

      {/* ── The exercise, as a normal Line Lab result ────────────────── */}
      <div style={card}>
        <div style={{ ...eyebrowStyle }}>LINE LAB</div>
        <div style={{ fontSize: "var(--db-fs-sm)", opacity: 0.65, marginBottom: "12px" }}>
          {preset
            ? "Loaded. Every bar's reasoning is stamped with the segment it came from."
            : "Load a segment above, or drive this directly — it's the full Line Lab."}
        </div>
        <LineLab
          chartBars={[]}
          chartTitle="Skeleton Key"
          onStopPlayback={stopPlayback}
          playLineSection={playLineSection}
          panelStyle={{ ...panelStyle, margin: 0 }}
          eyebrowStyle={eyebrowStyle}
          selectStyle={selectStyle}
          licks={savedLicks}
          selectedLickId={selectedLickId}
          onSelectLick={setSelectedLickId}
          onSaveLick={saveLick}
          preset={preset}
        />
      </div>
    </div>
  )
}
