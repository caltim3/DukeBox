# PRACTICE_REDESIGN_V3_PLAN.md
## Implementation plan for the Practice-tab cosmetic redesign

Written per `docs/PRACTICE_REDESIGN_V3.md` §8.1 step 3, against the app as of
commit `e48774e` ("Replace DukeBox palettes with v2 set"). This is the plan;
no functional code has been changed yet.

---

## 0 · What's already true (good news)

The app is closer to the spec than a from-scratch build:

- **Token system already exists.** `src/app/globals.css` already defines
  `--bg/--surface/--surface2/--line/--text/--muted/--accent/--accent-ink/--hot`
  plus `--root/--chord/--scale/--passing/--target` and `--loop/--sel`, keyed
  off `[data-palette][data-mode]`, for **Regatta, Ember, Kiln, Harbor**. It's
  missing `--info` and `--glow`, and it's missing **Studio** (default) and
  its **Slate** dark counterpart entirely.
- **Theme boot script already exists.** `src/app/layout.js` has the
  no-flash inline script reading `localStorage['dukebox-palette']` /
  `['dukebox-mode']` and stamping `data-palette`/`data-mode` on `<html>`
  before paint — exactly what §4.1 asks for. It only needs `'studio'` added
  to its allow-list and made the default.
- **Almost everything reads CSS vars already.** Components are styled with
  inline `style={{ background: "var(--db-panel-bg)", ... }}` objects (see
  `panelStyle`, `eyebrowStyle`, `selectStyle` at `src/app/page.js:3060-3235`),
  not literal hex. The `--db-*` aliases in `globals.css:66-90` already
  forward to the palette tokens.
- **A chart ribbon already exists**: `src/components/GigBarStrip.jsx` is a
  fixed strip showing the active section's bars with the now-playing bar
  highlighted, live across every tab. It's most of §5.5's "chart ribbon"
  already, just styled differently and always-fixed rather than in-flow.
- **Power panels already exist as a pattern**: Lead Sheet Grid is already a
  native `<details>/<summary>` collapsible (`page.js:2218`), and BeatForge
  Metronome is already wrapped in a collapsible `PracticeExpander`
  (`page.js:2730`, defined at `page.js:2839`). The redesign mostly needs to
  reuse/rename this pattern, not invent it.

This means D1/D2/D3 (tokens) and much of D12 (power panel shells) are
**extend, not build**.

---

## 1 · Current Practice-tab render map

Everything lives in one component, `Home()` in `src/app/page.js` (3239
lines total). There is no separate "Practice tab" file — `mode` state
(`"practice" | "gig" | "create" | "reference" | "tonal"`) gates fragments
of one long JSX tree with `{inMode("practice") && ...}`. Relevant anchors:

