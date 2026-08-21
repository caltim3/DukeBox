"use client"

import { useEffect, useRef, useState } from "react"
import { GUIDES } from "./ReferenceGuides"
import { getRecentActivity, entryKind, logActivity } from "@/lib/recentActivity"
import { getLastLine, requestResumeLastLine } from "@/lib/music/lastLine"
import { STARTER_STRIP, requestStarter } from "@/lib/music/starters"
import { GO_HOME_EVENT } from "@/lib/homeNav"
import { OPEN_LIBRARY_EVENT, requestLoadSong } from "@/lib/music/songSource"
import { readLocalLibrary } from "@/lib/cloud"
import BuildStamp from "./BuildStamp"

const BRAND_ICON = "/dukebox-jazzmaster.png"

const WORKSPACE_LABELS = {
  practice: "Practice",
  gig: "Gig",
  create: "Create",
  beatforge: "BeatForge",
  reference: "Reference",
  tonal: "Tonal",
}

// Three ways to start a session from scratch — shown below the adaptive
// hero, not instead of it. Each backed by the app's actual practice/create/
// gig entry points; `shortcut` is display-only, for the corner stamp.
const GET_STARTED = [
  {
    eyebrow: "Practice",
    title: "Practice a Song",
    subtitle: "Open the songbook and start playing",
    image: "/practice.png",
    shortcut: "/",
    action: { type: "songbook" },
  },
  {
    eyebrow: "Compose",
    title: "Write a Song",
    subtitle: "Build a chart, generate changes, or start from scratch",
    image: "/compose.png",
    shortcut: "3",
    action: { type: "workspace", value: "create" },
  },
  {
    eyebrow: "Perform",
    title: "Play a Gig",
    subtitle: "Stage charts and setlists",
    image: "/gig.png",
    shortcut: "2",
    action: { type: "workspace", value: "gig" },
  },
]

// The learning plan is two rows: the systems you practise WITH on top, the
// tunes you practise ON underneath. Cards are drag-reorderable within their
// own row (the split is the point, so they don't cross rows); the order is
// saved per row in localStorage.
const PLAN_ROWS = [
  {
    id: "systems",
    label: "Systems",
    items: [
      {
        id: "beatforge",
        badge: "Rhythm Path",
        title: "BeatForge",
        subtitle: "Time workout and bebop rhythm generator",
        image: "/cards/beatforge2.jpg",
        shortcut: "B",
        action: { type: "beatforge-panel", value: "beatforge-metronome" },
      },
      {
        id: "linelab",
        badge: "Line Path",
        title: "LineLab",
        subtitle: "Develop single-note lines over the changes",
        image: "/cards/linelab2.jpg",
        action: { type: "beatforge-section", value: "beatforge-line-lab" },
      },
      {
        id: "songcrafter",
        badge: "Songwriting Path",
        title: "SongCrafter",
        subtitle: "Assemble progressions into a draft",
        image: "/cards/songcrafter2.jpg",
        action: { type: "create-section", value: "create-songcrafter" },
      },
      {
        id: "song-library",
        badge: "Jazz Standards",
        title: "Song Library",
        subtitle: "Every chart in the songbook",
        image: "/cards/song-library2.jpg",
        shortcut: "/",
        action: { type: "songbook", value: "Jazz Standards" },
      },
    ],
  },
  {
    id: "songs",
    label: "Songs",
    items: [
      {
        id: "251",
        badge: "Learning Pathway",
        title: "251 Mastery",
        subtitle: "The ii-V-I through all twelve keys",
        image: "/cards/251-mastery2.jpg",
        action: { type: "starter", value: "major-251" },
      },
      {
        id: "black-orpheus",
        badge: "Song Study",
        title: "Black Orpheus",
        subtitle: "Minor ii-V-I roadmap",
        image: "/cards/black-orpheus2.jpg",
        action: { type: "starter", value: "black-orpheus" },
      },
      {
        id: "autumn-leaves",
        badge: "Song Study",
        title: "Autumn Leaves",
        subtitle: "The standard every session starts with",
        image: "/cards/autumn-leaves2.jpg",
        action: { type: "starter", value: "autumn-leaves" },
      },
      {
        id: "dark-eyes",
        badge: "Song Study",
        title: "Dark Eyes",
        subtitle: "Gypsy jazz minor swing",
        image: "/cards/dark-eyes2.jpg",
        action: { type: "starter", value: "dark-eyes" },
      },
      {
        id: "blues",
        badge: "Practice System",
        title: "Blues",
        subtitle: "Jazz blues in Bb, guide tones to language",
        image: "/cards/blues2.jpg",
        action: { type: "starter", value: "jazz-blues-bb" },
      },
    ],
  },
]

const PLAN_ORDER_KEY = "dukebox.planOrder"

// Direct links to the actual reference guides (public/reference/*.html),
// the same list the Reference tab embeds — not placeholder cards.
const CORE_CURRICULUM = GUIDES.map((guide, index) => ({
  number: String(index + 1).padStart(2, "0"),
  title: guide.title,
  copy: guide.subtitle,
  href: guide.src,
}))

function textOf(element) {
  return element?.textContent?.replace(/\s+/g, " ").trim().toLowerCase() ?? ""
}

function findWorkspaceTab(label) {
  const target = label.toLowerCase()
  return [...document.querySelectorAll('[role="tab"]')].find((tab) => textOf(tab).includes(target))
}

function selectedWorkspace() {
  const selected = [...document.querySelectorAll('[role="tab"][aria-selected="true"]')][0]
  const text = textOf(selected)
  return Object.entries(WORKSPACE_LABELS).find(([, label]) => text.includes(label.toLowerCase()))?.[0] ?? null
}

function findClickableByText(label) {
  const target = label.toLowerCase()
  const candidates = [...document.querySelectorAll("button, [role='button'], a")]
  return candidates.find((element) => textOf(element) === target)
    ?? candidates.find((element) => textOf(element).includes(target))
}

function findSectionByText(label) {
  const target = label.toLowerCase()
  const candidates = [...document.querySelectorAll("h1, h2, h3, h4, div, span")]
  return candidates.find((element) => {
    const text = textOf(element)
    if (!text || text.length > 80) return false
    return text === target || text.includes(target)
  })
}

// Recent-activity entries carry an action.type + optional workspace id;
// map that to one of Icon's existing glyphs rather than inventing new art
// for every possible thing a user might have just done.
function recentIconName(entry) {
  const { type, value } = entry.action || {}
  if (type === "workspace") return value || "practice"
  if (type === "songbook" || type === "starter") return "songbook"
  if (type === "beatforge-section" && value === "beatforge-line-lab") return "lick"
  if (type === "reference") return "reference"
  return "practice"
}

function timeAgo(at) {
  const seconds = Math.max(0, Math.floor((Date.now() - at) / 1000))
  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return days === 1 ? "yesterday" : `${days}d ago`
}

