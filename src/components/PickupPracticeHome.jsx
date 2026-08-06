"use client"

import { useEffect, useRef, useState } from "react"

const WORKSPACE_LABELS = {
  practice: "Practice",
  gig: "Gig",
  create: "Create",
  reference: "Reference",
  tonal: "Tonal",
}

const IN_PROGRESS = [
  {
    eyebrow: "Practice Pathway",
    title: "Make the Changes",
    subtitle: "Jazz Blues in Bb",
    progress: 38,
    art: "changes",
    action: { type: "starter", value: "Jazz Blues in Bb" },
  },
  {
    eyebrow: "Language Study",
    title: "Licktionary: Ways In",
    subtitle: "Bebop vocabulary",
    progress: 14,
    art: "licks",
    action: { type: "section", value: "LICKTIONARY" },
  },
  {
    eyebrow: "Voice Leading",
    title: "Melody Paths",
    subtitle: "Guide-tone movement",
    progress: 7,
    art: "paths",
    action: { type: "section", value: "MELODY PATHS" },
  },
]

const LEARNING_PLAN = [
  {
    badge: "Learning Pathway",
    title: "Major ii-V-I Mastery",
    subtitle: "Connect every position",
    art: "ii-v-i",
    action: { type: "starter", value: "Major ii-V-I Cycle" },
  },
  {
    badge: "Practice System",
    title: "Jazz Blues Lab",
    subtitle: "Guide tones to language",
    art: "blues",
    action: { type: "starter", value: "Jazz Blues in Bb" },
  },
  {
    badge: "Melodic System",
    title: "The Triad Network",
    subtitle: "Inside and outside movement",
    art: "triads",
    action: { type: "section", value: "TRIAD" },
  },
  {
    badge: "Song Study",
    title: "Autumn Leaves",
    subtitle: "Minor ii-V-I roadmap",
    art: "leaves",
    action: { type: "starter", value: "Autumn Leaves (Gm)" },
  },
]

const CORE_CURRICULUM = [
  {
    number: "01",
    title: "FretFlow",
    copy: "Map scales and chord tones across the neck.",
    action: { type: "section", value: "FRETFLOW" },
  },
  {
    number: "02",
    title: "Drop-2 Mastery",
    copy: "Build compact voicings and connect inversions.",
    action: { type: "section", value: "DROP-2" },
  },
  {
    number: "03",
    title: "Rhythm Changes",
    copy: "Practice the form, targets, substitutions, and tempo.",
    action: { type: "starter", value: "Rhythm Changes" },
  },
]

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

