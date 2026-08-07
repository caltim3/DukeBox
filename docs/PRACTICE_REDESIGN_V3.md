# PRACTICE_REDESIGN_V3.md
## Cosmetic redesign of the Practice tab

**Repo:** caltim3/DukeBox · Next.js · deployed to duke-box.vercel.app
**Scope:** COSMETIC ONLY. This is a paint job, not a rewire.
**Audience:** the code agent (Claude Code) implementing the change.

---

## 0 · Prime directive (read this first, twice)

This project already has a fully working audio engine, chord/scale detection, Supabase-backed songbook, timer, metronome, chart edit, transpose, and fretboard math. **None of that gets touched.**

You are not rebuilding functionality. You are:
1. Adding a **CSS token system** (six palettes, two modes).
2. Reorganizing **layout** (Cockpit view + Focus view + collapsible power panels + two drawers).
3. Restoring one visual regression (Melody Paths back to tight small-circle look).
4. Adding **one** piece of new client state: `view = "cockpit" | "focus"`.

Rules of the road:

- Do not modify any function that touches audio, Supabase, transport start/stop, chord detection, scale detection, transpose, chart parsing, timer countdown, or metronome scheduling.
- Do not rename existing state fields, actions, or data models.
- Preserve every existing `onClick`, `onChange`, `useEffect`, and callback. If a control moves in the DOM, its handler moves with it.
- If in doubt whether a piece of code is cosmetic or mechanical: it is mechanical. Leave it alone.
- Every existing control listed in **§7 Feature preservation map** must still be reachable in one click or one panel-open from the Practice tab.

If you cannot preserve a piece of existing functionality without touching mechanics, **stop and ask** rather than refactoring around it.

---

## 1 · Reference files

Study both before writing any code.

| File | Purpose |
|------|---------|
| `docs/mockups/practice-redesign-v3.html` | **Visual North Star.** Standalone HTML, all six palettes, both view modes, all panels, all drawers. Every color, class name, and layout decision is in here. Treat it as authoritative for visuals. |
| `docs/PRACTICE_REDESIGN_V3.md` | This file. Authoritative for scope, tokens, and feature preservation. |

The mock is not source to port. It's a specification you match. Your job is to make the Next.js Practice tab **look and feel** like the mock while keeping all real functionality intact.

---

## 2 · Success criteria

When this PR is ready to merge:

- [ ] The Practice tab visually matches `docs/mockups/practice-redesign-v3.html` in the default palette (Studio).
- [ ] All six palettes are selectable from the top bar (Studio, Regatta, Ember, Kiln, Harbor).
- [ ] Studio, and only Studio, has both a Light and a Dark mode (the Dark mode of Studio is the grey-driven Slate variant).
- [ ] The other four palettes retain both modes as specified.
- [ ] Palette + mode choice persists across reloads (localStorage) and applies to the entire app, not just the Practice tab.
- [ ] The maple fretboard visual is **identical across all six palettes**. It never changes color when the palette changes.
- [ ] The Melody Paths section is **identical across all six palettes** (dark navy with the small-circle look). It never changes color when the palette changes.
- [ ] View toggle at top of Practice tab switches between Cockpit and Focus. State persists in localStorage.
- [ ] Every feature listed in **§7 Feature preservation map** works exactly as it did before, in its new location.
- [ ] No regression in audio, chord detection, scale suggestion, transpose, chart edit, timer, or metronome.
- [ ] Nothing in `src/lib/`, `src/audio/`, `src/state/`, `src/hooks/`, or Supabase query code changes. If any of those need edits, stop and ask.

---

## 3 · Deliverables

