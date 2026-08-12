// ─── Build stamp ─────────────────────────────────────────────────────────────
// Which commit is actually running. Deploys are easy to misread — a cached page
// or an old preview URL looks exactly like a deploy that never happened — so the
// page states its own provenance instead of leaving you to infer it.
// Values are inlined at build time; see the `env` block in next.config.mjs.
//
// Lives here rather than in app/page.js because it renders on the Home screen,
// which mounts from layout.js in a separate React tree from the page.

export default function BuildStamp({ style: styleOverride }) {
  const sha = process.env.NEXT_PUBLIC_BUILD_SHA || "dev"
  const builtAt = process.env.NEXT_PUBLIC_BUILD_TIME || ""
  const repo = process.env.NEXT_PUBLIC_BUILD_REPO || ""

  // Formatted in UTC rather than the viewer's locale: server and browser sit in
  // different time zones, so a localised string renders differently on each and
  // trips React's hydration check. UTC is the same everywhere.
  const stamped = (() => {
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(builtAt)
    if (!m) return ""
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
    const [, , mo, day, hh, mm] = m
    return `${months[Number(mo) - 1]} ${Number(day)} ${hh}:${mm}Z`
  })()

  const label = `build ${sha}${stamped ? ` · ${stamped}` : ""}`
  const title = `Running commit ${sha}${builtAt ? `, built ${builtAt}` : ""}${repo ? ` from ${repo}` : ""}`

  const style = {
    fontSize: "var(--db-fs-xs)",
    fontFamily: "var(--font-mono, monospace)",
    color: "var(--db-muted)",
    padding: "4px 9px",
    borderRadius: "var(--db-r-pill)",
    border: "1px solid var(--db-panel-border)",
    background: "var(--db-panel-bg)",
    whiteSpace: "nowrap",
    textDecoration: "none",
    flexShrink: 0,
    ...styleOverride,
  }

  // Public repo — link straight to the commit that's live.
  if (repo && sha !== "dev") {
    return (
      <a href={`https://github.com/${repo}/commit/${sha}`} target="_blank" rel="noopener noreferrer" style={style} title={title}>
        {label}
      </a>
    )
  }
  return <span style={style} title={title}>{label}</span>
}
