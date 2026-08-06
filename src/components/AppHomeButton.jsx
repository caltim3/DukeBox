"use client"

import { useEffect, useState } from "react"

const BRAND_ICON = "/dukebox-jazzmaster.svg"

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
          padding-left: 58px !important;
        }

        .db-app-home-button {
          position: fixed;
          top: 18px;
          left: 18px;
          z-index: 9999;
          width: 48px;
          height: 48px;
          padding: 0;
          border: 0;
          border-radius: 0;
          background: transparent;
          box-shadow: none;
          display: block;
          cursor: pointer;
          transition: transform 140ms ease;
        }

        .db-app-home-button:hover {
          transform: translateY(-1px) scale(1.04);
        }

        .db-app-home-button:focus-visible {
          outline: 3px solid color-mix(in srgb, var(--db-accent, #d4a72c) 42%, transparent);
          outline-offset: 3px;
        }

        .db-app-home-button img {
          display: block;
          width: 100%;
          height: 100%;
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
            padding-left: 50px !important;
          }

          .db-app-home-button {
            top: 16px;
            left: 12px;
            width: 42px;
            height: 42px;
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
        <img src={BRAND_ICON} alt="" aria-hidden="true" />
        <span className="db-app-home-button-label">Home</span>
      </button>
    </>
  )
}