| ID | Deliverable | Files touched (guidance, adjust to real structure) |
|---|---|---|
| D1 | Palette token system (§4) | `src/styles/tokens.css` (new) or extend existing global styles |
| D2 | Constant fretboard tokens (§4.7) | Same file as D1 |
| D3 | Constant melody-paths tokens (§4.8) | Same file as D1 |
| D4 | View toggle state | Practice page top-level component |
| D5 | Cockpit layout (§5.1) | Practice page component tree |
| D6 | Focus layout (§5.2) | Practice page component tree |
| D7 | Fretboard settings become collapsible inside the fretboard card (§5.3) | Fretboard component |
| D8 | Melody Paths visual restore (§5.4) | Melody Paths component |
| D9 | Session strip + chart ribbon + anticipation strip (§5.5) | Practice page |
| D10 | Songbook drawer + Timer drawer (§5.6) | New drawer components; existing songbook + timer content moves in |
| D11 | Sticky bottom transport (§5.7) | New component; wraps existing play/loop/tempo handlers |
| D12 | Power panels for existing controls (§5.8) | Practice page; existing Band & Mix, Lead Sheet Grid, Metronome components go inside |

---

## 4 · Token system

Every color in the redesigned UI reads from a CSS custom property. No literal hex values in components. Palettes are switched by a single attribute on `<html>` or `<body>`.

### 4.1 Switch mechanism

Two attributes drive everything:

- `data-palette` = `"studio" | "regatta" | "ember" | "kiln" | "harbor"`
- `data-mode` = `"light" | "dark"`

Default on load: `data-palette="studio"` and `data-mode="light"`.

Read from `localStorage` before paint (inline blocking script in `<head>` or in the Next.js App Router root layout) so there is no flash of wrong theme.

### 4.2 Semantic token contract

Every palette defines exactly the same set of tokens. Every component reads from these. Do not add new tokens on a per-component basis.

| Token | Meaning |
|---|---|
| `--bg` | Page background |
| `--surface` | Card, panel, container background |
| `--surface2` | Inset elements (slider tracks, selects, bar tiles, metronome cells) |
| `--line` | All borders and dividers |
| `--text` | Primary text |
| `--muted` | Labels, captions, inactive tabs, secondary text |
| `--accent` | Primary action ONLY (Play, Start, active tab, main CTA) |
| `--accent-ink` | Text/icon color on top of `--accent` |
| `--hot` | Loop, record, danger emphasis. Always distinct from `--accent` |
| `--info` | Non-action information color (Coming Up outlines, "next bar" hint) |
| `--loop` | Low-alpha rgba fill for bars inside the active loop range |
| `--sel` | Low-alpha rgba fill for the currently selected bar |
| `--glow` | Soft rgba glow used for the target-note pulse and similar |

Note: `--root`, `--chord`, `--scale`, `--passing`, `--target` are **not** in the palette. They are constants defined once in `:root` (see §4.7). They never change with palette.

### 4.3 Palette · Studio (light mode, default)

```css
[data-palette="studio"][data-mode="light"] {
  --bg:#F3F4F6; --surface:#FFFFFF; --surface2:#F9FAFB; --line:#E5E7EB;
  --text:#111827; --muted:#6B7280;
  --accent:#16A34A; --accent-ink:#FFFFFF; --hot:#DC2626; --info:#2563EB;
  --loop:rgba(220,38,38,.09); --sel:rgba(37,99,235,.10);
  --glow:rgba(37,99,235,.42);
}
```

### 4.4 Palette · Studio (dark mode, aka Slate)

```css
[data-palette="studio"][data-mode="dark"] {
  --bg:#111827; --surface:#1F2937; --surface2:#374151; --line:#4B5563;
  --text:#F9FAFB; --muted:#9CA3AF;
  --accent:#22C55E; --accent-ink:#052E16; --hot:#EF4444; --info:#60A5FA;
  --loop:rgba(239,68,68,.18); --sel:rgba(96,165,250,.14);
  --glow:rgba(96,165,250,.55);
}
```

### 4.5 Palette · Regatta

