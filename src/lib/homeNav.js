// Going home, from anywhere.
//
// Home isn't a tab — it's a surface that only exists when the Practice
// workspace is selected AND PickupPracticeHome's own practiceSurface is "home".
// Nothing outside that component can set the second half, so every caller used
// to fall back to clicking the Practice tab, which lands on Practice (the "1"
// workspace) rather than Home. Home is "0" and nothing else.
//
// The return-home pill is also only rendered while the Practice workspace is
// showing, so "click the pill if it's there" silently did the wrong thing on
// Gig, Create, Reference and Tonal.
//
// So: one event, owned by PickupPracticeHome, which is the only thing that can
// actually open the home surface. Same cross-tree pattern as LOAD_STARTER_EVENT
// — home is mounted from layout.js, separate from the page's React tree.

export const GO_HOME_EVENT = "dukebox:go-home"

export function goHome() {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(GO_HOME_EVENT))
}