| Lines | Content | Maps to spec section |
|---|---|---|
| 1265–1404 | `<main>`, title/palette picker, workspace tab bar (`MODES.map`) | Top bar (§7, unchanged) |
| 1281 | `<GigBarStrip>` — fixed section/bar strip, live across all tabs | Chart ribbon (§5.5), pre-existing |
| 1509–1538 | "START PRACTICING" starter chips (`STARTER_PRESETS.map` → `loadStarter`) | Quick Start bar (§7) |
| 1542–1771 | "SONGBOOK" panel: Form `<select>`, `<SongSearch>`, import modal, exports, **`<PracticeTimer>` at 1683** | Songbook drawer + Timer drawer (§5.6) |
| 1772–1946 | "PRACTICE MIX & LOOP": Play/Stop, loop start/end, Tempo, Swing, Reverb, Piano/Bass/Drums selects, per-instrument mute, Play Mode toggle | Band & Mix panel (§5.8) + Sticky transport (§5.7) |
| 1947–2195 | "FRETBOARD": Chord/Scale toggle, systems (Pent/Hex/Martino/Hex·Chord/Barry6th), overlays (Bebop/7→3/Anticipate), tuning select, transpose key/mode/roman, **`<Fretboard>` at 2138 and 2164** | Fretboard card + collapsible settings (§5.3) |
| 2196–2217 | "MELODY PATHS": `<MelodyPaths>` | Melody Paths power panel (§5.4, §5.8) |
| 2218–2729 | "LEAD SHEET GRID" (`<details>`): column selector, scroll, copy, +Measure, per-bar chord/scale editors, **`<Fretboard>` again at 2712** (inline mini-board per bar?) | Lead Sheet Grid power panel (§5.8) |
| 2730–2739 | "BEATFORGE METRONOME" (`<PracticeExpander>` wrapping `<MetronomePanel>`) | Metronome power panel (§5.8) |
| 2740 | `<DesertNoirPanel>` (only when `dnMeta` — an easter-egg panel keyed to specific `selectedForm` values) | **Not in spec.** Not in §7 preservation table by name, but §7's closing line ("If you find an existing feature not in this table, it is preserved by default") means it stays. Treat as an extra always-collapsed power panel or leave outside the panel stack, still gated on `dnMeta`. |
| 2839 | `function PracticeExpander(...)` — the existing generic collapsible panel used for BeatForge | Reuse as the shell for **all** new power panels rather than writing a new one |
| 3060–3235 | Shared style objects: `panelStyle`, `sidePanelStyle`, `selectStyle`, `inlineLabelStyle`, `eyebrowStyle`, `buttonStyle()`, `notePillStyle()` | Reuse; extend rather than replace |

No dedicated files for: session strip, anticipation strip, sticky transport,
drawers, or a Cockpit/Focus toggle. These are new.

**Important scope note:** nothing above is a discrete component per
practice-tab subsection — it's all inline JSX inside one `Home()` function.
To hit the spec's "every existing `onClick`/`onChange`/`useEffect` moves
with its control, nothing is re-implemented" rule without turning this into
an unreviewable diff, new practice-tab UI needs to be **extracted into
presentational components that take the existing state/handlers as props**,
not written inline in `page.js`. `page.js` keeps 100% of the state and
logic; new files hold layout only.

---

## 2 · New files to create