```css
[data-palette="regatta"][data-mode="dark"] {
  --bg:#071825; --surface:#003049; --surface2:#0B3E5C; --line:#1A4E70;
  --text:#FDF0D5; --muted:#8FA5B8;
  --accent:#C1121F; --accent-ink:#FDF0D5; --hot:#780000; --info:#669BBC;
  --loop:rgba(120,0,0,.28); --sel:rgba(102,155,188,.16); --glow:rgba(240,200,120,.55);
}
[data-palette="regatta"][data-mode="light"] {
  --bg:#FDF0D5; --surface:#FFF9E6; --surface2:#F0E4C4; --line:#D8CDA8;
  --text:#003049; --muted:#4A6A80;
  --accent:#C1121F; --accent-ink:#FDF0D5; --hot:#780000; --info:#003049;
  --loop:rgba(120,0,0,.11); --sel:rgba(0,48,73,.10); --glow:rgba(120,0,0,.35);
}
```

### 4.6 Palettes · Ember, Kiln, Harbor

Values live in the mockup HTML `<style>` block, under selectors of the form `body[data-palette="<name>"][data-mode="<light|dark>"]`. Copy the six declarations across verbatim. Each palette has exactly the eleven tokens listed in §4.2 plus `--info`.

### 4.7 Constant tokens · Fretboard (maple, never changes)

Defined once at `:root`. The fretboard uses these regardless of palette or mode.

```css
:root {
  /* Maple fretboard */
  --fb-wood-1:#EEC788; --fb-wood-2:#DDA85A;
  --fb-nut:#5C3C1A;
  --fb-fret:rgba(70,45,20,.5); --fb-fret-strong:rgba(70,45,20,.75);
  --fb-string:rgba(40,25,10,.55); --fb-inlay:#3E2810;
  --fb-labels:#3E2810;

  /* Note roles on the maple, constant */
  --n-root:#DC2626; --n-chord:#16A34A; --n-scale:#047857;
  --n-passing:#57534E; --n-target:#2563EB;
  --n-target-glow:rgba(37,99,235,.45);
}
```

**Requirement:** flipping between all six palettes must leave every fretboard visual pixel-identical. The only fretboard CSS that reads from the active palette is optional (border color of the fretboard card itself, since the card is a normal surface).

### 4.8 Constant tokens · Melody Paths (dark navy, never changes)

```css
:root {
  --mp-bg:#0F172A; --mp-surface:#1E293B; --mp-line:#334155;
  --mp-text:#E2E8F0; --mp-muted:#94A3B8; --mp-hdr-accent:#F8FAFC;
  --mp-cell:#0F172A; --mp-cell-border:#475569;
  --mp-root:#F97316; --mp-third:#60A5FA; --mp-fifth:#94A3B8;
  --mp-seventh:#FCD34D; --mp-alt:#F87171;
  --mp-line-color:#3B82F6;
  --mp-melody:#F97316;
}
```

The Melody Paths panel wraps its content in a container that uses `--mp-*` tokens only. Its surrounding panel card can use palette tokens.

### 4.9 Component wiring rules

- Backgrounds: `background: var(--bg | --surface | --surface2)` only.
- Text: `color: var(--text | --muted)` only.
- Borders: `border: 1px solid var(--line)`.
- Primary action buttons: `background: var(--accent); color: var(--accent-ink);`.
- Loop/record: `var(--hot)`.
- Information callouts (not actions): `var(--info)`.
- Selected bar: `background: var(--sel); border-color: var(--info);`.
- Bars inside the loop range: `background: var(--loop);`.
- Focused/pulsing target dot: `box-shadow: 0 0 0 3px var(--glow), 0 0 18px var(--glow);`.
- Fretboard note dots: read from `--n-root | --n-chord | --n-scale | --n-passing | --n-target`. Never from palette.

Grep for literal hex colors (`grep -E '#[0-9A-Fa-f]{3,8}'`) in Practice-tab component files after the change. Everything that is not a token, a maple-wood value, or a melody-paths value is a bug.

---

## 5 · Layout specification

Layout descriptions here are what the UI looks like at desktop widths. Mock HTML handles the responsive breakpoints; mirror them.

### 5.1 Cockpit view (default view)

