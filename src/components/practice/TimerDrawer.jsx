"use client"

// Timer drawer (spec §5.6). <PracticeTimer> is dropped in unmodified — every
// existing handler (start/reset/+1 min/length/stop-at-zero) keeps working
// exactly as before. Only the "Auto-log session to memory" toggle below is
// new, and it's intentionally inert: session memory is a later feature, so
// for this pass it's a visual placeholder that doesn't persist or wire to
// anything (per spec §6 — no new mechanics beyond the view toggle).

import { useState } from "react"
import Drawer, { DrawerScrim } from "./Drawer"
import PracticeTimer from "@/components/PracticeTimer"

const inlineLabelStyle = { display: "flex", alignItems: "center", gap: "6px", fontSize: "13px" }
const selectStyle = { width: "100%", padding: "8px", borderRadius: "8px", background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--line)" }

export default function TimerDrawer({ open, onClose, transportRunning, onState, onFinish }) {
  const [autoLog, setAutoLog] = useState(false)

  return (
    <>
      <DrawerScrim open={open} onClose={onClose} />
      <Drawer open={open} onClose={onClose} side="right" title="⏱ Timer">
        <div style={{ padding: "10px 0 16px" }}>
          <PracticeTimer
            inlineLabelStyle={inlineLabelStyle}
            selectStyle={selectStyle}
            transportRunning={transportRunning}
            onState={onState}
            onFinish={onFinish}
          />
        </div>

        <label
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 4px", borderTop: "1px solid var(--line)", fontSize: "12.5px", cursor: "pointer",
          }}
          title="Coming soon — this will save a summary of the session to your practice history"
        >
          <span>
            Auto-log session to memory
            <span style={{ display: "block", color: "var(--muted)", fontSize: "11px", marginTop: "2px" }}>Coming soon</span>
          </span>
          <span
            role="switch"
            aria-checked={autoLog}
            onClick={() => setAutoLog((v) => !v)}
            style={{
              width: "34px", height: "20px", borderRadius: "11px", position: "relative", flexShrink: 0,
              background: autoLog ? "var(--accent)" : "var(--surface2)", border: `1px solid ${autoLog ? "var(--accent)" : "var(--line)"}`,
            }}
          >
            <i style={{
              position: "absolute", top: "1px", left: autoLog ? "15px" : "1px",
              width: "16px", height: "16px", borderRadius: "50%",
              background: autoLog ? "var(--accent-ink)" : "var(--muted)", transition: "left .2s",
            }} />
          </span>
        </label>
      </Drawer>
    </>
  )
}
