import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

let _supabase = null
try {
  if (url && key) _supabase = createClient(url, key, {
    auth: { storageKey: 'holohq-auth', autoRefreshToken: true, persistSession: true }
  })
} catch(e) { console.warn('Supabase init failed', e) }

export const supabase = _supabase

export const sbSignUp = (email, pass) =>
  supabase?.auth.signUp({ email, password: pass }) ?? Promise.resolve({ error: { message: 'Supabase not configured' } })

export const sbSignIn = (email, pass) =>
  supabase?.auth.signInWithPassword({ email, password: pass }) ?? Promise.resolve({ error: { message: 'Supabase not configured' } })

export const sbSignOut = () =>
  supabase?.auth.signOut() ?? Promise.resolve({})

export const sbSave = async (uid, data) => {
  if (!supabase) return
  try {
    await supabase.from('user_data').upsert(
      { user_id: uid, data, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
  } catch(e) {}
}

export const sbLoad = async (uid) => {
  if (!supabase) return null
  try {
    const { data } = await supabase.from('user_data').select('data').eq('user_id', uid).single()
    return data?.data ?? null
  } catch(e) { return null }
}

export const sbOnAuthChange = (cb) => {
  if (!supabase) return () => {}
  try {
    const { data } = supabase.auth.onAuthStateChange(cb)
    return () => data.subscription.unsubscribe()
  } catch(e) { return () => {} }
}