Top-to-bottom in the Practice tab canvas:

1. **Session strip** (§5.5)
2. **Chart ribbon** (§5.5)
3. **Anticipation strip** (§5.5): NOW tile (2fr) + Next (1fr) + Then (1fr) + Then (1fr). NOW is huge chord + mode info + beat indicator. Others are chord + "in X beats".
4. **Full-width Fretboard card** (§5.3) with settings collapsible inside.
5. **Below-row (2 columns)**: Focus goal card (1.4fr) + Backing band card (1fr).
6. **Power panels** (§5.8) collapsed underneath, Band & Mix open by default.

Wrap container max-width: **1400px**. Fretboard must span the full wrap width.

### 5.2 Focus view

1. Thin session strip (compact single line).
2. Chart ribbon with playhead.
3. Hero row: giant chord (~120px Bb7) on the left; "Coming up · next 3" panel on the right with three small chord chips.
4. Full-width Fretboard card, **bigger than Cockpit** (string rows 54px vs 40px; notes 32px vs 26px; target 40px vs 32px).
5. Practice-line card ("Practicing: enclosure landing on D · from Db and Eb").
6. Same power panels underneath.

Both views share the same power panels, drawers, and sticky transport. The toggle only swaps the top canvas area.

### 5.3 Fretboard card (both views)

The card has three parts stacked vertically:

- **Header row**: title `Fretboard · Bb7 · Bb Mixolydian`, a one-line summary of active settings ("Chord + Scale · +7→3 · Anticipate · Standard tuning"), and a caret button ▼ that toggles a collapsible settings drawer inside the card.
- **Collapsible settings** (visible when card is `open`): rows for Systems, Overlays, Tuning, Transpose part (Key, Major/Minor, Roman/Chord-names). Same controls as the current Fretboard section of the app, just moved inside the fretboard card. See mock for exact grouping.
- **Legend** (always visible): Root, Chord tone, Scale tone, Bebop passing, Target.
- **Maple board** (§4.7): 12 frets, 6 strings, fret numbers below (Roman numerals at 3, 5, 7, 9, 12; arabic elsewhere), single inlay dots at 3/5/7/9 and double inlay at 12. Uses fretboard tokens only.
- **Footer text**: "Swipe the neck sideways to reach the upper frets · pinch to zoom · click a note to hear it".

**Preserve:** every existing fretboard interaction (click-to-hear, swipe, pinch, mode toggles, tuning change, transpose). Only the containment and CSS classes change.

### 5.4 Melody Paths visual restore

The current app broke visually into oversized square cells. Revert to the tight small-circle look shown in `docs/mockups/practice-redesign-v3.html` inside the Melody Paths panel. Requirements:

- Circles ~38px, `border-radius: 50%`, 2px colored border matching role.
- Grid: 1 label column (~38px) + 8 measure columns. Rows top-to-bottom: chord header, then 7 scale-degree rows (A, G, F, Eb, D, C, Bb for a Bb-major-key song; use whatever the key computes to), then measure-label footer row.
- Cell coloring by role: root = `--mp-root`, third = `--mp-third`, fifth = `--mp-fifth`, seventh = `--mp-seventh`, alteration = `--mp-alt`, unselected = `--mp-cell` with `--mp-cell-border`.
- Guide-tone line: SVG overlay above the grid connecting selected cells with a 2px stroke in `--mp-line-color`. Re-render on resize and on panel open.
- Legend pill row at top of panel with a swatch for each role + guide-tone line + melody selection.
- Toolbar is inline (not big buttons): path type buttons, "Clear melody", "Key: Bb major" badge.
- Container background: `var(--mp-bg)` on the wrapping element. Rest of the app palette does not affect this panel.

**Preserve:** exact same click-to-select behavior per cell, same path-type mode logic, same key-center computation. Only classes and container structure change.

### 5.5 Session, ribbon, anticipation

