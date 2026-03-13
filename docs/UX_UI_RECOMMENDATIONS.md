# DukeBox UX/UI Recommendations

A prioritized usability and interface improvement plan for DukeBox.

---

## Top Priorities

1. **Reduce first-run overload** — too many controls visible at once for new users
2. **Faster path to sound** — users should be able to hear something in under 10 seconds
3. **Clearer label language** — technical jargon (e.g. "Night On/Off") makes features invisible
4. **Mobile usability** — fretboard and chord grid overflow on small screens

---

## Phased Recommendations

### Phase 1 — Quick wins (already implemented)

| Area | Change |
|---|---|
| Onboarding | "START PRACTICING FAST" panel with preset chart buttons |
| Controls | Basic / Advanced toggle to hide deep controls until needed |
| Controls | Collapsible sections: Playback, Navigation, Harmony, Layout |
| Labels | "Pianist" → "Comping Style" |
| Labels | "Night On/Off" → "Altered Dominant Color: On/Off" |
| Labels | "Approach Above/Below" → "Approach Tone: Above / Below / Off" |
| Labels | "Set Loop Start/End" → "Set Start/End at Selected Bar" |
| Practice | Starter presets always boot in Practice Mode at 50 BPM |

### Phase 2 — Information architecture

1. **Sidebar progressive disclosure** — collapse chord tones, intervals, and rhythm tag by default; expand on demand
2. **Fretboard auto-switch to Scale view** when a scale filter (pentatonic, hexatonic, Martino) is selected
3. **Playhead sync indicator** — make it clearer which bar is currently playing (bolder color treatment)
4. **Loop range visualization** — highlight the loop region in the chord grid more prominently

### Phase 3 — Onboarding / first-run experience

1. **Welcome tooltip or overlay** on first load explaining core sections
2. **Keyboard shortcut cheatsheet** — popup overlay (e.g. `?` key) listing spacebar, arrow keys, etc.
3. **Empty state guidance** — when chart is "Custom" with default bars, show a nudge toward the AI generator or starter presets

### Phase 4 — Wording and label clarity

| Current label | Proposed label | Reason |
|---|---|---|
| "Phrase" in bar card | "Approach Line" | More descriptive of the jazz concept |
| "GT:" in bar card | "Guide Tones:" | Abbreviation unclear to newer players |
| "Function:" | "Harmonic Function:" | Context for users unfamiliar with jazz theory |
| "+Bebop" | "+Bebop Chromatic" | Clarifies it adds a passing tone, not a style change |

### Phase 5 — Visual hierarchy and consistency

1. **Section separator lines** between major UI zones (AI generator, song settings, controls, grid)
2. **Button size consistency** — mix of padding sizes creates visual noise in controls strip
3. **Color legend always visible** — fretboard dot legend currently only shows when overlays are active; show it always when fretboard is open
4. **Approach type pill in bar cards** — small color-coded pill showing the current approach type (7→3, chromatic, altered) per bar

### Phase 6 — Mobile responsiveness

1. **Chord grid horizontal scroll** on small viewports instead of collapsing to 1 column
2. **Fretboard overflow** — `overflowX: auto` wrapping is good; add pinch-to-zoom hint on mobile
3. **Sticky play/stop button** — keep it accessible when scrolled deep into the chord grid
4. **Sidebar collapses to bottom sheet** on mobile — right-side aside doesn't work on narrow screens

### Phase 7 — Accessibility

1. **Focus styles** — add visible `:focus-visible` outlines for keyboard navigation
2. **ARIA labels** on icon-only buttons (×, ÷2, ×2 bar buttons)
3. **Color contrast** — verify muted text (opacity: 0.4–0.55) meets WCAG AA on all palette themes
4. **Reduced-motion** — wrap transitions and animations in `prefers-reduced-motion` media query

### Phase 8 — Workflow accelerators

1. **Arrow key navigation** — left/right to move selected bar, up/down to change chord quality
2. **Chord quick-entry** — type "Dm7" directly into a selected bar
3. **Copy/paste bars** — select a bar, Cmd+C to copy, click another bar, Cmd+V to paste
4. **Chart export** — copy chord changes as plain text (e.g. "| Dm7 | G7 | Cmaj7 | Cmaj7 |")
5. **Per-bar loop** — double-click a bar to loop just that chord for isolated practice

### Phase 9 — AI generation UX

1. **Prompt history** — small dropdown to re-run previous prompts
2. **"Surprise me"** — random style/key button that generates a chart without a prompt
3. **Stream generation notes** — show the generation notes in real time rather than after completion
4. **Template prompts** — click-to-insert prompt snippets (e.g. "12-bar blues in [key]")

---

## Success Metrics

- Time-to-first-sound < 15 seconds for a new user
- Starter preset usage rate > 40% of sessions
- Advanced controls toggle engagement rate (proxy for power-user depth)
- No layout overflow reported on 375px (iPhone SE) viewport

---

*Last updated: generated from UX/UI review session.*