function Icon({ name }) {
  const paths = {
    home: <><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-7h6v7"/></>,
    practice: <><path d="M4 19V5"/><path d="M4 12h5l3-5 4 10 2-5h2"/></>,
    songbook: <><path d="M4 4h7a3 3 0 0 1 3 3v13H7a3 3 0 0 0-3 1V4Z"/><path d="M20 4h-3a3 3 0 0 0-3 3v13h3a3 3 0 0 1 3 1V4Z"/></>,
    create: <><path d="m4 20 4.5-1 10-10-3.5-3.5-10 10L4 20Z"/><path d="m13.5 7 3.5 3.5"/></>,
    gig: <><path d="M9 18V5l10-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/></>,
    reference: <><circle cx="12" cy="12" r="9"/><path d="m15 9-2 4-4 2 2-4 4-2Z"/></>,
    tonal: <><path d="M4 20V4h16v16H4Z"/><path d="M8 4v10M12 4v10M16 4v10"/><path d="M6 14h3M10 14h3M14 14h3"/></>,
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

  function runAction(action) {
    if (!action) return
    if (action.type === "section") {
      openPracticeCenter(action.value)
      return
    }

    openPracticeCenter()
    window.setTimeout(() => {
      findClickableByText(action.value)?.click()
    }, 180)
  }

  if (!homeOpen) {
    if (workspace !== "practice") return null
    return (
      <button
        type="button"
        className="db-pickup-return-home"
        onClick={() => setPracticeSurface("home")}
        title="Return to the Practice home page"
      >
        <Icon name="home" />
        Practice Home
      </button>
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
        .db-pickup-plan-art {
          position: relative;
          overflow: hidden;
          isolation: isolate;
        }

        .db-pickup-progress-art { border-radius: 6px; }

        .db-pickup-progress-art::before,
        .db-pickup-progress-art::after,
        .db-pickup-plan-art::before,
        .db-pickup-plan-art::after {
          content: "";
          position: absolute;
          pointer-events: none;
        }

        .db-art-changes { background: linear-gradient(145deg, #0c1626, #725523); }
        .db-art-changes::before {
          width: 74px; height: 74px; border-radius: 50%; left: 28px; top: 24px;
          border: 10px solid rgba(255,255,255,.78); box-shadow: inset 0 0 0 5px #d0a54a;
        }
        .db-art-changes::after {
          width: 90px; height: 5px; left: 22px; bottom: 24px; border-radius: 9px;
          background: #f2d786; box-shadow: 0 -12px 0 rgba(242,215,134,.55), 0 -24px 0 rgba(242,215,134,.3);
          transform: rotate(-8deg);
        }

        .db-art-licks { background: linear-gradient(135deg, #4c20e8, #19056d); }
        .db-art-licks::before {
          inset: 18px; border-radius: 50%; border: 2px solid rgba(255,255,255,.8);
          box-shadow: 0 0 0 10px rgba(255,255,255,.09), 0 0 0 22px rgba(255,255,255,.06);
        }
        .db-art-licks::after {
          width: 8px; height: 82px; left: 62px; top: 22px; border-radius: 8px;
          background: #f7d04e; transform: rotate(34deg);
        }

        .db-art-paths { background: linear-gradient(145deg, #172d42, #0c6a77); }
        .db-art-paths::before {
          width: 115px; height: 70px; left: 10px; top: 36px;
          background: repeating-linear-gradient(0deg, transparent 0 12px, rgba(255,255,255,.35) 13px 14px);
        }
        .db-art-paths::after {
          width: 16px; height: 16px; left: 24px; top: 68px; border-radius: 50%; background: #ffe769;
          box-shadow: 28px -18px 0 #f79a70, 56px 7px 0 #8bffcf, 83px -23px 0 #ffffff;
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
          grid-template-columns: repeat(4, minmax(190px, 1fr));
          gap: 16px;
        }

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

        .db-pickup-plan-art { position: absolute; inset: 0; }
        .db-pickup-plan-card::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, rgba(4,6,28,.05), rgba(4,6,28,.08) 38%, rgba(4,6,28,.92));
        }

        .db-art-ii-v-i { background: linear-gradient(135deg, #101843, #4c20e8 72%, #745aff); }
        .db-art-ii-v-i::before {
          width: 142px; height: 142px; right: -22px; top: 18px;
          border-radius: 50%;
          background: radial-gradient(circle at 50% 50%, #fff 0 7%, transparent 8% 18%, rgba(255,255,255,.35) 19% 22%, transparent 23% 38%, rgba(255,255,255,.22) 39% 42%, transparent 43%);
        }
        .db-art-ii-v-i::after {
          content: "ii  V  I"; left: 17px; top: 52px; color: white; font-size: 30px; font-weight: 900; letter-spacing: .08em;
        }

        .db-art-blues { background: linear-gradient(135deg, #031e3d, #0b6b92); }
        .db-art-blues::before {
          inset: 0;
          background: repeating-linear-gradient(115deg, transparent 0 22px, rgba(255,255,255,.08) 23px 25px);
        }
        .db-art-blues::after {
          width: 130px; height: 74px; right: 22px; top: 42px;
          border: 5px solid #e8ca61; border-left-width: 15px; border-radius: 60% 22% 22% 60%; transform: rotate(-10deg);
        }

        .db-art-triads { background: linear-gradient(145deg, #042e27, #0c7965); }
        .db-art-triads::before {
          width: 0; height: 0; left: 48px; top: 30px;
          border-left: 52px solid transparent; border-right: 52px solid transparent; border-bottom: 92px solid rgba(255,255,255,.86);
          filter: drop-shadow(40px 18px 0 rgba(255,214,91,.6));
        }
        .db-art-triads::after {
          width: 78px; height: 78px; right: 22px; top: 24px; border: 9px solid rgba(255,255,255,.24); border-radius: 50%;
        }

        .db-art-leaves { background: linear-gradient(145deg, #4b251c, #bb6931); }
        .db-art-leaves::before {
          width: 75px; height: 120px; left: 44px; top: 6px; border-radius: 80% 0 80% 0;
          background: #f4c661; transform: rotate(32deg); box-shadow: 70px 38px 0 #d94c37, 135px -6px 0 #fff0a2;
        }
        .db-art-leaves::after {
          width: 170px; height: 3px; left: 28px; top: 92px; background: rgba(255,255,255,.65); transform: rotate(-12deg);
        }

        .db-pickup-plan-content {
          position: absolute;
          z-index: 2;
          inset: 0;
          padding: 16px;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
        }

        .db-pickup-badge {
          align-self: flex-start;
          margin-bottom: auto;
          padding: 5px 8px;
          border-radius: 5px;
          background: rgba(20,20,27,.58);
          color: #fff;
          font-size: 11px;
          font-weight: 750;
          backdrop-filter: blur(5px);
        }

        .db-pickup-plan-content strong { font-size: 17px; line-height: 1.15; }
        .db-pickup-plan-content span { margin-top: 5px; color: rgba(255,255,255,.76); font-size: 13px; }

        .db-pickup-core-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(220px, 1fr));
          gap: 16px;
          padding-bottom: 50px;
        }

        .db-pickup-core-card {
          min-height: 155px;
          padding: 20px;
          border: 1px solid var(--pickup-line);
          border-radius: 10px;
          background: #fff;
          color: inherit;
          text-align: left;
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

        .db-pickup-return-home {
          position: fixed;
          right: 18px;
          top: 18px;
          z-index: 9500;
          min-height: 40px;
          padding: 9px 14px;
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
          <button type="button" className="db-pickup-nav-button" onClick={() => openWorkspace("gig")}>
            <Icon name="gig" /><span>Gig mode</span>
          </button>
        </nav>

        <nav className="db-pickup-nav-secondary" aria-label="Additional DukeBox navigation">
          <button type="button" className="db-pickup-nav-button" onClick={() => openPracticeCenter("MELODY PATHS")}>
            <Icon name="practice" /><span>Melody paths</span>
          </button>
          <button type="button" className="db-pickup-nav-button" onClick={() => openPracticeCenter("LICKTIONARY")}>
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
            <button type="button" className="db-pickup-bell" aria-label="Notifications" title="Notifications">
              <Icon name="bell" />
            </button>
          </header>

          <section className="db-pickup-section">
            <div className="db-pickup-section-heading">
              <div>
                <h2>In progress</h2>
              </div>
              <button type="button" className="db-pickup-text-button" onClick={() => openPracticeCenter()}>Open practice center</button>
            </div>

            <div className="db-pickup-progress-grid">
              {IN_PROGRESS.map((item) => (
                <button type="button" key={item.title} className="db-pickup-progress-card" onClick={() => runAction(item.action)}>
                  <div className={`db-pickup-progress-art db-art-${item.art}`} />
                  <div className="db-pickup-progress-copy">
                    <small>{item.eyebrow}</small>
                    <strong>{item.title}</strong>
                    <span>{item.subtitle}</span>
                    <div className="db-pickup-progress-track" aria-label={`${item.progress}% complete`}>
                      <i style={{ width: `${item.progress}%` }} />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="db-pickup-section">
            <div className="db-pickup-section-heading">
              <div>
                <h2>Your learning plan <Icon name="chevron" /></h2>
                <p>Recommended practice paths based on the DukeBox systems.</p>
              </div>
            </div>

            <div className="db-pickup-plan-grid">
              {LEARNING_PLAN.map((item) => (
                <button type="button" key={item.title} className="db-pickup-plan-card" onClick={() => runAction(item.action)}>
                  <div className={`db-pickup-plan-art db-art-${item.art}`} />
                  <div className="db-pickup-plan-content">
                    <span className="db-pickup-badge">{item.badge}</span>
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
                <h2>Core curriculum <Icon name="chevron" /></h2>
                <p>Build the fretboard, harmonic, and rhythmic skills behind the app.</p>
              </div>
            </div>

            <div className="db-pickup-core-grid">
              {CORE_CURRICULUM.map((item) => (
                <button type="button" key={item.title} className="db-pickup-core-card" onClick={() => runAction(item.action)}>
                  <small>{item.number}</small>
                  <strong>{item.title}</strong>
                  <p>{item.copy}</p>
                </button>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