**Session strip** (top of Cockpit view):
- Left: pulsing dot + session timer (24:07) + "Session · of 60:00" label. Clicking opens Timer drawer.
- Middle: song name (clickable, dashed underline, opens Songbook drawer) + loop range descriptor + focus block name + progress bar.
- Right: loops counter "87 / 100" + "loops" label.

**Chart ribbon**:
- Label row with section name + Set Start Here / Set End Here buttons + loop range badge in `--hot`.
- 12 bar tiles in a 12-column grid. Current bar = accent color and slightly scaled. Bars inside loop = `--loop` fill. Bar immediately following current gets `--info` border ring.
- Clicking a bar selects it. Selection state is the same one the Lead Sheet Grid uses.

**Anticipation strip** (4 tiles wide, `2fr 1fr 1fr 1fr`):
- NOW tile: label "Now · Bar N", chord (~64px), mode info line, beat indicator (4 blocks).
- NEXT tile: label "Next", "Bar N+1", chord, mode, "in X beats". Border color `--info`.
- Two "Then" tiles: same but smaller emphasis, longer countdowns.

**Preserve:** the current-bar/next-bar computation, loop start/end handlers, bar selection state. This section is purely a new render of the same state.

### 5.6 Drawers

**Songbook drawer** (opens from top-bar 📚 icon or from clicking the song name in the session strip):
- Left-side slide-out, max width 440px or 88vw.
- Header: title, close button.
- Body: search input, category chip row, then grouped song lists.
- Footer: export row (Lead Sheet PDF, MusicXML, Improv Guide, Notion, Import BB Songs).
- Content: **every existing songbook item and category**. Do not shorten. Preserve the current data source.

**Timer drawer** (opens from top-bar ⏱ icon or from clicking the timer in the session strip):
- Right-side slide-out.
- Big timer readout (5:00 default), Play/Reset/+1min actions, length grid (1/2/3/5/10/15/20/25/30/45/60), Stop-at-0:00 toggle, and a new "Auto-log session to memory" toggle (see §8 · Appendix for the new session logging).

**Scrim** behind both drawers (semi-opaque overlay); clicking scrim closes drawer.

**Preserve:** every existing songbook click handler (load song, transpose target on load, category filter) and every timer handler (start, reset, +1 min, length change, stop-at-zero). Only the container is new.

### 5.7 Sticky transport

Fixed, centered on the bottom of the viewport:
- Play/Pause button (large, accent color).
- Loop toggle (outlined, `--hot`).
- Group: Tempo (with +/- arrows), Swing, Bars range, Timer readout.
- Settings gear icon at far right.

**Preserve:** all handlers. This bar is a new render of existing transport state; it does not replace the mechanics. If Tempo currently lives in a slider inside a form, that slider stays where it is inside the Band & Mix power panel; the sticky transport shows a synchronized display of the same value.

### 5.8 Power panels

Collapsible sections stacked under the practice canvas. Default state: Band & Mix open, others closed. State persists in localStorage.

- **Band & Mix**: Tempo, Swing, Reverb, Piano comping style (12 pianists), Bass (6 bassists), Drums style (4), Melody toggle, Play Mode toggle, per-instrument mute presets.
- **Melody Paths**: contains the panel described in §5.4.
- **Lead Sheet Grid**: existing Lead Sheet Grid, wrapped in the panel shell. Column selector (2/3/4/6/8), Scroll, Copy text, +Measure button, then the bars grid. Selected bar shows full editor (chord root, quality, scale root, scale). All 60+ scales in existing groups.
- **BeatForge Metronome**: independent Start, Tempo, Tap, 6 time signatures, 8th cells toggle, 3 sounds, Volume, accent cells.

**Fretboard Settings panel does not exist as a standalone power panel** in the redesign. Those controls moved inside the fretboard card (§5.3).

**Preserve:** every control listed here works exactly as before. This is a wrapper-only change.

---

## 6 · View toggle: the only new state

Add exactly one new client state field:

```
practiceView: "cockpit" | "focus"   // default "cockpit"
```

Store in `localStorage` under key `dukebox.practiceView`. Read on mount. Update on click of the top-bar toggle.

