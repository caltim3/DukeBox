"use client"

// Cloud persistence for DukeBox — songs, setlists, and preferences synced to
// the shared Jupiter Supabase project (one JSON blob per user, mirroring the
// rhino_gig_book table pattern). Everything degrades to localStorage when the
// user is signed out or Supabase isn't configured, so the app always works.

import { useCallback, useEffect, useRef, useState } from "react"
import { supabase, isSupabaseConfigured } from "./supabase"

const LOCAL_KEY = "dukebox-library-v2"
const LEGACY_KEY = "dukebox-library"        // v1: bare array of songs
const TABLE = "dukebox_library"

export const EMPTY_LIBRARY = { songs: [], setlists: [], prefs: {} }

// ─── Local storage helpers ────────────────────────────────────────────────────
export function readLocalLibrary() {
  try {
    const v2 = localStorage.getItem(LOCAL_KEY)
    if (v2) return normalize(JSON.parse(v2))
    // Migrate v1 (array of songs saved by the old library) → v2 shape
    const v1 = localStorage.getItem(LEGACY_KEY)
    if (v1) {
      const songs = JSON.parse(v1)
      const lib = normalize({ songs, setlists: [], prefs: {} })
      writeLocalLibrary(lib)
      return lib
    }
  } catch {}
  return { ...EMPTY_LIBRARY }
}

export function writeLocalLibrary(lib) {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(normalize(lib))) } catch {}
}

function normalize(lib) {
  return {
    songs: Array.isArray(lib?.songs) ? lib.songs : [],
    setlists: Array.isArray(lib?.setlists) ? lib.setlists : [],
    prefs: lib?.prefs && typeof lib.prefs === "object" ? lib.prefs : {},
  }
}

// Merge remote + local, preferring the most recently touched of each named song
// and unioning setlists by id. Used once on sign-in so nothing is lost.
export function mergeLibraries(a, b) {
  const A = normalize(a), B = normalize(b)
  const songs = [...A.songs]
  for (const s of B.songs) {
    const i = songs.findIndex(x => x.name === s.name)
    if (i === -1) songs.push(s)
    else if ((s.updatedAt || 0) > (songs[i].updatedAt || 0)) songs[i] = s
  }
  const setlists = [...A.setlists]
  for (const sl of B.setlists) {
    const i = setlists.findIndex(x => x.id === sl.id)
    if (i === -1) setlists.push(sl)
    else if ((sl.updatedAt || 0) > (setlists[i].updatedAt || 0)) setlists[i] = sl
  }
  return { songs, setlists, prefs: { ...A.prefs, ...B.prefs } }
}

// ─── Supabase helpers ─────────────────────────────────────────────────────────
async function fetchRemote(owner) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from(TABLE).select("data").eq("owner", owner).maybeSingle()
  if (error) { console.warn("DukeBox cloud load failed:", error.message); return null }
  return data?.data ? normalize(data.data) : { ...EMPTY_LIBRARY }
}

async function pushRemote(owner, lib) {
  if (!supabase) return false
  const { error } = await supabase
    .from(TABLE)
    .upsert({ owner, data: normalize(lib), updated_at: new Date().toISOString() }, { onConflict: "owner" })
  if (error) { console.warn("DukeBox cloud save failed:", error.message); return false }
  return true
}

// ─── Auth hook ────────────────────────────────────────────────────────────────
export function useAuth() {
  const [session, setSession] = useState(null)
  const [ready, setReady] = useState(!isSupabaseConfigured)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true) })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const signIn = useCallback(async (email) => {
    if (!supabase) return { error: "Cloud sync is not configured." }
    const redirectTo = typeof window !== "undefined" ? window.location.origin : undefined
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } })
    return { error: error?.message || null }
  }, [])

  const signOut = useCallback(async () => { await supabase?.auth.signOut() }, [])

  const email = session?.user?.email || null
  return { session, email, ready, configured: isSupabaseConfigured, signIn, signOut }
}

// ─── Combined library hook ────────────────────────────────────────────────────
// Owns the whole library object (songs + setlists + prefs). Reads localStorage
// immediately; on sign-in, merges the cloud copy in and thereafter debounce-saves
// every change to both localStorage and the cloud.
export function useCloudLibrary(email) {
  const [library, setLibraryState] = useState(EMPTY_LIBRARY)
  const [status, setStatus] = useState("local")   // local | syncing | synced | error
  const emailRef = useRef(email)
  const saveTimer = useRef(null)
  const hydrated = useRef(false)

  // Initial local hydrate — run inside an async task so the first (SSR-safe)
  // render stays EMPTY and localStorage is only read on the client.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (cancelled) return
      setLibraryState(readLocalLibrary())
      hydrated.current = true
    })()
    return () => { cancelled = true }
  }, [])

  // On sign-in / -out, reconcile with the cloud. All state transitions happen
  // inside the async flow (never synchronously in the effect body).
  useEffect(() => {
    emailRef.current = email
    let cancelled = false
    ;(async () => {
      if (!email || !supabase) { if (!cancelled) setStatus("local"); return }
      setStatus("syncing")
      const remote = await fetchRemote(email)
      if (cancelled) return
      const local = readLocalLibrary()
      const merged = mergeLibraries(remote || EMPTY_LIBRARY, local)
      setLibraryState(merged)
      writeLocalLibrary(merged)
      const ok = await pushRemote(email, merged)   // seed the cloud with the merge
      if (!cancelled) setStatus(ok ? "synced" : "error")
    })()
    return () => { cancelled = true }
  }, [email])

  // Persist on every change: localStorage immediately, cloud debounced
  const setLibrary = useCallback((updater) => {
    setLibraryState(prev => {
      const next = normalize(typeof updater === "function" ? updater(prev) : updater)
      writeLocalLibrary(next)
      if (emailRef.current && supabase) {
        setStatus("syncing")
        clearTimeout(saveTimer.current)
        saveTimer.current = setTimeout(async () => {
          const ok = await pushRemote(emailRef.current, next)
          setStatus(ok ? "synced" : "error")
        }, 900)
      }
      return next
    })
  }, [])

  return { library, setLibrary, status }
}