// The rail's "Most Popular" list — page.js's loadSong() bumps a per-song
// count in the synced library's prefs every time a real catalog tune (one
// with a songId) is loaded, denormalized with its own title/subtitle so
// this doesn't need the whole catalog rebuilt just to show a ranked list.
// readLocalLibrary() is the same localStorage mirror useCloudLibrary keeps
// even while signed in — Home has no props into page.js's library state,
// same reasoning as recentActivity.js and lastLine.js.
function getMostPlayed(limit = 5) {
  const counts = readLocalLibrary()?.prefs?.playCounts
  if (!counts) return []
  return Object.entries(counts)
    .map(([id, entry]) => ({ id, ...entry }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

// A last-touched Line Lab line, boiled down to (string, fret) dots for a
// compact tab strip. Trimmed to a representative excerpt — a home-page
// preview card, not the real notation — with a "+N more" tag if the line
// runs longer than that.
const MAX_TAB_NOTES = 9
function tabPointsFor(line) {
  const all = []
  for (const bar of line?.bars || []) {
    for (const [s, f] of bar.n || []) all.push({ s, f })
  }
  const shown = all.slice(0, MAX_TAB_NOTES)
  const PAD = 30, W = 480
  const step = shown.length > 1 ? (W - PAD * 2) / (shown.length - 1) : 0
  return {
    more: Math.max(0, all.length - shown.length),
    points: shown.map((p, i) => ({ ...p, x: PAD + i * step, y: 10 + (5 - p.s) * 19 })),
  }
}

function LickTabStrip({ line }) {
  const { points, more } = tabPointsFor(line)
  if (!points.length) return null
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ")
  const strings = ["e", "B", "G", "D", "A", "E"]
  return (
    <svg viewBox="0 0 510 118" className="db-pickup-lick-svg" role="img" aria-label="Tab preview of the line">
      {strings.map((name, i) => (
        <text key={name} x="4" y={14 + i * 19} className="db-pickup-lick-stringlabel">{name}</text>
      ))}
      {strings.map((_, i) => (
        <line key={i} x1="18" y1={10 + i * 19} x2="494" y2={10 + i * 19} className="db-pickup-lick-line" />
      ))}
      <path d={path} className="db-pickup-lick-path" />
      {points.map((p, i) => {
        const last = i === points.length - 1
        return (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={last ? 10.5 : 9} className={last ? "db-pickup-lick-note is-last" : "db-pickup-lick-note"} />
            <text x={p.x} y={p.y + 3.5} className={last ? "db-pickup-lick-fret is-last" : "db-pickup-lick-fret"}>{p.f}</text>
          </g>
        )
      })}
      {more > 0 && <text x="494" y="112" className="db-pickup-lick-more" textAnchor="end">+{more} more</text>}
    </svg>
  )
}

function Icon({ name }) {
  const paths = {
    home: <><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-7h6v7"/></>,
    practice: <><path d="M4 19V5"/><path d="M4 12h5l3-5 4 10 2-5h2"/></>,
    songbook: <><path d="M4 4h7a3 3 0 0 1 3 3v13H7a3 3 0 0 0-3 1V4Z"/><path d="M20 4h-3a3 3 0 0 0-3 3v13h3a3 3 0 0 1 3 1V4Z"/></>,
    create: <><path d="m4 20 4.5-1 10-10-3.5-3.5-10 10L4 20Z"/><path d="m13.5 7 3.5 3.5"/></>,
    gig: <><path d="M9 18V5l10-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/></>,
    reference: <><circle cx="12" cy="12" r="9"/><path d="m15 9-2 4-4 2 2-4 4-2Z"/></>,
    tonal: <><path d="M4 20V4h16v16H4Z"/><path d="M8 4v10M12 4v10M16 4v10"/><path d="M6 14h3M10 14h3M14 14h3"/></>,
    beatforge: <><path d="M6 5h12l3 15H3L6 5Z"/><path d="M8 5V3h8v2"/><path d="M9 11h6"/></>,
    linelab: <><path d="M3 16c3-1 3-10 6-10s3 9 6 9 3-6 6-6"/><circle cx="3" cy="16" r="1.3" fill="currentColor" stroke="none"/><circle cx="21" cy="9" r="1.3" fill="currentColor" stroke="none"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    help: <><circle cx="12" cy="12" r="9"/><path d="M9.6 9a2.7 2.7 0 1 1 4.4 2.1c-1 .8-2 1.3-2 2.9"/><path d="M12 18h.01"/></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 8h18c0-1-3-1-3-8"/><path d="M10 20h4"/></>,
    chevron: <path d="m9 18 6-6-6-6"/>,
    play: <path d="M8 5v14l11-7z" fill="currentColor" stroke="none"/>,
    lick: <path d="M3 12c2-4 4 4 6 0s4 4 6 0 4 4 6 0"/>,
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  )
}

function DukeMark({ onClick }) {
  return (
    <button type="button" className="db-pickup-logo" aria-label="DukeBox — Home" onClick={onClick}>
      <span className="db-pickup-logo-mark" aria-hidden="true">
        <i /><i /><i />
      </span>
      <span>duke<span>box</span></span>
    </button>
  )
}

export default function PickupPracticeHome() {
  const [workspace, setWorkspace] = useState("practice")
  const [practiceSurface, setPracticeSurface] = useState("home")
  const previousWorkspace = useRef(null)

  useEffect(() => {
    function syncWorkspace() {
      const next = selectedWorkspace()
      if (!next) return

      const previous = previousWorkspace.current
      if (next === "practice" && previous && previous !== "practice") {
        setPracticeSurface("home")
      }
      previousWorkspace.current = next
      setWorkspace(next)
    }

    syncWorkspace()
    const observer = new MutationObserver(syncWorkspace)
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["aria-selected"],
    })

    return () => observer.disconnect()
  }, [])

  const homeOpen = workspace === "practice" && practiceSurface === "home"

  useEffect(() => {
    document.body.classList.toggle("db-pickup-home-open", homeOpen)
    return () => document.body.classList.remove("db-pickup-home-open")
  }, [homeOpen])

  // "Jump back in" reads whatever's been logged to localStorage (recent
  // activity) and the last Line Lab line, if any — both plain modules (not
  // shared React state) written from the real action sites, re-read every
  // time the home screen is about to show. Effect, not render-phase, for the
  // same reason as planOrder below: localStorage isn't available on the
  // server, and reading it during render would make the first client paint
  // disagree with the server HTML.
  const [recent, setRecent] = useState([])
  const [lastLine, setLastLineState] = useState(null)
  const [mostPlayed, setMostPlayed] = useState([])
  useEffect(() => {
    if (homeOpen) {
      setRecent(getRecentActivity())
      setLastLineState(getLastLine())
      setMostPlayed(getMostPlayed())
    }
  }, [homeOpen])

  // Drag-reorderable plan cards. planOrder holds each row's card ids; unknown
  // ids are dropped and new ones appended, so editing PLAN_ROWS in code never
  // strands a saved order.
  const [planOrder, setPlanOrder] = useState(null)
  // Hydrating from localStorage has to happen after mount — it isn't available
  // while this renders on the server, and seeding it during render would make
  // the first client paint disagree with the server HTML.
  useEffect(() => {
    let saved = null
    try { saved = JSON.parse(window.localStorage.getItem(PLAN_ORDER_KEY) || "null") } catch { /* ignore */ }
    setPlanOrder(Object.fromEntries(PLAN_ROWS.map((row) => {
      const ids = row.items.map((item) => item.id)
      const fromSaved = Array.isArray(saved?.[row.id]) ? saved[row.id].filter((id) => ids.includes(id)) : []
      return [row.id, [...fromSaved, ...ids.filter((id) => !fromSaved.includes(id))]]
    })))
  }, [])

  const dragRef = useRef(null)          // { rowId, id } being dragged
  const didDragRef = useRef(false)      // suppress the click that follows a drop

  function orderedItems(row) {
    const ids = planOrder?.[row.id]
    if (!ids) return row.items
    const byId = new Map(row.items.map((item) => [item.id, item]))
    return ids.map((id) => byId.get(id)).filter(Boolean)
  }

  function moveCard(rowId, fromId, toId) {
    if (fromId === toId) return
    setPlanOrder((prev) => {
      const ids = [...(prev?.[rowId] || [])]
      const from = ids.indexOf(fromId)
      const to = ids.indexOf(toId)
      if (from < 0 || to < 0) return prev
      ids.splice(to, 0, ids.splice(from, 1)[0])
      const next = { ...prev, [rowId]: ids }
      try { window.localStorage.setItem(PLAN_ORDER_KEY, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }

  // Home is a surface, not a tab: it needs the Practice workspace selected AND
  // practiceSurface === "home", and only this component owns the second half.
  // Callers elsewhere dispatch GO_HOME_EVENT instead of clicking the Practice
  // tab, which is a different destination ("1", not "0").
  useEffect(() => {
    function onGoHome() {
      findWorkspaceTab("Practice")?.click()
      setWorkspace("practice")
      setPracticeSurface("home")
    }
    window.addEventListener(GO_HOME_EVENT, onGoHome)
    return () => window.removeEventListener(GO_HOME_EVENT, onGoHome)
  }, [])

  function openWorkspace(id) {
    if (id === "practice") {
      findWorkspaceTab("Practice")?.click()
      setWorkspace("practice")
      setPracticeSurface("home")
      return
    }

    findWorkspaceTab(WORKSPACE_LABELS[id])?.click()
    setWorkspace(id)
    setPracticeSurface("tools")
  }

  function openPracticeCenter(sectionLabel) {
    findWorkspaceTab("Practice")?.click()
    setWorkspace("practice")
    setPracticeSurface("tools")

    if (sectionLabel) {
      window.setTimeout(() => {
        const section = findSectionByText(sectionLabel)
        section?.scrollIntoView({ behavior: "smooth", block: "start" })
      }, 180)
    }
  }

  // Opens the Songbook drawer with the cursor already in its search box —
  // the drawer focuses its own search input as soon as it opens. Passing a
  // category also scrolls that section of the list to the top.
  function openSongbookSearch(category) {
    openPracticeCenter()
    window.setTimeout(() => {
      document.querySelector('[aria-label="Open Songbook"]')?.click()
      if (!category) return
      // Two things fight this scroll: the drawer slides in over ~280ms (so
      // scrollIntoView misbehaves through the animating translate — we drive
      // the scroll box directly instead), and the drawer focuses its search
      // input at 320ms, which yanks the same box back to the top. So run
      // after that, and re-assert once if focus still beat us.
      const scrollToCategory = () => {
        const target = document.querySelector(`[data-db-category="${category}"]`)
        if (!target) return false
        let scroller = target.parentElement
        while (scroller && scroller.scrollHeight <= scroller.clientHeight) scroller = scroller.parentElement
        if (!scroller) { target.scrollIntoView({ behavior: "smooth", block: "start" }); return true }
        const top = target.getBoundingClientRect().top
          - scroller.getBoundingClientRect().top
          + scroller.scrollTop
        scroller.scrollTo({ top, behavior: "smooth" })
        return true
      }
      let tries = 30
      const tick = () => {
        if (!scrollToCategory() && --tries > 0) { window.setTimeout(tick, 40); return }
        window.setTimeout(scrollToCategory, 260)
      }
      window.setTimeout(tick, 420)
    }, 180)
  }

  function runAction(action) {
    if (!action) return
    if (action.type === "workspace") {
      openWorkspace(action.value)
      return
    }
    if (action.type === "songbook") {
      openSongbookSearch(action.value)
      return
    }
    if (action.type === "section") {
      openPracticeCenter(action.value)
      return
    }
    // A collapsible power panel in the Practice tab, addressed by the
    // data-db-shortcut hook on its header.
    if (action.type === "practice-panel") {
      openPracticeCenter()
      window.setTimeout(() => {
        const header = document.querySelector(`[data-db-shortcut="${action.value}"]`)
        if (!header) return
        if (header.getAttribute("aria-expanded") === "false") header.click()
        header.scrollIntoView({ behavior: "smooth", block: "start" })
      }, 200)
      return
    }
    // A collapsible panel in the Create tab, addressed by its element id —
    // open it and scroll it into view rather than dropping the player at the
    // top of a long workspace.
    if (action.type === "create-section") {
      openWorkspace("create")
      window.setTimeout(() => {
        const section = document.getElementById(action.value)
        if (!section) return
        section.open = true
        section.scrollIntoView({ behavior: "smooth", block: "start" })
      }, 180)
      return
    }
    // A collapsible power panel in the BeatForge tab, addressed by the
    // data-db-shortcut hook on its header.
    if (action.type === "beatforge-panel") {
      openWorkspace("beatforge")
      window.setTimeout(() => {
        const header = document.querySelector(`[data-db-shortcut="${action.value}"]`)
        if (!header) return
        if (header.getAttribute("aria-expanded") === "false") header.click()
        header.scrollIntoView({ behavior: "smooth", block: "start" })
      }, 200)
      return
    }
    // A collapsible section in the BeatForge tab, addressed by its element id.
    if (action.type === "beatforge-section") {
      openWorkspace("beatforge")
      window.setTimeout(() => {
        const section = document.getElementById(action.value)
        if (!section) return
        section.open = true
        section.scrollIntoView({ behavior: "smooth", block: "start" })
      }, 180)
      return
    }
    // Starters used to be triggered by finding their button in the Practice
    // tab and clicking it; the strip lives here now, so ask the page for the
    // chart directly. Accepts an id or the display label, since saved
    // recent-activity entries hold the label.
    if (action.type === "starter") {
      openPracticeCenter()
      window.setTimeout(() => requestStarter(action.value), 180)
      return
    }
    // A reference guide, opened the same way its Core Curriculum card does.
    if (action.type === "reference") {
      window.open(action.value, "_blank", "noopener,noreferrer")
      return
    }

    openPracticeCenter()
    window.setTimeout(() => {
      findClickableByText(action.value)?.click()
    }, 180)
  }

  // "Practice this lick" — not just a jump to Line Lab (that's what the
  // empty-state's "Open Line Lab" button still does via runAction), but a
  // request to actually reload this exact line there. Line Lab only exists
  // in the DOM while BeatForge is the active workspace (page.js unmounts it
  // otherwise), so the resume event is dispatched after the same navigate
  // delay every other cross-tree "go there and act" call in this file uses
  // — by then it's mounted and its own listener (lastLine.js /
  // RESUME_LAST_LINE_EVENT) is registered.
  function resumeLastLine() {
    openWorkspace("beatforge")
    window.setTimeout(() => {
      const section = document.getElementById("beatforge-line-lab")
      if (section) {
        section.open = true
        section.scrollIntoView({ behavior: "smooth", block: "start" })
      }
      requestResumeLastLine()
    }, 220)
  }

  // "Most Popular" rail — loads one specific catalog song by id (see
  // LOAD_SONG_EVENT in songSource.js / the listener in page.js). Same
  // navigate-then-act delay as every other cross-tree action here.
  function openPopularSong(id) {
    openPracticeCenter()
    window.setTimeout(() => requestLoadSong(id), 180)
  }

  if (!homeOpen) {
    if (workspace !== "practice") return null
    // The full .db-pickup-return-home styling lives in the <style> block
    // below, which only mounts in the homeOpen branch — this early return
    // needs its own copy or the button (and its 1024px source image) render
    // completely unstyled, in normal document flow, at the bottom of the page.
    return (
      <>
        <style>{`
          .db-pickup-return-home {
            position: fixed; left: 18px; top: 18px; z-index: 9500;
            width: 44px; height: 44px; padding: 0; justify-content: center;
            border: 1px solid var(--db-panel-border, #d9d9e1);
            border-radius: 999px; background: var(--db-panel-bg, #fff); color: var(--db-text, #080b2e);
            display: flex; align-items: center; gap: 8px;
            box-shadow: 0 8px 22px rgba(0,0,0,.13); cursor: pointer; font-weight: 750;
          }
          .db-pickup-return-home-mark { width: 28px; height: 28px; object-fit: contain; display: block; }
        `}</style>
        <button
          type="button"
          className="db-pickup-return-home"
          onClick={() => setPracticeSurface("home")}
          title="Return to the Practice home page"
          aria-label="Return to the Practice home page"
        >
          <img src={BRAND_ICON} alt="" aria-hidden="true" className="db-pickup-return-home-mark" />
        </button>
      </>
    )
  }

  return (
    <div className="db-pickup-shell">
      <style>{`
        body.db-pickup-home-open { overflow: hidden !important; }

        .db-pickup-shell {
          /* Marquee palette — a warm-black jazz-club ground with a brass
             accent, replacing the earlier white/purple Coursera-style skin.
             Same structure and behavior throughout; colors and type only. */
          --pickup-ink: #0b0a10;
          --pickup-raised: #17131e;
          --pickup-raised-2: #1e1828;
          --pickup-line: #2c2536;
          --pickup-text: #f2ebdd;
          --pickup-muted: #a79eb5;
          --pickup-muted-dim: #726a83;
          --pickup-accent: #d7a24a;
          --pickup-accent-bright: #eec174;
          --pickup-teal: #5b9aa0;
          --pickup-teal-soft: rgba(91,154,160,.16);
          position: fixed;
          inset: 0;
          z-index: 10000;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background: var(--pickup-ink);
          color: var(--pickup-text);
          font-family: 'Work Sans', Arial, Helvetica, sans-serif;
        }

        .db-pickup-shell * { box-sizing: border-box; }
        .db-pickup-shell button { font: inherit; color: inherit; }

        .db-pickup-shell h1, .db-pickup-shell h2 {
          font-family: 'Big Shoulders Display', Arial, Helvetica, sans-serif;
          font-weight: 800;
        }
        .db-pickup-mono {
          font-family: 'IBM Plex Mono', ui-monospace, monospace;
        }

        /* ---------- top bar — search-first nav, replaces the old sidebar ---------- */
        .db-pickup-topbar {
          flex: 0 0 auto;
          display: flex;
          align-items: center;
          gap: 22px;
          padding: 12px 24px;
          border-bottom: 1px solid var(--pickup-line);
          background: var(--pickup-raised);
        }

        .db-pickup-logo {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 0 0 auto;
          border: 0;
          background: none;
          cursor: pointer;
          color: var(--pickup-accent);
          font-family: 'Big Shoulders Display', Arial, Helvetica, sans-serif;
          font-size: 19px;
          font-weight: 800;
          letter-spacing: -0.01em;
        }

        .db-pickup-logo > span:last-child > span { color: var(--pickup-text); }

        .db-pickup-logo-mark {
          width: 22px;
          height: 20px;
          position: relative;
          display: inline-block;
          transform: rotate(-8deg);
        }

        .db-pickup-logo-mark i {
          position: absolute;
          left: 1px;
          width: 18px;
          height: 3px;
          border-radius: 999px;
          background: currentColor;
        }

        .db-pickup-logo-mark i:nth-child(1) { top: 2px; }
        .db-pickup-logo-mark i:nth-child(2) { top: 8px; width: 14px; }
        .db-pickup-logo-mark i:nth-child(3) { top: 14px; width: 10px; }

        .db-pickup-search {
          flex: 1 1 auto;
          min-width: 0;
          max-width: 480px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 8px 12px;
          border: 1px solid var(--pickup-line);
          background: var(--pickup-ink);
          color: var(--pickup-muted);
          cursor: pointer;
          transition: border-color 140ms ease, background 140ms ease;
        }
        .db-pickup-search:hover { border-color: var(--pickup-accent); background: var(--pickup-raised-2); }
        .db-pickup-search svg { width: 16px; height: 16px; flex: 0 0 auto; color: var(--pickup-muted-dim); }
        .db-pickup-search span { flex: 1; text-align: left; font-size: 13.5px; }
        .db-pickup-search kbd {
          padding: 1px 6px; border: 1px solid var(--pickup-line); border-radius: 4px;
          font-size: 11px; color: var(--pickup-muted-dim);
        }

        .db-pickup-navpills {
          flex: 0 0 auto;
          display: flex;
          align-items: center;
          gap: 2px;
        }

        .db-pickup-nav-button {
          border: 0;
          border-bottom: 2px solid transparent;
          border-radius: 0;
          background: transparent;
          color: var(--pickup-muted);
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 8px 11px;
          text-align: left;
          cursor: pointer;
          font-size: 13.5px;
          font-weight: 600;
          white-space: nowrap;
          transition: background 140ms ease, color 140ms ease, border-color 140ms ease;
        }

        .db-pickup-nav-button:hover {
          color: var(--pickup-text);
          background: var(--pickup-raised-2);
        }

        .db-pickup-nav-button.is-active {
          color: var(--pickup-text);
          border-bottom-color: var(--pickup-accent);
          font-weight: 750;
        }

        .db-pickup-nav-button.is-active svg { color: var(--pickup-accent); }
        .db-pickup-nav-button svg { width: 17px; height: 17px; flex: 0 0 17px; }

        .db-pickup-topbar-actions { flex: 0 0 auto; display: flex; align-items: center; gap: 10px; }

        /* ---------- body: left rail (Most Popular) + main ---------- */
        .db-pickup-body {
          flex: 1 1 auto;
          min-height: 0;
          display: grid;
          grid-template-columns: 250px minmax(0, 1fr);
          overflow: hidden;
        }

        .db-pickup-rail {
          min-width: 0;
          height: 100%;
          padding: 20px 16px;
          border-right: 1px solid var(--pickup-line);
          background: var(--pickup-raised);
          overflow-y: auto;
        }

        .db-pickup-rail h3 {
          margin: 6px 0 0;
          font-family: 'Big Shoulders Display', Arial, Helvetica, sans-serif;
          font-weight: 800;
          font-size: 17px;
          color: var(--pickup-text);
        }
        .db-pickup-rail-sub { margin: 3px 0 0; color: var(--pickup-muted); font-size: 11.5px; }

        .db-pickup-popular-list { margin-top: 14px; display: grid; gap: 2px; }
        .db-pickup-popular-row {
          display: flex; align-items: center; gap: 10px;
          padding: 8px 6px; border: 0; background: none; color: inherit;
          text-align: left; cursor: pointer; width: 100%;
          transition: background 140ms ease;
        }
        .db-pickup-popular-row:hover { background: var(--pickup-raised-2); }
        .db-pickup-popular-rank {
          flex: 0 0 20px;
          font-family: 'IBM Plex Mono', ui-monospace, monospace;
          font-size: 12px; font-weight: 700; color: var(--pickup-accent);
        }
        .db-pickup-popular-copy { min-width: 0; }
        .db-pickup-popular-copy strong {
          display: block; font-size: 13px; color: var(--pickup-text);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .db-pickup-popular-copy span {
          display: block; margin-top: 2px; font-size: 11px; color: var(--pickup-muted-dim);
          font-family: 'IBM Plex Mono', ui-monospace, monospace;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .db-pickup-popular-empty {
          margin-top: 14px; padding: 12px; border: 1px dashed var(--pickup-line);
          color: var(--pickup-muted-dim); font-size: 12px; line-height: 1.5;
        }

        .db-pickup-rail-more {
          margin-top: 26px; padding-top: 16px; border-top: 1px solid var(--pickup-line);
          display: grid; gap: 2px;
        }
        .db-pickup-rail-more-link {
          display: flex; align-items: center; gap: 9px;
          padding: 7px 6px; border: 0; background: none; color: var(--pickup-muted);
          text-align: left; cursor: pointer; font-size: 13px; font-weight: 600;
          transition: color 140ms ease, background 140ms ease;
        }
        .db-pickup-rail-more-link:hover { color: var(--pickup-text); background: var(--pickup-raised-2); }
        .db-pickup-rail-more-link svg { width: 16px; height: 16px; flex: 0 0 16px; }

        .db-pickup-main {
          min-width: 0;
          height: 100%;
          overflow-y: auto;
          background: var(--pickup-ink);
        }

        .db-pickup-main-inner {
          width: 100%;
          min-width: 0;
          padding: 26px 32px 70px 40px;
        }

        /* Shortcuts button + build stamp + bell now live in the top bar's
           actions cluster (search-first nav replaced the old sidebar, and
           took the "Welcome back" header with it — the nav pills and search
           bar are the visible affordance now, not a text legend). */
        .db-pickup-shortcuts-btn {
          display: inline-flex; align-items: center; gap: 7px;
          border: 0; background: none; padding: 7px 9px; cursor: pointer;
          color: var(--pickup-muted); font-size: 13px; font-weight: 600;
        }
        .db-pickup-shortcuts-btn:hover { color: var(--pickup-accent-bright); }
        .db-pickup-shortcuts-btn kbd {
          padding: 1px 6px; border: 1px solid var(--pickup-line); border-radius: 4px;
          font-size: 11px; color: var(--pickup-muted-dim);
        }

        .db-pickup-bell {
          width: 42px;
          height: 42px;
          border: 0;
          border-radius: 50%;
          background: transparent;
          color: var(--pickup-muted);
          display: grid;
          place-items: center;
          cursor: pointer;
        }

        .db-pickup-bell:hover { background: var(--pickup-raised-2); color: var(--pickup-accent); }
        .db-pickup-bell svg { width: 24px; height: 24px; }

        .db-pickup-section { padding: 40px 0 0; }

        .db-pickup-section-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 18px;
        }

        .db-pickup-section-heading h2 {
          display: flex;
          align-items: center;
          gap: 4px;
          margin: 0;
          color: var(--pickup-text);
          font-size: 22px;
          letter-spacing: -0.01em;
        }

        .db-pickup-section-heading h2 svg { width: 18px; height: 18px; }
        .db-pickup-section-heading p { margin: 3px 0 0; color: var(--pickup-muted); font-size: 13px; }
        .db-pickup-eyebrow {
          font-family: 'IBM Plex Mono', ui-monospace, monospace;
          font-size: 11px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase;
          color: var(--pickup-accent);
        }

        /* The hero card ("right where you clicked off") is gone — it was
           saying the same thing "Jump back in" already says lower on the
           page. .db-pickup-hero-actions/play-btn/ghost-btn survive: they're
           shared with "Practice this lick" and the empty states below. */
        .db-pickup-hero-actions { margin-top: 20px; display: flex; flex-wrap: wrap; gap: 10px; }
        .db-pickup-play-btn {
          display: inline-flex; align-items: center; gap: 9px;
          padding: 11px 18px; border: 0; background: var(--pickup-accent); color: #1b1306;
          font-weight: 700; font-size: 14px; cursor: pointer;
          transition: background 140ms ease, transform 140ms ease;
        }
        .db-pickup-play-btn:hover { background: var(--pickup-accent-bright); transform: translateY(-1px); }
        .db-pickup-play-btn svg { width: 13px; height: 13px; }
        .db-pickup-ghost-btn {
          display: inline-flex; align-items: center; gap: 9px;
          padding: 10px 16px; border: 1px solid var(--pickup-line); background: transparent; color: var(--pickup-text);
          font-weight: 600; font-size: 13.5px; cursor: pointer;
          transition: border-color 140ms ease, color 140ms ease;
        }
        .db-pickup-ghost-btn:hover { border-color: var(--pickup-accent); color: var(--pickup-accent-bright); }
        .db-pickup-ghost-btn kbd {
          padding: 1px 6px; border: 1px solid var(--pickup-line); border-radius: 4px; font-size: 11px; color: var(--pickup-muted);
        }

        .db-pickup-starter-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .db-pickup-starter-chip {
          padding: 9px 15px;
          border-radius: 999px;
          border: 1px solid var(--pickup-line);
          background: var(--pickup-raised);
          color: var(--pickup-text);
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: border-color 140ms ease, transform 140ms ease, box-shadow 140ms ease;
        }

        .db-pickup-starter-chip:hover {
          border-color: var(--pickup-accent);
          color: var(--pickup-accent-bright);
          transform: translateY(-1px);
        }

        .db-pickup-text-button {
          border: 0;
          background: transparent;
          color: var(--pickup-accent);
          cursor: pointer;
          font-size: 13px;
          font-weight: 750;
        }

        .db-pickup-progress-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(260px, 1fr));
          gap: 16px;
        }

        .db-pickup-progress-card {
          min-width: 0;
          height: 148px;
          padding: 8px;
          border: 1px solid var(--pickup-line);
          background: var(--pickup-raised);
          display: grid;
          grid-template-columns: 132px minmax(0, 1fr);
          gap: 15px;
          color: inherit;
          text-align: left;
          cursor: pointer;
          overflow: hidden;
          transition: transform 160ms ease, border-color 160ms ease;
        }

        .db-pickup-progress-card:hover {
          transform: translateY(-2px);
          border-color: var(--pickup-accent);
        }

        .db-pickup-progress-art { border-radius: 4px; background: var(--pickup-ink); }

        .db-pickup-progress-art img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .db-pickup-progress-copy {
          min-width: 0;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 6px 8px 6px 0;
        }

        .db-pickup-progress-copy small {
          font-family: 'IBM Plex Mono', ui-monospace, monospace;
          color: var(--pickup-accent);
          font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase;
        }

        .db-pickup-progress-copy strong {
          margin-top: 8px;
          color: var(--pickup-text);
          font-size: clamp(16px, 1.15vw, 20px);
          line-height: 1.2;
          letter-spacing: -0.01em;
        }

        .db-pickup-progress-copy span {
          margin-top: 14px;
          color: var(--pickup-muted);
          font-size: 13px;
        }

        .db-pickup-plan-grid {
          display: grid;
          /* auto-fit rather than a fixed 4, so the row reflows as cards are
             added or removed instead of overflowing. */
          grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
          gap: 16px;
        }

        .db-pickup-plan-grid + .db-pickup-plan-grid { margin-top: 16px; }
        .db-pickup-plan-card { cursor: grab; }
        .db-pickup-plan-card:active { cursor: grabbing; }

        .db-pickup-plan-card {
          position: relative;
          min-width: 0;
          height: auto;
          aspect-ratio: 16 / 9;
          padding: 0;
          border: 0;
          overflow: hidden;
          color: #fff;
          text-align: left;
          cursor: pointer;
          background: #04061c;
          clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px);
          transition: transform 160ms ease, box-shadow 160ms ease;
        }

        .db-pickup-plan-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 13px 30px rgba(0, 0, 0, .45);
        }

        .db-pickup-plan-photo {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
          -webkit-user-drag: none;
          user-select: none;
        }
        .db-pickup-plan-stamp {
          position: absolute; top: 8px; right: 8px; z-index: 2;
          width: 24px; height: 24px; display: grid; place-items: center;
          background: rgba(11,10,16,.72); border: 1px solid var(--pickup-accent);
          color: var(--pickup-accent-bright);
          font-family: 'IBM Plex Mono', ui-monospace, monospace; font-weight: 700; font-size: 12px;
          backdrop-filter: blur(2px);
        }

        .db-pickup-core-strip {
          display: flex;
          gap: 14px;
          overflow-x: auto;
          padding-bottom: 8px;
        }

        .db-pickup-core-card {
          display: block;
          flex: 0 0 auto;
          width: 240px;
          min-height: 150px;
          padding: 18px;
          border: 1px solid var(--pickup-line);
          background: var(--pickup-raised);
          color: inherit;
          text-align: left;
          text-decoration: none;
          cursor: pointer;
          transition: border-color 140ms ease, transform 140ms ease;
        }

        .db-pickup-core-card:hover {
          border-color: var(--pickup-accent);
          transform: translateY(-2px);
        }

        .db-pickup-core-card small {
          font-family: 'IBM Plex Mono', ui-monospace, monospace;
          color: var(--pickup-accent); font-weight: 700; letter-spacing: .08em;
        }
        .db-pickup-core-card strong { display: block; margin-top: 18px; font-size: 17px; color: var(--pickup-text); }
        .db-pickup-core-card p { margin: 8px 0 0; color: var(--pickup-muted); font-size: 13px; line-height: 1.45; }

        .db-pickup-recent-list {
          display: grid;
          gap: 1px;
          background: var(--pickup-line);
          border: 1px solid var(--pickup-line);
        }

        .db-pickup-recent-row {
          display: grid;
          grid-template-columns: auto auto 1fr auto;
          gap: 14px;
          align-items: center;
          padding: 13px 16px;
          background: var(--pickup-raised);
          border: 0;
          color: inherit;
          text-align: left;
          cursor: pointer;
          width: 100%;
          transition: background 140ms ease;
        }
        .db-pickup-recent-row:hover { background: var(--pickup-raised-2); }
        .db-pickup-recent-row.is-empty { cursor: default; color: var(--pickup-muted-dim); }
        .db-pickup-recent-row.is-empty:hover { background: var(--pickup-raised); }

        .db-pickup-recent-icon {
          flex: 0 0 34px; width: 34px; height: 34px;
          border: 1px solid var(--pickup-line); background: var(--pickup-ink); color: var(--pickup-accent);
          display: grid; place-items: center;
        }
        .db-pickup-recent-icon svg { width: 17px; height: 17px; }

        .db-pickup-recent-kind {
          font-family: 'IBM Plex Mono', ui-monospace, monospace;
          font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase;
          color: var(--pickup-muted-dim);
          border: 1px solid var(--pickup-line);
          padding: 2px 7px;
          white-space: nowrap;
        }

        .db-pickup-recent-copy { min-width: 0; }
        .db-pickup-recent-copy strong { display: block; font-size: 14px; color: var(--pickup-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .db-pickup-recent-copy span { display: block; margin-top: 3px; color: var(--pickup-muted); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        .db-pickup-recent-time {
          font-family: 'IBM Plex Mono', ui-monospace, monospace;
          font-size: 11.5px; color: var(--pickup-muted-dim); white-space: nowrap;
        }

        @media (max-width: 1180px) {
          .db-pickup-progress-grid { grid-template-columns: 1fr; }
          .db-pickup-progress-card { height: 132px; grid-template-columns: 116px minmax(0, 1fr); }
          .db-pickup-plan-grid { grid-template-columns: repeat(2, minmax(220px, 1fr)); }
        }

        /* ---------- practice this lick ---------- */
        .db-pickup-lick-panel {
          display: grid;
          grid-template-columns: 1fr 1.1fr;
          gap: 26px;
          align-items: center;
          padding: 22px;
          border: 1px solid var(--pickup-line);
          background: var(--pickup-raised);
        }
        @media (max-width: 860px) { .db-pickup-lick-panel { grid-template-columns: 1fr; } }
        .db-pickup-lick-copy strong { display: block; margin-top: 8px; font-size: 20px; color: var(--pickup-text); font-family: 'Big Shoulders Display', sans-serif; }
        .db-pickup-lick-copy p { margin: 8px 0 0; color: var(--pickup-muted); font-size: 13px; line-height: 1.5; max-width: 42ch; }
        .db-pickup-lick-tab { background: var(--pickup-ink); border: 1px solid var(--pickup-line); padding: 10px 6px; }
        .db-pickup-lick-svg { width: 100%; height: auto; display: block; }
        .db-pickup-lick-stringlabel { font: 600 9px 'IBM Plex Mono', monospace; fill: var(--pickup-muted-dim); }
        .db-pickup-lick-line { stroke: var(--pickup-line); stroke-width: 1; }
        .db-pickup-lick-path { fill: none; stroke: var(--pickup-muted-dim); stroke-width: 1.3; opacity: .6; }
        .db-pickup-lick-note { fill: var(--pickup-ink); stroke: var(--pickup-accent); stroke-width: 1.2; }
        .db-pickup-lick-note.is-last { fill: var(--pickup-accent); stroke: var(--pickup-accent-bright); }
        .db-pickup-lick-fret { font: 700 9px 'IBM Plex Mono', monospace; fill: var(--pickup-accent-bright); text-anchor: middle; }
        .db-pickup-lick-fret.is-last { fill: #1b1306; }
        .db-pickup-lick-more { font: 600 9px 'IBM Plex Mono', monospace; fill: var(--pickup-muted-dim); }
        .db-pickup-lick-empty {
          padding: 22px; border: 1px dashed var(--pickup-line); background: var(--pickup-raised);
          color: var(--pickup-muted); font-size: 13px;
          display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap;
        }

        .db-pickup-return-home {
          position: fixed;
          left: 18px;
          top: 18px;
          z-index: 9500;
          width: 44px;
          height: 44px;
          padding: 0;
          justify-content: center;
          border: 1px solid var(--db-panel-border, #d9d9e1);
          border-radius: 999px;
          background: var(--db-panel-bg, #fff);
          color: var(--db-text, #080b2e);
          display: flex;
          align-items: center;
          gap: 8px;
          box-shadow: 0 8px 22px rgba(0,0,0,.13);
          cursor: pointer;
          font-weight: 750;
        }

        .db-pickup-return-home svg { width: 18px; height: 18px; color: var(--db-accent, #4c20e8); }
        .db-pickup-return-home-mark { width: 28px; height: 28px; object-fit: contain; display: block; }

        /* Nav lives in the top bar now, not a sidebar column, so the rail
           (Most Popular) is the only thing that needs to give up its own
           column on a narrow screen — it stacks above main instead. */
        @media (max-width: 980px) {
          .db-pickup-body { display: block; overflow-y: auto; }
          .db-pickup-rail { height: auto; border-right: 0; border-bottom: 1px solid var(--pickup-line); }
          .db-pickup-main { height: auto; overflow-y: visible; }
        }

        /* Logo + search + 5 pills + actions don't fit one row below ~1150px
           — wrap well before that actually starts clipping/overlapping,
           not exactly at the pixel it first breaks. */
        @media (max-width: 1150px) {
          .db-pickup-topbar { flex-wrap: wrap; row-gap: 10px; }
          .db-pickup-search { order: 3; flex-basis: 100%; max-width: none; }
          .db-pickup-navpills { order: 4; flex-basis: 100%; overflow-x: auto; }
        }

        @media (max-width: 720px) {
          .db-pickup-main-inner { padding: 20px 16px 56px; }
          .db-pickup-section { padding-top: 30px; }
        }

        @media (max-width: 540px) {
          .db-pickup-section-heading { align-items: end; }
          .db-pickup-progress-card { height: 122px; grid-template-columns: 102px minmax(0, 1fr); gap: 12px; }
          .db-pickup-progress-copy strong { margin-top: 5px; font-size: 16px; }
          .db-pickup-progress-copy span { margin-top: 9px; }
          .db-pickup-plan-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <header className="db-pickup-topbar">
        <DukeMark onClick={() => openWorkspace("practice")} />

        {/* Search-first nav: this is the primary way into a song now, not a
            sidebar link — front and center, "/" from anywhere opens the same
            drawer. Workspaces still get their own pills alongside it; a
            search box can't replace "take me to Gig mode". */}
        <button
          type="button"
          className="db-pickup-search"
          onClick={() => window.dispatchEvent(new CustomEvent(OPEN_LIBRARY_EVENT))}
        >
          <Icon name="search" />
          <span>Jump to a song, a system, anywhere…</span>
          <kbd>/</kbd>
        </button>

        <nav className="db-pickup-navpills" aria-label="DukeBox workspaces">
          <button type="button" className="db-pickup-nav-button" onClick={() => openPracticeCenter()}>
            <Icon name="practice" /><span>Practice</span>
          </button>
          <button type="button" className="db-pickup-nav-button" onClick={() => openWorkspace("create")}>
            <Icon name="create" /><span>Create</span>
          </button>
          <button type="button" className="db-pickup-nav-button" onClick={() => openWorkspace("beatforge")}>
            <Icon name="beatforge" /><span>BeatForge</span>
          </button>
          <button type="button" className="db-pickup-nav-button" onClick={() => openWorkspace("gig")}>
            <Icon name="gig" /><span>Gig</span>
          </button>
          <button type="button" className="db-pickup-nav-button" onClick={() => openWorkspace("reference")}>
            <Icon name="reference" /><span>Reference</span>
          </button>
          <button type="button" className="db-pickup-nav-button" onClick={() => openWorkspace("tonal")}>
            <Icon name="tonal" /><span>Tonal</span>
          </button>
        </nav>

        <div className="db-pickup-topbar-actions">
          <BuildStamp />
          {/* Reuses KeyboardShortcuts.jsx's own click-delegate (it matches
              any button titled "Keyboard shortcuts") — nothing new to wire. */}
          <button type="button" className="db-pickup-shortcuts-btn" title="Keyboard shortcuts (?)">
            <kbd>?</kbd> Shortcuts
          </button>
          <button type="button" className="db-pickup-bell" aria-label="Notifications" title="Notifications">
            <Icon name="bell" />
          </button>
        </div>
      </header>

      <div className="db-pickup-body">
        <aside className="db-pickup-rail">
          <div className="db-pickup-eyebrow">Most popular</div>
          <h3>Your top tunes</h3>
          <p className="db-pickup-rail-sub">Ranked by how often you&apos;ve loaded them.</p>

          {mostPlayed.length ? (
            <div className="db-pickup-popular-list">
              {mostPlayed.map((song, i) => (
                <button
                  type="button"
                  key={song.id}
                  className="db-pickup-popular-row"
                  onClick={() => openPopularSong(song.id)}
                >
                  <span className="db-pickup-popular-rank">{i + 1}</span>
                  <span className="db-pickup-popular-copy">
                    <strong title={song.title}>{song.title}</strong>
                    <span>{song.subtitle ? `${song.subtitle} · ` : ""}{song.count} {song.count === 1 ? "play" : "plays"}</span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="db-pickup-popular-empty">Load a few tunes and your most-played will show up here.</div>
          )}

          <nav className="db-pickup-rail-more" aria-label="More">
            <button type="button" className="db-pickup-rail-more-link" onClick={() => runAction({ type: "beatforge-section", value: "beatforge-line-lab" })}>
              <Icon name="lick" /><span>Line Lab</span>
            </button>
            <button type="button" className="db-pickup-rail-more-link" onClick={() => openPracticeCenter("MELODY PATHS")}>
              <Icon name="practice" /><span>Melody paths</span>
            </button>
            <button type="button" className="db-pickup-rail-more-link" onClick={() => runAction({ type: "beatforge-section", value: "beatforge-licktionary" })}>
              <Icon name="songbook" /><span>Licktionary</span>
            </button>
            <button type="button" className="db-pickup-rail-more-link" onClick={() => openWorkspace("reference")}>
              <Icon name="help" /><span>Support</span>
            </button>
          </nav>
        </aside>

      <main className="db-pickup-main">
        <div className="db-pickup-main-inner">

          {/* Your learning plan — the photo cards — leads the page now. It
              was buried between the starter chips and "Jump back in";
              this is the best-looking, most-loved part of Home, so it
              shouldn't need scrolling to reach. The old hero card here said
              the same thing "Jump back in" already says lower down, just
              with worse odds of being right about which one thing you
              wanted — deleted rather than kept as a redundant first stop. */}
          <section className="db-pickup-section" style={{ paddingTop: 0 }}>
            <div className="db-pickup-section-heading">
              <div>
                <div className="db-pickup-eyebrow">Your set list</div>
                <h2>Your learning plan <Icon name="chevron" /></h2>
                <p>Systems on top, tunes underneath — drag any card to reorder its row.</p>
              </div>
            </div>

            {PLAN_ROWS.map((row) => (
              <div className="db-pickup-plan-grid" key={row.id} aria-label={`${row.label} cards`}>
                {orderedItems(row).map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className="db-pickup-plan-card"
                    draggable
                    onDragStart={(event) => {
                      dragRef.current = { rowId: row.id, id: item.id }
                      didDragRef.current = false
                      event.dataTransfer.effectAllowed = "move"
                      // Firefox refuses to start a drag without payload.
                      event.dataTransfer.setData("text/plain", item.id)
                    }}
                    onDragOver={(event) => {
                      if (dragRef.current?.rowId !== row.id) return
                      event.preventDefault()
                      event.dataTransfer.dropEffect = "move"
                    }}
                    onDrop={(event) => {
                      const drag = dragRef.current
                      if (drag?.rowId !== row.id) return
                      event.preventDefault()
                      didDragRef.current = true
                      moveCard(row.id, drag.id, item.id)
                      dragRef.current = null
                    }}
                    onDragEnd={() => { dragRef.current = null }}
                    onClick={() => {
                      // A drop fires a click right after; that shouldn't launch.
                      if (didDragRef.current) { didDragRef.current = false; return }
                      runAction(item.action)
                    }}
                    // The artwork already carries the badge and title, so the
                    // card has no visible text of its own — this is what a
                    // screen reader announces instead.
                    aria-label={`${item.title} — ${item.subtitle}`}
                  >
                    <img className="db-pickup-plan-photo" src={item.image} alt="" />
                    {item.shortcut && <span className="db-pickup-plan-stamp db-pickup-mono">{item.shortcut}</span>}
                  </button>
                ))}
              </div>
            ))}
          </section>

          <section className="db-pickup-section">
            <div className="db-pickup-section-heading">
              <div>
                <div className="db-pickup-eyebrow">Get started</div>
              </div>
              <button type="button" className="db-pickup-text-button" onClick={() => openPracticeCenter()}>Open practice center</button>
            </div>

            <div className="db-pickup-progress-grid">
              {GET_STARTED.map((item) => (
                <button type="button" key={item.title} className="db-pickup-progress-card" onClick={() => runAction(item.action)}>
                  <div className="db-pickup-progress-art">
                    <img src={item.image} alt="" />
                  </div>
                  <div className="db-pickup-progress-copy">
                    <small>{item.eyebrow}</small>
                    <strong>{item.title}</strong>
                    <span>{item.subtitle}</span>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="db-pickup-section">
            <div className="db-pickup-section-heading">
              <div>
                <div className="db-pickup-eyebrow">Start practicing</div>
                <h2>Starter charts</h2>
                <p>A fully loaded scenario — chart, scale/system, and slow tempo — straight into Focus after a 4-beat count-in.</p>
              </div>
            </div>

            <div className="db-pickup-starter-row">
              {STARTER_STRIP.map(({ id, label }) => (
                <button
                  type="button"
                  key={id}
                  className="db-pickup-starter-chip"
                  onClick={() => runAction({ type: "starter", value: id })}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          <section className="db-pickup-section">
            <div className="db-pickup-section-heading">
              <div>
                <div className="db-pickup-eyebrow">Still warm · last 5</div>
                <h2>Jump back in</h2>
                <p>The last things you were working on.</p>
              </div>
            </div>

            <div className="db-pickup-recent-list">
              {Array.from({ length: 5 }, (_, i) => recent[i]).map((item, i) => (
                item ? (
                  <button type="button" key={item.label + item.at} className="db-pickup-recent-row" onClick={() => runAction(item.action)}>
                    <span className="db-pickup-recent-icon"><Icon name={recentIconName(item)} /></span>
                    <span className="db-pickup-recent-kind">{entryKind(item)}</span>
                    <span className="db-pickup-recent-copy">
                      <strong title={item.label}>{item.label}</strong>
                      <span>{item.subtitle}{item.subtitle ? " · " : ""}{timeAgo(item.at)}</span>
                    </span>
                    <span className="db-pickup-recent-time">{timeAgo(item.at)}</span>
                  </button>
                ) : (
                  <div key={`empty-${i}`} className="db-pickup-recent-row is-empty">
                    <span className="db-pickup-recent-icon" style={{ borderStyle: "dashed", color: "var(--pickup-muted-dim)" }}><Icon name="practice" /></span>
                    <span className="db-pickup-recent-kind">—</span>
                    <span className="db-pickup-recent-copy">
                      <strong style={{ color: "var(--pickup-muted-dim)", fontWeight: 600 }}>Not visited yet</strong>
                      <span>Start practicing to fill this in</span>
                    </span>
                    <span className="db-pickup-recent-time"> </span>
                  </div>
                )
              ))}
            </div>
          </section>

          <section className="db-pickup-section">
            <div className="db-pickup-section-heading">
              <div>
                <div className="db-pickup-eyebrow">From Line Lab</div>
                <h2>Practice this lick</h2>
                <p>The most recent line you built — ready to drop back into Line Lab at a glance.</p>
              </div>
            </div>

            {lastLine ? (
              <div className="db-pickup-lick-panel">
                <div className="db-pickup-lick-copy">
                  {lastLine.context && <div className="db-pickup-eyebrow">{lastLine.context}{lastLine.keyRoot ? ` · ${lastLine.keyRoot}` : ""}</div>}
                  <strong>{lastLine.label}</strong>
                  <p>Built {timeAgo(lastLine.at)}. Resumes exactly as you left it — hear it, transpose it, or send it to the fretboard.</p>
                  <div className="db-pickup-hero-actions">
                    <button
                      type="button"
                      className="db-pickup-play-btn"
                      onClick={resumeLastLine}
                    >
                      <Icon name="play" /> Practice this lick
                    </button>
                  </div>
                </div>
                <div className="db-pickup-lick-tab">
                  <LickTabStrip line={lastLine.line} />
                </div>
              </div>
            ) : (
              <div className="db-pickup-lick-empty">
                <span>Nothing here yet — build a line in Line Lab and it&apos;ll show up here.</span>
                <button type="button" className="db-pickup-ghost-btn" onClick={() => runAction({ type: "beatforge-section", value: "beatforge-line-lab" })}>
                  Open Line Lab
                </button>
              </div>
            )}
          </section>

          <section className="db-pickup-section">
            <div className="db-pickup-section-heading">
              <div>
                <div className="db-pickup-eyebrow">Core curriculum</div>
                <h2>Reference guides <Icon name="chevron" /></h2>
                <p>The interactive reference guides, straight from the Reference tab.</p>
              </div>
            </div>

            <div className="db-pickup-core-strip">
              {CORE_CURRICULUM.map((item) => (
                <a
                  key={item.title}
                  className="db-pickup-core-card"
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => logActivity({
                    label: item.title,
                    subtitle: "Reference guide",
                    art: "reference",
                    action: { type: "reference", value: item.href },
                  })}
                >
                  <small>{item.number}</small>
                  <strong>{item.title}</strong>
                  <p>{item.copy}</p>
                </a>
              ))}
            </div>
          </section>
        </div>
      </main>
      </div>
    </div>
  )
}