No other new state fields. Existing session state, loop state, chord state, timer state, metronome state all stay.

The "focus block" text ("Approach the 3rd from every dominant chord from a half-step below") shown in the Focus Goal card is a **display-only** element for v3. Wire it to a hardcoded string for now. A future PR will introduce a focus-block library. Do not create a Supabase schema for it in this PR.

---

## 7 · Feature preservation map

Every entry in this table must be true after the PR merges. If an entry is broken, the PR is not shippable.

| Existing feature | New location | Behavior |
|---|---|---|
| Top nav (Practice, Gig, Create, Reference, Tonal) | Top bar | Unchanged |
| Shortcuts (⌘) | Top bar right | Unchanged |
| Sign-in-to-sync indicator | Top bar (existing spot) | Unchanged |
| Palette label (currently "⛵ Regatta · Dark") | Removed as separate label; state now shown by the active chip in the palette chip row | New but equivalent |
| Load-a-starter-chart chips (Jazz Blues in Bb, etc.) | Quick Start bar above practice canvas | Same click handlers, same chips |
| Songbook browsing (all categories, all songs) | Songbook drawer | Same click-to-load |
| Song search | Songbook drawer top | Same query behavior |
| Song exports (PDF, MusicXML, Improv Guide, Notion, Import BB Songs) | Songbook drawer footer | Same handlers |
| Transpose Part (Key, Major/Minor, Roman) | Fretboard card collapsible settings | Same handlers |
| Timer (5:00, Reset, +1 min, length 1-60, Stop at 0:00) | Timer drawer | Same handlers; session strip clock is a display of the same value |
| Play (transport master) | Sticky transport | Same handler |
| Tempo slider | Band & Mix panel (slider) + sticky transport (readout + arrows) | Both edit the same value |
| Swing slider | Band & Mix panel + sticky transport readout | Same |
| Piano comping style (12 options) | Band & Mix panel | Same options, same select |
| Bass bassist (6 options) | Band & Mix panel | Same |
| Drums style (Standard/Classic/Makaya/Philly Joe) | Band & Mix panel | Same |
| Reverb slider | Band & Mix panel | Same |
| Melody toggle | Band & Mix panel + Backing band card | Same |
| Play Mode toggle | Band & Mix panel | Same |
| Per-instrument mutes | Backing band card (Cockpit) + Band & Mix panel | Same, mirrored views |
| Chart Nav loop toggle | Sticky transport LOOP button + chart ribbon LOOP badge | Same |
| Set Start at Selected Bar | Chart ribbon action buttons | Same handler |
| Set End at Selected Bar | Chart ribbon action buttons | Same handler |
| Loop range display | Chart ribbon LOOP badge + sticky transport Bars readout | Same value |
| Fretboard mode: Chord | Fretboard card collapsible settings, Systems row | Same |
| Fretboard mode: Scale | Same | Same |
| Fretboard mode: Pentatonic | Same | Same |
| Fretboard mode: Hexatonic | Same | Same |
| Fretboard mode: Martino | Same | Same |
| Fretboard mode: Hex·Chord | Same | Same |
| Fretboard mode: Barry 6th | Same | Same |
| Fretboard overlay: +Bebop Chromatic | Fretboard card Overlays row | Same |
| Fretboard overlay: +7→3 Path | Same | Same |
| Fretboard overlay: Anticipate | Same | Same |
| Tuning: Standard, Drop D, Open G, DADGAD, Open D, Open E | Fretboard card | Same select |
| Fretboard chord name/mode display | Anticipation strip NOW tile + Fretboard card title | Same data source |
| Fretboard scale notes display | Anticipation strip NOW tile mode-info line | Same source |
| Fretboard swipe / pinch / click-to-hear | Maple fretboard | Same handlers, do not touch |
| Melody Paths section (path type, key center, clear, grid) | Melody Paths power panel | Same handlers; visual restored |
| Melody Paths guide-tone line drawing | Same | Same computation, rendered as SVG overlay |
| Lead Sheet Grid column selector (2/3/4/6/8) | Lead Sheet Grid power panel toolbar | Same |
| Lead Sheet Grid Scroll / Copy text / + Measure | Same | Same |
| Per-bar ÷2 and × buttons | Same | Same |
| Per-bar chord root selector (12 notes) | Same | Same |
| Per-bar quality selector (22 qualities) | Same | Same |
| Per-bar scale root selector (12 notes) | Same | Same |
| Per-bar scale selector (60+ scales, 8 groups, plus auto suggest) | Same | Same |
| BeatForge Start | Metronome power panel | Same |
| BeatForge Tempo + Tap | Same | Same |
| BeatForge Time signature (2/4, 3/4, 4/4, 5/4, 6/4, 7/4) | Same | Same |
| BeatForge 8th cells toggle | Same | Same |
| BeatForge Sound (Click, Woodblock, Drums) | Same | Same |
| BeatForge Volume | Same | Same |
| BeatForge accent cells (click to cycle accent → normal → off) | Same | Same |

