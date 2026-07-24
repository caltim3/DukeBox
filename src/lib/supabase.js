// Supabase client — shares Jupiter's project (personal-intelligence workspace)
// so DukeBox and Jupiter use the same account and auth users.
//
// The URL and anon key are PUBLIC by design: the anon key only grants what
// Row-Level Security allows, and this same key is already committed in
// Jupiter's public client. Env vars override for a different deployment.
//
// If neither env nor the baked-in defaults are present, `supabase` is null and
// the app runs fully in local-only mode (localStorage), degrading gracefully.

import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://pmntiraqxuptkcrukwhw.supabase.co"

// Public anon key for the shared Jupiter project (RLS-protected).
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBtbnRpcmFxeHVwdGtjcnVrd2h3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3MTA2OTEsImV4cCI6MjA4ODI4NjY5MX0.lCHv7KT3glQz_mInehVy5I1JkMLBvtxuCAkLPJVE8Co"

// In-memory fallback for environments where localStorage is unavailable.
const memStore = {}
const safeStorage = {
  getItem:    (k) => { try { return localStorage.getItem(k) } catch { return memStore[k] ?? null } },
  setItem:    (k, v) => { try { localStorage.setItem(k, v) } catch { memStore[k] = v } },
  removeItem: (k) => { try { localStorage.removeItem(k) } catch { delete memStore[k] } },
}

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        detectSessionInUrl: true,   // reads the magic-link token from the URL
        persistSession: true,
        autoRefreshToken: true,
        storage: safeStorage,
      },
    })
  : null
