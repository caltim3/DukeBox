"use client"

import { useEffect, useRef, useState } from "react"
import { GUIDES } from "./ReferenceGuides"
import { getRecentActivity } from "@/lib/recentActivity"
import { STARTER_STRIP, requestStarter } from "@/lib/music/starters"
import { GO_HOME_EVENT } from "@/lib/homeNav"
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

// Replaces the old "In progress" row. Those completion bars didn't track
// anything real, so rather than fake progress this is three ways to start —
// each backed by the app's actual practice/create/gig entry points.
const GET_STARTED = [
  {
    eyebrow: "Practice",
    title: "Practice a Song",
    subtitle: "Open the songbook and start playing",
    image: "/practice.png",
    action: { type: "songbook" },
  },
  {
    eyebrow: "Compose",
    title: "Write a Song",
    subtitle: "Build a chart, generate changes, or start from scratch",
    image: "/compose.png",
    action: { type: "workspace", value: "create" },
  },
  {
    eyebrow: "Perform",
    title: "Play a Gig",
    subtitle: "Stage charts and setlists",
    image: "/gig.png",
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
  if (entry.action?.type === "workspace") return entry.action.value || "practice"
  if (entry.action?.type === "songbook") return "songbook"
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
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  )
}

function DukeMark() {
  return (
    <div className="db-pickup-logo" aria-label="DukeBox">
      <span className="db-pickup-logo-mark" aria-hidden="true">
        <i /><i /><i />
      </span>
      <span>duke<span>box</span></span>
    </div>
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

  // "Jump back in" reads whatever page.js has logged to localStorage.
  // Re-read every time the home screen is about to show, since it's a plain
  // module (not shared React state) written from the real action sites.
  // This has to be an effect, not a render-phase adjustment: localStorage
  // isn't available on the server, and reading it during render would make
  // the first client paint (used for hydration) disagree with the server
  // HTML — exactly the "Hydrating from localStorage has to happen after
  // mount" reasoning planOrder documents below, which recent didn't
  // previously follow.
  const [recent, setRecent] = useState([])
  useEffect(() => {
    if (homeOpen) setRecent(getRecentActivity())
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

    openPracticeCenter()
    window.setTimeout(() => {
      findClickableByText(action.value)?.click()
    }, 180)
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
          --pickup-purple: #4c20e8;
          --pickup-purple-dark: #2c0ca5;
          --pickup-navy: #070b31;
          --pickup-muted: #676a79;
          --pickup-line: #e7e7ed;
          --pickup-panel: #f7f7fb;
          position: fixed;
          inset: 0;
          z-index: 10000;
          display: grid;
          grid-template-columns: 230px minmax(0, 1fr);
          overflow: hidden;
          background: #ffffff;
          color: var(--pickup-navy);
          font-family: Arial, Helvetica, sans-serif;
        }

        .db-pickup-shell * { box-sizing: border-box; }
        .db-pickup-shell button { font: inherit; }

        .db-pickup-sidebar {
          min-width: 0;
          height: 100vh;
          padding: 20px 14px 16px;
          border-right: 1px solid var(--pickup-line);
          background: #ffffff;
          display: flex;
          flex-direction: column;
          overflow-y: auto;
        }

        .db-pickup-logo {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 7px;
          color: var(--pickup-purple);
          font-size: 18px;
          font-weight: 800;
          letter-spacing: -0.04em;
        }

        .db-pickup-logo > span:last-child > span { color: var(--pickup-navy); }

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

        .db-pickup-instrument {
          margin: 22px 5px 20px;
          padding: 8px 5px;
          color: var(--pickup-navy);
          font-size: 14px;
          font-weight: 600;
        }

        .db-pickup-nav,
        .db-pickup-nav-secondary {
          display: grid;
          gap: 4px;
        }

        .db-pickup-nav-secondary {
          margin-top: 18px;
          padding-top: 18px;
          border-top: 1px solid var(--pickup-line);
        }

        .db-pickup-nav-spacer { flex: 1; min-height: 28px; }

        .db-pickup-nav-button {
          width: 100%;
          min-height: 42px;
          border: 0;
          border-radius: 10px;
          background: transparent;
          color: #6a6d7a;
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 8px 10px;
          text-align: left;
          cursor: pointer;
          font-size: 15px;
          font-weight: 600;
          transition: background 140ms ease, color 140ms ease, transform 140ms ease;
        }

        .db-pickup-nav-button:hover {
          color: var(--pickup-navy);
          background: #f4f3fa;
          transform: translateX(1px);
        }

        .db-pickup-nav-button.is-active {
          color: var(--pickup-navy);
          background: #f0eff5;
          font-weight: 750;
        }

        .db-pickup-nav-button.is-active svg { color: var(--pickup-purple); }
        .db-pickup-nav-button svg { width: 22px; height: 22px; flex: 0 0 22px; }

        .db-pickup-main {
          min-width: 0;
          height: 100vh;
          overflow-y: auto;
          background: #fff;
        }

        .db-pickup-main-inner {
          width: 100%;
          min-width: 0;
          padding: 50px 32px 70px 40px;
        }

        .db-pickup-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding-bottom: 42px;
          border-bottom: 1px solid var(--pickup-line);
        }

        .db-pickup-header h1 {
          margin: 0;
          color: var(--pickup-navy);
          font-size: clamp(28px, 2.4vw, 38px);
          line-height: 1;
          letter-spacing: -0.045em;
        }

        .db-pickup-header h1 span { color: var(--pickup-purple); }

        /* Build stamp + bell, top right. The stamp moved here from the
           Practice header — provenance belongs on the screen you land on. */
        .db-pickup-header-right {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-shrink: 0;
        }

        .db-pickup-bell {
          width: 42px;
          height: 42px;
          border: 0;
          border-radius: 50%;
          background: transparent;
          color: #6f7280;
          display: grid;
          place-items: center;
          cursor: pointer;
        }

        .db-pickup-bell:hover { background: #f3f2f8; color: var(--pickup-purple); }
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
          color: var(--pickup-navy);
          font-size: 21px;
          letter-spacing: -0.025em;
        }

        .db-pickup-section-heading h2 svg { width: 18px; height: 18px; }
        .db-pickup-section-heading p { margin: 3px 0 0; color: var(--pickup-muted); font-size: 13px; }

        .db-pickup-starter-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .db-pickup-starter-chip {
          padding: 9px 15px;
          border-radius: 999px;
          border: 1px solid var(--pickup-line);
          background: #ffffff;
          color: var(--pickup-navy);
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: border-color 140ms ease, transform 140ms ease, box-shadow 140ms ease;
        }

        .db-pickup-starter-chip:hover {
          border-color: var(--pickup-purple);
          color: var(--pickup-purple);
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(17, 12, 70, 0.09);
        }

        .db-pickup-text-button {
          border: 0;
          background: transparent;
          color: var(--pickup-purple);
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
          border: 0;
          border-radius: 10px;
          background: var(--pickup-panel);
          display: grid;
          grid-template-columns: 132px minmax(0, 1fr);
          gap: 15px;
          color: inherit;
          text-align: left;
          cursor: pointer;
          overflow: hidden;
          transition: transform 160ms ease, box-shadow 160ms ease;
        }

        .db-pickup-progress-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 28px rgba(17, 12, 70, 0.10);
        }

        .db-pickup-progress-art,

        .db-pickup-progress-art { border-radius: 6px; background: #0b1220; }

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
          color: #4f5160;
          font-size: 13px;
        }

        .db-pickup-progress-copy strong {
          margin-top: 8px;
          color: var(--pickup-navy);
          font-size: clamp(16px, 1.15vw, 20px);
          line-height: 1.2;
          letter-spacing: -0.025em;
        }

        .db-pickup-progress-copy span {
          margin-top: 14px;
          color: #5c5f6d;
          font-size: 13px;
        }

        .db-pickup-progress-track {
          height: 5px;
          margin-top: 9px;
          border-radius: 999px;
          background: #e2e2e9;
          overflow: hidden;
        }

        .db-pickup-progress-track i {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: var(--pickup-purple);
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
          height: 210px;
          padding: 0;
          border: 0;
          border-radius: 8px;
          overflow: hidden;
          color: #fff;
          text-align: left;
          cursor: pointer;
          background: #222;
          transition: transform 160ms ease, box-shadow 160ms ease;
        }

        .db-pickup-plan-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 13px 30px rgba(17, 12, 70, 0.16);
        }
        .db-pickup-plan-card::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, rgba(4,6,28,.05), rgba(4,6,28,.08) 38%, rgba(4,6,28,.92));
        }

        .db-pickup-core-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(220px, 1fr));
          gap: 16px;
          padding-bottom: 50px;
        }

        .db-pickup-core-card {
          display: block;
          min-height: 155px;
          padding: 20px;
          border: 1px solid var(--pickup-line);
          border-radius: 10px;
          background: #fff;
          color: inherit;
          text-align: left;
          text-decoration: none;
          cursor: pointer;
          transition: border-color 140ms ease, transform 140ms ease, box-shadow 140ms ease;
        }

        .db-pickup-core-card:hover {
          border-color: rgba(76,32,232,.38);
          transform: translateY(-2px);
          box-shadow: 0 10px 24px rgba(17,12,70,.08);
        }

        .db-pickup-core-card small { color: var(--pickup-purple); font-weight: 800; letter-spacing: .08em; }
        .db-pickup-core-card strong { display: block; margin-top: 20px; font-size: 19px; }
        .db-pickup-core-card p { margin: 8px 0 0; color: var(--pickup-muted); font-size: 13px; line-height: 1.45; }

        .db-pickup-recent-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(180px, 1fr));
          gap: 14px;
        }

        .db-pickup-recent-card {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
          padding: 14px;
          border: 1px solid var(--pickup-line);
          border-radius: 10px;
          background: #fff;
          color: inherit;
          text-align: left;
          cursor: pointer;
          transition: border-color 140ms ease, transform 140ms ease, box-shadow 140ms ease;
        }

        .db-pickup-recent-card:hover {
          border-color: rgba(76,32,232,.38);
          transform: translateY(-2px);
          box-shadow: 0 10px 24px rgba(17,12,70,.08);
        }

        .db-pickup-recent-card.is-empty {
          cursor: default;
          color: var(--pickup-muted);
          border-style: dashed;
        }
        .db-pickup-recent-card.is-empty:hover { transform: none; box-shadow: none; border-color: var(--pickup-line); }

        .db-pickup-recent-icon {
          flex: 0 0 38px;
          width: 38px;
          height: 38px;
          border-radius: 9px;
          background: #f0eff5;
          color: var(--pickup-purple);
          display: grid;
          place-items: center;
        }
        .db-pickup-recent-icon svg { width: 19px; height: 19px; }

        .db-pickup-recent-copy { min-width: 0; }
        .db-pickup-recent-copy strong { display: block; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .db-pickup-recent-copy span { display: block; margin-top: 3px; color: var(--pickup-muted); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        @media (max-width: 1180px) {
          .db-pickup-recent-grid { grid-template-columns: repeat(2, minmax(180px, 1fr)); }
        }
        @media (max-width: 540px) {
          .db-pickup-recent-grid { grid-template-columns: 1fr; }
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

        @media (max-width: 1180px) {
          .db-pickup-progress-grid { grid-template-columns: 1fr; }
          .db-pickup-progress-card { height: 132px; grid-template-columns: 116px minmax(0, 1fr); }
          .db-pickup-plan-grid { grid-template-columns: repeat(2, minmax(220px, 1fr)); }
        }

        @media (max-width: 760px) {
          .db-pickup-shell { grid-template-columns: 72px minmax(0, 1fr); }
          .db-pickup-sidebar { padding: 16px 9px; align-items: center; }
          .db-pickup-logo { padding: 0; }
          .db-pickup-logo > span:last-child,
          .db-pickup-instrument,
          .db-pickup-nav-button span { display: none; }
          .db-pickup-nav,
          .db-pickup-nav-secondary { width: 100%; }
          .db-pickup-nav-button { justify-content: center; padding: 8px; }
          .db-pickup-main-inner { padding: 32px 18px 60px; }
          .db-pickup-header { padding-bottom: 28px; }
          .db-pickup-section { padding-top: 30px; }
          .db-pickup-core-grid { grid-template-columns: 1fr; }
        }

        @media (max-width: 540px) {
          .db-pickup-shell { grid-template-columns: 1fr; }
          .db-pickup-sidebar {
            position: fixed;
            z-index: 3;
            left: 0;
            right: 0;
            bottom: 0;
            width: auto;
            height: 64px;
            padding: 7px 10px;
            border-right: 0;
            border-top: 1px solid var(--pickup-line);
            flex-direction: row;
            overflow: visible;
          }
          .db-pickup-logo,
          .db-pickup-instrument,
          .db-pickup-nav-secondary,
          .db-pickup-nav-spacer { display: none; }
          .db-pickup-nav { width: 100%; display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; }
          .db-pickup-nav-button { min-height: 48px; }
          .db-pickup-nav-button:nth-child(n+6) { display: none; }
          .db-pickup-main { padding-bottom: 64px; }
          .db-pickup-main-inner { padding: 26px 14px 52px; }
          .db-pickup-header h1 { font-size: 27px; }
          .db-pickup-section-heading { align-items: end; }
          .db-pickup-progress-card { height: 122px; grid-template-columns: 102px minmax(0, 1fr); gap: 12px; }
          .db-pickup-progress-copy strong { margin-top: 5px; font-size: 16px; }
          .db-pickup-progress-copy span { margin-top: 9px; }
          .db-pickup-plan-grid { grid-template-columns: 1fr; }
          .db-pickup-plan-card { height: 190px; }
        }

        /* Plan cards are the supplied artwork, edge to edge. The badge and
           title are already part of each image, so these cards carry no text
           of their own and no scrim over the top — and they keep the art's
           16:9 so nothing gets cropped. Declared after the media queries so
           the fixed card heights above don't win. */
        .db-pickup-plan-card { height: auto; aspect-ratio: 16 / 9; background: #04061c; }
        .db-pickup-plan-card::after { content: none; }
        .db-pickup-plan-photo {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
          -webkit-user-drag: none;
          user-select: none;
        }
        @media (max-width: 540px) {
          .db-pickup-plan-card { height: auto; }
        }
      `}</style>

      <aside className="db-pickup-sidebar">
        <DukeMark />
        <div className="db-pickup-instrument">🤘 Let&apos;s play <span style={{ color: "var(--pickup-purple)" }}>guitar⌄</span></div>

        <nav className="db-pickup-nav" aria-label="DukeBox home navigation">
          <button type="button" className="db-pickup-nav-button is-active" onClick={() => openWorkspace("practice")}>
            <Icon name="home" /><span>Home</span>
          </button>
          <button type="button" className="db-pickup-nav-button" onClick={() => openPracticeCenter()}>
            <Icon name="practice" /><span>Practice center</span>
          </button>
          <button type="button" className="db-pickup-nav-button" onClick={() => openPracticeCenter("SONGBOOK")}>
            <Icon name="songbook" /><span>Songbook</span>
          </button>
          <button type="button" className="db-pickup-nav-button" onClick={() => openWorkspace("create")}>
            <Icon name="create" /><span>Create</span>
          </button>
          <button type="button" className="db-pickup-nav-button" onClick={() => openWorkspace("beatforge")}>
            <Icon name="beatforge" /><span>BeatForge</span>
          </button>
          <button type="button" className="db-pickup-nav-button" onClick={() => openWorkspace("gig")}>
            <Icon name="gig" /><span>Gig mode</span>
          </button>
        </nav>

        <nav className="db-pickup-nav-secondary" aria-label="Additional DukeBox navigation">
          <button type="button" className="db-pickup-nav-button" onClick={() => runAction({ type: "beatforge-section", value: "beatforge-line-lab" })}>
            <Icon name="linelab" /><span>Line Lab</span>
          </button>
          <button type="button" className="db-pickup-nav-button" onClick={() => openPracticeCenter("MELODY PATHS")}>
            <Icon name="practice" /><span>Melody paths</span>
          </button>
          <button type="button" className="db-pickup-nav-button" onClick={() => runAction({ type: "beatforge-section", value: "beatforge-licktionary" })}>
            <Icon name="songbook" /><span>Licktionary</span>
          </button>
          <button type="button" className="db-pickup-nav-button" onClick={() => openWorkspace("reference")}>
            <Icon name="reference" /><span>Reference</span>
          </button>
          <button type="button" className="db-pickup-nav-button" onClick={() => openWorkspace("tonal")}>
            <Icon name="tonal" /><span>Tonal</span>
          </button>
        </nav>

        <div className="db-pickup-nav-spacer" />
        <nav className="db-pickup-nav" aria-label="Support navigation">
          <button type="button" className="db-pickup-nav-button" onClick={() => openPracticeCenter("SONGBOOK")}>
            <Icon name="search" /><span>Search songs</span>
          </button>
          <button type="button" className="db-pickup-nav-button" onClick={() => openWorkspace("reference")}>
            <Icon name="help" /><span>Support</span>
          </button>
        </nav>
      </aside>

      <main className="db-pickup-main">
        <div className="db-pickup-main-inner">
          <header className="db-pickup-header">
            <h1>Welcome back, <span>Tim!</span></h1>
            <div className="db-pickup-header-right">
              <BuildStamp />
              <button type="button" className="db-pickup-bell" aria-label="Notifications" title="Notifications">
                <Icon name="bell" />
              </button>
            </div>
          </header>

          <section className="db-pickup-section">
            <div className="db-pickup-section-heading">
              <div>
                <h2>Get started</h2>
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

          {/* Moved here from the Practice tab — the starter charts are a way
              in, so they belong on the way-in screen. */}
          <section className="db-pickup-section">
            <div className="db-pickup-section-heading">
              <div>
                <h2>Start practicing</h2>
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
                  </button>
                ))}
              </div>
            ))}
          </section>

          <section className="db-pickup-section">
            <div className="db-pickup-section-heading">
              <div>
                <h2>Jump back in</h2>
                <p>The last things you were working on.</p>
              </div>
            </div>

            <div className="db-pickup-recent-grid">
              {Array.from({ length: 4 }, (_, i) => recent[i]).map((item, i) => (
                item ? (
                  <button type="button" key={item.label + item.at} className="db-pickup-recent-card" onClick={() => runAction(item.action)}>
                    <span className="db-pickup-recent-icon"><Icon name={recentIconName(item)} /></span>
                    <span className="db-pickup-recent-copy">
                      <strong title={item.label}>{item.label}</strong>
                      <span>{item.subtitle}{item.subtitle ? " · " : ""}{timeAgo(item.at)}</span>
                    </span>
                  </button>
                ) : (
                  <div key={`empty-${i}`} className="db-pickup-recent-card is-empty">
                    <span className="db-pickup-recent-icon" style={{ background: "transparent", color: "var(--pickup-muted)" }}><Icon name="practice" /></span>
                    <span className="db-pickup-recent-copy">
                      <strong style={{ color: "var(--pickup-muted)", fontWeight: 600 }}>Not visited yet</strong>
                      <span>Start practicing to fill this in</span>
                    </span>
                  </div>
                )
              ))}
            </div>
          </section>

          <section className="db-pickup-section">
            <div className="db-pickup-section-heading">
              <div>
                <h2>Core curriculum <Icon name="chevron" /></h2>
                <p>The interactive reference guides, straight from the Reference tab.</p>
              </div>
            </div>

            <div className="db-pickup-core-grid">
              {CORE_CURRICULUM.map((item) => (
                <a key={item.title} className="db-pickup-core-card" href={item.href} target="_blank" rel="noopener noreferrer">
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
  )
}