If you find an existing feature not in this table, it is preserved by default. Do not remove it.

---

## 8 · Implementation approach

### 8.1 Before writing code

1. Read `docs/mockups/practice-redesign-v3.html` end to end. Open it in a browser. Toggle every palette, every mode, both views, every drawer, every panel.
2. Grep the repo:
   ```
   grep -rn 'className=' src/app/practice/    # or wherever the Practice tab lives
   grep -rn 'style=' src/app/practice/
   grep -rn '#[0-9A-Fa-f]\{6\}' src/          # find literal colors to migrate
   ```
3. Map the existing components to §5. Write a short plan file (`docs/PRACTICE_REDESIGN_V3_PLAN.md`) listing the components you will touch and the ones you will not. Show the plan before making changes.

### 8.2 Suggested order of operations

1. **Tokens first.** Add `src/styles/tokens.css` with the full palette declarations from §4. Import it in the root layout. Verify with a bare `<html data-palette="studio" data-mode="light">` that CSS variables resolve.
2. **Theme switcher plumbing.** Add the client component that reads/writes `localStorage`, sets `data-palette` and `data-mode`, and renders the chip row. Wire it into the top bar. Verify all six palettes visibly change page bg.
3. **Constants layer.** Add fretboard and melody-paths tokens to `:root`. Verify they do not shift when palette flips.
4. **View toggle.** Add `practiceView` state. Render two placeholder sections; toggle switches which renders. Nothing else yet.
5. **Cockpit skeleton.** Build the top-to-bottom sections in §5.1 as empty containers with their new class names and layout. No data yet.
6. **Wire session strip.** Session timer already exists in state; render it. Loop counter is new display but reads from an existing "loop count" field if you have one; if you do not, hardcode `87 / 100` for v3 and file a follow-up ticket.
7. **Wire chart ribbon and anticipation.** These are new renders of existing bar/current/next state. Do not re-implement the bar state.
8. **Move fretboard into the new card shell.** Do not touch the fretboard's internal rendering, click handlers, or math. Just re-parent it into the new card and add the collapsible settings container around the existing mode-toggle controls. Restyle to maple with the constant tokens.
9. **Below-row cards.** Focus Goal (display-only strings for v3) and Backing band (existing data, new layout).
10. **Focus view.** Reuse the same fretboard component. Only the wrapping card sizing differs.
11. **Drawers.** Create Songbook drawer and Timer drawer. Move existing content wholesale. Do not re-implement.
12. **Sticky transport.** Wire to existing play/loop/tempo state.
13. **Power panels.** Wrap existing Band & Mix, Melody Paths, Lead Sheet Grid, Metronome components in the collapsible shell.
14. **Melody Paths visual restore.** Only the presentational layer. If the guide-tone line was rendered on a canvas or with divs, migrate to inline SVG per §5.4.
15. **Grep for literal hex.** Any hex color left inside a Practice-tab component that isn't a maple wood value or a melody-paths value is a bug. Migrate to a token.
16. **QA the preservation map.** Walk §7 top to bottom. Every row must pass.

