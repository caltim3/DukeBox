"use client"

import { useMemo, useState } from "react"
import { buildTab } from "@/lib/music/lines"
import { LICK_KEYS, transposeLine } from "@/lib/music/licktionary"

const actionStyle = {
  padding: "6px 10px", borderRadius: "var(--db-r-md)", cursor: "pointer",
  border: "1px solid var(--db-panel-border)", background: "transparent",
  color: "var(--db-text)", fontSize: "var(--db-fs-xs)", fontWeight: 700,
}

function LickPanel({ lick, targetKey, onOpen }) {
  if (!lick) return null
  const line = transposeLine(lick.line, lick.baseKey || "C", targetKey)
  return (
    <div style={{
      minWidth: 0, border: "1px solid var(--db-panel-border)", borderRadius: "var(--db-r-md)",
      background: "var(--db-card-bg)", padding: "12px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", flexWrap: "wrap" }}>
        <span style={{
          fontSize: "var(--db-fs-xs)", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase",
          color: lick.mode === "minor" ? "var(--db-c-blue, var(--db-accent))" : "var(--db-c-salmon, var(--db-accent))",
        }}>{lick.mode === "minor" ? "Minor ii-V-i" : lick.mode === "major" ? "Major ii-V-I" : "Saved lick"}</span>
        <button type="button" onClick={() => onOpen(lick.id, targetKey)} style={{ ...actionStyle, marginLeft: "auto", color: "var(--db-accent)", borderColor: "var(--db-accent)" }}>
          ▶ Open in Line Lab
        </button>
      </div>
      <div style={{ display: "flex", gap: "5px", flexWrap: "wrap", marginBottom: "8px" }}>
        {(line.bars || []).map((bar, index) => (
          <span key={index} style={{
            padding: "3px 7px", borderRadius: "var(--db-r-sm, 6px)",
            border: "1px solid var(--db-panel-border)", fontFamily: "var(--font-mono, monospace)",
            fontSize: "var(--db-fs-xs)", color: "var(--db-accent)",
          }}>{bar.c}</span>
        ))}
      </div>
      <pre style={{
        margin: 0, overflowX: "auto", fontFamily: "var(--font-mono, monospace)",
        fontSize: "11px", lineHeight: 1.35, color: "var(--db-text)", opacity: 0.86,
      }}>{buildTab(line.bars || [])}</pre>
    </div>
  )
}

export default function Licktionary({ licks, selectedLickId, onOpenLick, selectStyle }) {
  const [targetKey, setTargetKey] = useState("C")
  const [query, setQuery] = useState("")
  const builtIns = useMemo(() => licks.filter((lick) => lick.builtIn), [licks])
  const custom = useMemo(() => licks.filter((lick) => !lick.builtIn), [licks])
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const byNumber = new Map()
    for (const lick of builtIns) {
      if (q && !`${lick.name} ${lick.device} ${lick.cue}`.toLowerCase().includes(q)) continue
      const group = byNumber.get(lick.n) || { n: lick.n, name: lick.name, device: lick.device, cue: lick.cue }
      group[lick.mode] = lick
      byNumber.set(lick.n, group)
    }
    return Array.from(byNumber.values()).sort((a, b) => a.n - b.n)
  }, [builtIns, query])

  return (
    <div>
      <div style={{
        display: "flex", alignItems: "end", gap: "10px", flexWrap: "wrap",
        paddingBottom: "14px", marginBottom: "16px", borderBottom: "1px solid var(--db-panel-border)",
      }}>
        <div style={{ flex: "1 1 360px" }}>
          <div style={{ fontSize: "var(--db-fs-lg)", fontWeight: 800 }}>Twenty-Four Ways In</div>
          <div style={{ fontSize: "var(--db-fs-sm)", color: "var(--db-muted)", marginTop: "3px" }}>
            The full bebop line playbook, major and minor. Every lick can move to any key and opens directly in Line Lab for playback and MusicXML.
          </div>
        </div>
        <label style={{ fontSize: "var(--db-fs-xs)", color: "var(--db-muted)" }}>Transpose all to
          <select value={targetKey} onChange={(e) => setTargetKey(e.target.value)} style={{ ...selectStyle, width: "90px", marginTop: "4px" }}>
            {LICK_KEYS.map((key) => <option key={key} value={key}>{key}</option>)}
          </select>
        </label>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find enclosure, pivot, Martino…"
          style={{
            width: "240px", padding: "9px 10px", borderRadius: "var(--db-r-md)",
            border: "1px solid var(--db-panel-border)", background: "var(--db-input-bg)", color: "var(--db-text)",
          }}
        />
      </div>

      <div style={{ display: "grid", gap: "18px" }}>
        {groups.map((group) => (
          <article key={group.n} style={{ borderTop: "3px solid var(--db-text)", paddingTop: "10px" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: "10px", flexWrap: "wrap", marginBottom: "9px" }}>
              <span style={{ fontFamily: "var(--font-mono, monospace)", fontSize: "var(--db-fs-xs)", color: "var(--db-muted)" }}>No. {group.n}</span>
              <strong style={{ fontSize: "var(--db-fs-lg)" }}>{group.name}</strong>
              <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono, monospace)", fontSize: "var(--db-fs-xs)", color: "var(--db-muted)" }}>{group.device}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "10px" }}>
              <LickPanel lick={group.major} targetKey={targetKey} onOpen={onOpenLick} />
              <LickPanel lick={group.minor} targetKey={targetKey} onOpen={onOpenLick} />
            </div>
            <div style={{ marginTop: "8px", fontSize: "var(--db-fs-sm)", fontStyle: "italic", color: "var(--db-muted)" }}>{group.cue}</div>
          </article>
        ))}
      </div>

      {custom.length > 0 && (
        <div style={{ marginTop: "24px", borderTop: "4px double var(--db-text)", paddingTop: "14px" }}>
          <div style={{ fontSize: "var(--db-fs-lg)", fontWeight: 800, marginBottom: "10px" }}>My Line Lab Licks</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "10px" }}>
            {custom.map((lick) => (
              <div key={lick.id} style={{ outline: lick.id === selectedLickId ? "2px solid var(--db-accent)" : "none", borderRadius: "var(--db-r-md)" }}>
                <div style={{ fontSize: "var(--db-fs-sm)", fontWeight: 800, marginBottom: "5px" }}>{lick.name}</div>
                <LickPanel lick={lick} targetKey={targetKey} onOpen={onOpenLick} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
