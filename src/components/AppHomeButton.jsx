"use client"

import { useEffect, useState } from "react"

function textOf(element) {
  return element?.textContent?.replace(/\s+/g, " ").trim().toLowerCase() ?? ""
}

function findPracticeTab() {
  return [...document.querySelectorAll('[role="tab"]')]
    .find((tab) => textOf(tab).includes("practice"))
}

export default function AppHomeButton() {
  const [homeOpen, setHomeOpen] = useState(false)

  useEffect(() => {
    const sync = () => {
      setHomeOpen(document.body.classList.contains("db-pickup-home-open"))
    }

    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"],
    })

    return () => observer.disconnect()
  }, [])

  function goHome() {
    const existingReturnButton = document.querySelector(".db-pickup-return-home")
    if (existingReturnButton) {
      existingReturnButton.click()
      return
    }

    findPracticeTab()?.click()
  }

  if (homeOpen) return null

  return (
    <>
      <style>{`
        body:not(.db-pickup-home-open) > main h1:first-of-type {
          padding-left: 54px !important;
        }

        .db-app-home-button {
          position: fixed;
          top: 20px;
          left: 20px;
          z-index: 9999;
          width: 44px;
          height: 44px;
          padding: 4px;
          border: 1px solid var(--db-panel-border, rgba(127, 127, 127, 0.28));
          border-radius: 12px;
          background: var(--db-panel-bg, rgba(255, 255, 255, 0.92));
          color: inherit;
          box-shadow: 0 7px 22px var(--shadow, rgba(0, 0, 0, 0.16));
          display: grid;
          place-items: center;
          cursor: pointer;
          transition: transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease;
          backdrop-filter: blur(8px);
        }

        .db-app-home-button:hover {
          transform: translateY(-1px) scale(1.04);
          border-color: var(--db-accent, currentColor);
          box-shadow: 0 10px 28px var(--shadow, rgba(0, 0, 0, 0.2));
        }

        .db-app-home-button:focus-visible {
          outline: 3px solid color-mix(in srgb, var(--db-accent, #d4a72c) 42%, transparent);
          outline-offset: 3px;
        }

        .db-app-home-button img {
          display: block;
          width: 34px;
          height: 34px;
          object-fit: contain;
        }

        .db-app-home-button-label {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }

        @media (max-width: 560px) {
          body:not(.db-pickup-home-open) > main h1:first-of-type {
            padding-left: 46px !important;
          }

          .db-app-home-button {
            top: 18px;
            left: 14px;
            width: 38px;
            height: 38px;
            border-radius: 10px;
          }

          .db-app-home-button img {
            width: 30px;
            height: 30px;
          }
        }
      `}</style>
      <button
        type="button"
        className="db-app-home-button"
        onClick={goHome}
        title="Back to DukeBox home"
        aria-label="Back to DukeBox home"
      >
        <img src="/dukebox-goldtop.svg" alt="" aria-hidden="true" />
        <span className="db-app-home-button-label">Home</span>
      </button>
    </>
  )
}