### 8.3 Things to explicitly not do

- Do not migrate to Tailwind if the repo isn't already using it. Use whatever styling approach the repo uses (CSS Modules, styled-jsx, CSS-in-JS, plain CSS files). Tokens work in all of them.
- Do not "improve" the existing audio engine, chord detection, or scale library while you are in there.
- Do not delete the existing Fretboard Settings panel content. Move it into the fretboard card.
- Do not change the songbook data structure. Move the list into a drawer; keep the source.
- Do not persist the focus block text to Supabase in this PR.
- Do not change the URL or routing structure of the Practice tab.
- Do not touch `.claude/`, `next.config.mjs`, `package.json`, or any Supabase migration file except in the tiny way §8.4 describes.

### 8.4 Optional (defer if uncertain)

A new field on the existing `practice_session` table (or equivalent) to store the practice-view preference server-side for signed-in users. Skip if there is no user-preferences table yet; localStorage is sufficient for v3.

---

## 9 · Verification checklist

Run through this before opening the PR.

- [ ] `data-palette="studio"` and `data-mode="light"` render on first load with no flash.
- [ ] Palette chips switch instantly, page-wide, no unstyled flash.
- [ ] Dark mode toggle works for every palette.
- [ ] Flip through all 6 palettes with the fretboard visible: the fretboard visual does not change (colors, wood, note dot colors, target glow).
- [ ] Flip through all 6 palettes with the Melody Paths panel open: the panel does not change (dark navy stays, cell colors stay).
- [ ] Cockpit / Focus toggle switches views; state persists after reload.
- [ ] Every row of §7 Feature preservation map passes.
- [ ] Play a chart. Audio still works. Tempo and swing changes still take effect while playing.
- [ ] Loop range still settable via Set Start Here / Set End Here.
- [ ] Fretboard clicks still play notes.
- [ ] Melody Paths click still selects cells.
- [ ] Lead Sheet Grid edit a bar. Chord change still updates the scale suggestion. Transpose still works.
- [ ] Metronome starts independently of the band.
- [ ] Timer counts down. Stop at 0:00 still stops the band.
- [ ] Songbook loads a new song, band picks it up, chart repopulates.
- [ ] No new console errors or warnings introduced.
- [ ] `grep -rn '#[0-9A-Fa-f]\{6\}' src/app/practice/` returns only maple-wood and melody-paths values (or an empty result if those live in a separate stylesheet).

---

## 10 · One-line summary for the PR description

> Cosmetic redesign of the Practice tab: Cockpit + Focus views, new Studio default palette (with grey-driven Slate dark mode), five palettes total, always-maple fretboard, session strip and chord anticipation, tighter Melody Paths visual, collapsible power panels, Songbook and Timer drawers, sticky transport. No mechanics changed.

---

## Appendix A · Files worth reading before starting

- `docs/mockups/practice-redesign-v3.html` (this PR's visual North Star)
- `docs/UX_UI_RECOMMENDATIONS.md` (existing UX doc; follow same style)
- The current Practice tab entry file in `src/app/` or `src/pages/`
- The Fretboard component
- The Melody Paths component
- Any `theme.ts` / `tokens.css` / global stylesheet already in the repo

## Appendix B · Escalation

If any of the following happen, stop and ask before proceeding:
- A feature in §7 can't be preserved without touching mechanics.
- A grep for existing color usage returns hundreds of results (indicates a wider design system rewrite).
- The existing state model uses names that clash with the new palette/view state.
- The existing songbook or timer components are deeply entangled with layout in a way that makes drawer extraction risky.
- Anything about audio playback timing seems affected by CSS changes (should never happen, but worth surfacing).

Ping the design decision-maker with a one-line description of the conflict and the two candidate resolutions. Do not silently work around the constraint.

---

*End of spec. Ship it.*