| File | Contents |
|---|---|
| `src/styles/tokens.css` | Studio + Slate palette block (§4.3–4.4), `--info`/`--glow` added to all 5 existing palettes in `globals.css`, fretboard constants (§4.7), melody-paths constants (§4.8, superseding the current `--root/--chord/--scale/--passing/--target` reuse inside `MelodyPaths.jsx` if it currently reads palette tokens — needs checking against §4.9's "never from palette" rule). Imported from `globals.css` or `layout.js`. |
| `src/components/practice/SessionStrip.jsx` | §5.5 session strip. Props: session timer value (from `PracticeTimer`/`timerState`), song title + loop descriptor + focus block string, loop count (hardcode `87/100` per spec §8.2 step 6 — no existing loop-count field found), `onOpenSongbook`, `onOpenTimer`. |
| `src/components/practice/ChartRibbon.jsx` | §5.5 in-flow ribbon (distinct from the existing fixed `GigBarStrip`) — 12-bar-tile grid, Start Here/End Here buttons, loop badge. Reuses `loopStart`/`loopEnd`/`setLoopStart`/`setLoopEnd`/`selectedIndex` from `page.js`. Decide whether this *replaces* `GigBarStrip` in Practice mode or sits alongside it (`GigBarStrip` is fixed/global across tabs and only shows while playing; the spec's ribbon is in-flow and always visible) — flag in §5 below. |
| `src/components/practice/AnticipationStrip.jsx` | §5.5 NOW/Next/Then/Then tiles. Reads current/next bar chord + scale-note string already computed for the Fretboard header (need to locate that computation — likely near `fretboardBarIndex` / the `Fretboard` mode-info props around line 2138). |
| `src/components/practice/FretboardCard.jsx` | §5.3 shell: header with caret, collapsible settings (systems/overlays/tuning/transpose — the exact controls currently at `page.js:1947-2195`), legend, then the existing `<Fretboard>` unchanged inside, then footer text. Cockpit and Focus both use this component; Focus passes a `size="lg"` prop for the bigger string-row/note/target dimensions in §5.2. |
| `src/components/practice/FocusGoalCard.jsx` | §5.1/§5.2 "Today's focus" card. Display-only hardcoded string per §6 — no new state, no Supabase field. |
| `src/components/practice/BackingBandCard.jsx` | §5.1 mini mixer mirroring the per-instrument mute buttons already in the "PRACTICE MIX & LOOP" block. |
| `src/components/practice/PowerPanel.jsx` | Thin rename/generalization of the existing `PracticeExpander` (page.js:2839) — or just reuse `PracticeExpander` directly and skip this file. Decide during implementation; do **not** fork the collapsible logic twice. |
| `src/components/practice/SongbookDrawer.jsx` | §5.6 left drawer. Moves the existing Form `<select>` + `<SongSearch>` + exports wholesale; does not reimplement song loading. |
| `src/components/practice/TimerDrawer.jsx` | §5.6 right drawer wrapping the existing `<PracticeTimer>` (page.js:1683) — same component, new container. The spec's new "Auto-log session to memory" toggle is genuinely new UI; per §5.6 it's additive, needs its own tiny piece of state (not in Supabase, not in §6's one-new-state-field budget — flag this conflict, see §5 below). |
| `src/components/practice/StickyTransport.jsx` | §5.7 fixed bottom bar. Play/Pause, Loop toggle, Tempo ± , Swing, Bars range, Timer readout, settings gear. All read/write the same `page.js` state (`isPlaying`, `loopEnabled`, `tempo`, `swingAmount`, `loopStart`/`loopEnd`). |
| `src/components/practice/CockpitView.jsx` / `FocusView.jsx` | §5.1 / §5.2 top-canvas layout containers. Compose the pieces above; swapped by the new `practiceView` state. |

MelodyPaths visual restore (D8/§5.4) happens inside the existing
`src/components/MelodyPaths.jsx` (415 lines) — container/class changes
only, per spec. No new file.

Lead Sheet Grid and Band & Mix panels: **wrap in place**. Their JSX stays
in `page.js` (or gets extracted 1:1 into
`src/components/practice/BandMixPanel.jsx` and
`src/components/practice/LeadSheetGridPanel.jsx` purely to shrink
`page.js`) — either way, no control is rebuilt, only re-parented into the
`PracticeExpander` shell with new default-open state (Band & Mix open,
others closed, per §5.8).

---

## 3 · New state

Per §6, exactly one new field:

```js
const [practiceView, setPracticeView] = useState("cockpit")
// persisted to localStorage["dukebox.practiceView"], read on mount
```

Plus the pre-existing `openControlPanels` state (`page.js:193`) already
covers per-panel open/closed persistence — confirm its current keys match
the four power panels (`band`, `melody`, `leadsheet`, `metronome` or
similar) and that it's already localStorage-backed; extend if not, but
don't invent a second panel-state mechanism.

The Timer drawer's new "Auto-log session to memory" toggle is UI the
mockup shows but the spec's §6 explicitly caps new state at one field and
§8.1's Appendix A doesn't mention a memory/session-log feature existing
anywhere in `src/lib/`. **Flag for the user before building**: either (a)
treat it as a no-op / visual-only checkbox for v3 (closest to "cosmetic
only"), or (b) wire it to something — there is nothing to wire it to today.
Recommend (a) and say so in the PR description, matching how the mock
handles "Focus block" as display-only.

---

## 4 · Order of operations

Following spec §8.2, adjusted for what already exists:

1. **Tokens.** Add Studio/Slate to `globals.css` (or new `src/styles/tokens.css`
   imported by it), add `--info`/`--glow` to all 5 palettes, add the
   `--fb-*`/`--n-*`/`--mp-*` constants at `:root`. Update `PALETTES` array
   (`page.js:53`) to include Studio and make it default; update
   `layout.js`'s `themeBootScript` allow-list and default. Verify all 5(→6)
   chips switch bg/text page-wide with no flash.
2. **View toggle.** Add `practiceView` state + localStorage read/write.
   Render `<CockpitView>`/`<FocusView>` as empty stubs behind a toggle in
   the top bar next to the existing palette picker.
3. **Fretboard card.** Re-parent the existing fretboard settings block
   (1947–2195) and `<Fretboard>` instances into `FretboardCard.jsx`. Verify
   click-to-hear/swipe/pinch/mode toggles all still fire — this is the
   highest-risk step since `Fretboard.js` internals must not move.
4. **Session strip + anticipation strip + chart ribbon.** New renders of
   existing bar/loop/chord state. No new computation beyond what already
   feeds the Fretboard's header (chord name, scale notes, target note).
5. **Below-row cards** (Focus Goal, Backing Band) — mostly new markup
   around existing mute-button state.
6. **Drawers.** Extract Songbook and Timer content wholesale.
7. **Sticky transport.** New display bound to existing Play/loop/tempo state.
8. **Power panels.** Wrap Band & Mix / Melody Paths / Lead Sheet Grid /
   Metronome in `PracticeExpander`, default states per §5.8.
9. **Melody Paths visual restore.** Container/class-only changes inside
   `MelodyPaths.jsx`.
10. **Focus view.** Reuse `FretboardCard` with a size prop; giant chord +
    coming-up panel are new markup over existing "now/next" chord state.
11. **Grep sweep** for literal hex in touched files; confirm only
    maple-wood/melody-paths values remain outside `tokens.css`.
12. **Walk §7 preservation table** top to bottom.

---

## 5 · Things to flag before writing code (per spec Appendix B)

1. **`GigBarStrip` vs. the spec's "chart ribbon."** The app already has a
   fixed, cross-tab bar strip that only appears *while playing*. The mock's
   ribbon is in-flow, always visible (even paused), with Start Here/End
   Here buttons and a LOOP badge baked in. These are not the same
   component. Recommend building `ChartRibbon` as the new in-flow always-
   visible piece for Cockpit/Focus, and leaving `GigBarStrip` exactly as-is
   (it still serves Gig/Create/Reference/Tonal tabs) — i.e. two bar strips
   exist app-wide after this change, each doing a different job. Confirm
   that's acceptable rather than trying to unify them, which would be a
   mechanical change outside this PR's scope.
2. **"Auto-log session to memory" toggle** — see §3 above. No backing
   feature exists. Recommend shipping it as a visual-only, unwired toggle
   for v3, called out explicitly in the PR description.
3. **Loop counter "87/100"** has no backing state anywhere found in
   `page.js`. Spec §8.2 step 6 explicitly allows hardcoding this for v3
   with a follow-up ticket — doing that.
4. **Second `<Fretboard>` instance at `page.js:2712`**, inside the Lead
   Sheet Grid block — needs a closer look during implementation to confirm
   what it renders (likely a per-bar mini preview) before deciding whether
   `FretboardCard`'s "always maple, constant tokens" rule applies to it too
   or whether it's out of scope (it's inside the Lead Sheet Grid power
   panel, not the top-level fretboard card described in §5.3).
5. **`DesertNoirPanel`** (line 2740) is an existing easter-egg panel not
   mentioned anywhere in the spec. Per §7's catch-all rule it stays;
   proposal is to leave it exactly where it is, outside the new power-panel
   stack, still gated on `dnMeta`.

None of these block starting D1–D3 (tokens) or D4 (view toggle scaffold);
they only need a decision before D9/D10/D6 respectively.

---

## 6 · Files this PR will NOT touch

`src/lib/**`, `src/lib/music/**`, `src/lib/cloud.js`, `src/lib/supabase.js`,
`supabase_dukebox_library.sql`, `next.config.mjs`, `package.json`,
`.claude/**`, and the internals of `Fretboard.js` / `MelodyPaths.jsx` /
`MetronomePanel.jsx` / `PracticeTimer.jsx` / `SongSearch.jsx` beyond the
class/container changes §5.4 and §5.3 explicitly call for.

---

*Plan complete. Awaiting go-ahead to start D1 (tokens).*
